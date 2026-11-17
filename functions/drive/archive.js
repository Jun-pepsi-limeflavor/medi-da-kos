/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Contact 브리프 아카이브: Storage 임시 파일(contact-briefs/{contactId}/{index}) → 공유 드라이브.
 *
 * contact/{id}.briefArchive (서버만 쓴다. 클라이언트 규칙은 contact update 전부 거부):
 *   status: pending | completed | partial | failed
 *   folderId, folderUrl          문의 폴더 (관리자 메일 링크)
 *   folderClaimedAt              폴더 생성 중 표시(동시 생성 방지, 2분 지나면 무효)
 *   files: { "0": { name, size, contentType, status: uploaded | failed, driveFileId?, driveUrl?, error?, archivedAt } }
 *   updatedAt
 *
 * - 폴더는 onContactCreated(메일 링크용)와 파일 트리거 중 먼저 온 쪽이 만든다. Firestore 트랜잭션으로 한쪽만 만든다.
 * - 재시도해도 중복이 생기지 않게: 문의 폴더·파일은 appProperties(contactId / briefIndex)로 먼저 찾는다.
 * - Drive 업로드에 성공하면 Storage 임시 파일을 지운다. 실패하면 남겨 두고(버킷 lifecycle 7일) 상태에 failed를 기록한다.
 */
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { briefFileName, briefFolderPath } = require("./naming");

const CLAIM_MS = 2 * 60 * 1000;
const PATH_RE = /^contact-briefs\/([^/]+)\/([0-2])$/;

/** Another call is creating the folder: retry shortly. */
class RetryLater extends Error {
  constructor(message) {
    super(message);
    this.name = "RetryLater";
  }
}

/** { contactId, index } for contact-briefs/{contactId}/{0|1|2}, else null. */
function parseBriefPath(name) {
  const m = PATH_RE.exec(name || "");
  return m ? { contactId: m[1], index: Number(m[2]) } : null;
}

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const SIGNATURES = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ZIP,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ZIP,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ZIP,
};

/** The file's first bytes match the declared type (a renamed .exe does not pass as .pdf). */
function matchesDeclaredType(data, contentType) {
  const sig = SIGNATURES[contentType];
  return Boolean(sig) && data.length >= sig.length && sig.every((byte, i) => data[i] === byte);
}

/** Overall status once `files` (index → entry) is recorded, for `total` declared files. */
function archiveStatus(total, files) {
  const entries = Object.values(files || {});
  if (entries.length < total) return "pending";
  const uploaded = entries.filter((f) => f.status === "uploaded").length;
  if (uploaded === total) return "completed";
  return uploaded === 0 ? "failed" : "partial";
}

/**
 * Inquiry folder for `contactId`, created on first call. Throws RetryLater while another call holds the claim.
 * @returns {Promise<{ id: string, url: string }>}
 */
async function ensureContactFolder({ db, drive, rootFolderId, contactId, now = Date.now }) {
  if (!rootFolderId) throw new Error("DRIVE_BRIEF_ROOT_FOLDER_ID is not set");
  const ref = db.collection("contact").doc(contactId);

  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`contact/${contactId} not found`);
    const contact = snap.data();
    const archive = contact.briefArchive || {};
    if (archive.folderId) return { folder: { id: archive.folderId, url: archive.folderUrl } };
    const claimedAt = archive.folderClaimedAt?.toMillis?.() ?? 0;
    if (claimedAt && now() - claimedAt < CLAIM_MS) throw new RetryLater(`contact/${contactId} folder is being created`);
    tx.set(
      ref,
      {
        briefArchive: {
          status: archive.status || "pending",
          folderClaimedAt: Timestamp.fromMillis(now()),
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
    return { contact };
  });
  if (claim.folder) return claim.folder;

  const { contact } = claim;
  const { segments, folderName } = briefFolderPath({
    contactId,
    companyName: contact.companyName,
    createdAt: contact.serverCreatedAt?.toDate?.() ?? new Date(now()),
    isTest: contact.isTest === true,
  });
  let parentId = rootFolderId;
  for (const name of segments) parentId = (await drive.ensureFolder(parentId, name)).id;

  const folder =
    (await drive.findByAppProperty(parentId, "contactId", contactId)) ||
    (await drive.createFolder(parentId, folderName, {
      appProperties: { contactId },
      description: `Medidakos Contact inquiry ${contactId}`,
    }));

  await ref.set(
    {
      briefArchive: {
        folderId: folder.id,
        folderUrl: folder.webViewLink,
        folderClaimedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );
  return { id: folder.id, url: folder.webViewLink };
}

/** Records briefArchive.files[index] and recomputes the overall status. */
async function recordFile(db, contactId, index, entry) {
  const ref = db.collection("contact").doc(contactId);
  await db.runTransaction(async (tx) => {
    const contact = (await tx.get(ref)).data() || {};
    const files = { ...(contact.briefArchive?.files || {}), [index]: entry };
    tx.set(
      ref,
      {
        briefArchive: {
          files: { [index]: { ...entry, archivedAt: FieldValue.serverTimestamp() } },
          status: archiveStatus((contact.briefFiles || []).length, files),
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
  });
}

/**
 * Moves one uploaded Storage object to Drive. Throws only for errors worth retrying
 * (RetryLater, retryable DriveError, Firestore/Storage errors); permanent problems are recorded as failed.
 * @returns {Promise<string>} outcome for logs
 */
async function archiveBriefObject({ db, drive, bucket, rootFolderId, objectName, isRetryable }) {
  const parsed = parseBriefPath(objectName);
  if (!parsed) return "ignored-path";
  const { contactId, index } = parsed;
  const key = String(index);
  const object = bucket.file(objectName);

  const snap = await db.collection("contact").doc(contactId).get();
  const meta = snap.exists ? snap.data().briefFiles?.[index] : undefined;
  if (!meta) return "no-declaration"; // storage.rules prevents this; leave it to the bucket lifecycle
  if (snap.data().briefArchive?.files?.[key]?.status === "uploaded") {
    await object.delete({ ignoreNotFound: true });
    return "already-archived";
  }

  const base = { name: briefFileName(index, meta.name), size: meta.size, contentType: meta.contentType };
  const [data] = await object.download();
  if (data.length !== meta.size || !matchesDeclaredType(data, meta.contentType)) {
    await recordFile(db, contactId, key, { ...base, status: "failed", error: "content_mismatch" });
    await object.delete({ ignoreNotFound: true });
    return "content-mismatch";
  }

  try {
    const folder = await ensureContactFolder({ db, drive, rootFolderId, contactId });
    const file =
      (await drive.findByAppProperty(folder.id, "briefIndex", key)) ||
      (await drive.uploadFile({
        parentId: folder.id,
        name: base.name,
        mimeType: meta.contentType,
        data,
        appProperties: { contactId, briefIndex: key },
      }));
    await recordFile(db, contactId, key, {
      ...base,
      status: "uploaded",
      driveFileId: file.id,
      driveUrl: file.webViewLink,
      error: FieldValue.delete(), // clears an earlier failed attempt's error
    });
  } catch (error) {
    if (isRetryable(error)) throw error;
    await recordFile(db, contactId, key, { ...base, status: "failed", error: String(error.message).slice(0, 300) });
    return "failed";
  }
  await object.delete({ ignoreNotFound: true });
  return "uploaded";
}

module.exports = {
  RetryLater,
  archiveBriefObject,
  archiveStatus,
  ensureContactFolder,
  matchesDeclaredType,
  parseBriefPath,
};
