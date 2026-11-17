/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Contact 브리프 → Google 공유 드라이브 (2026-11).
 * - onContactBriefUploaded: Storage contact-briefs/{contactId}/{index} 업로드 완료 시 Drive로 옮긴다(기본 버킷).
 *   재시도 가능한 오류(Drive 429·5xx·네트워크, 폴더 생성 대기)는 throw → 재시도. 1시간 지난 이벤트는 failed로 기록하고 끝낸다.
 * - getBriefFolderUrl: onContactCreated가 관리자 메일에 넣을 문의 폴더 링크(먼저 폴더를 만든다).
 * 루트 폴더: functions/.env.<projectId> 의 DRIVE_BRIEF_ROOT_FOLDER_ID. Drive 계정: drive-archiver@<projectId>.
 */
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { defineString } = require("firebase-functions/params");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { RetryLater, archiveBriefObject, ensureContactFolder } = require("./archive");
const { DriveError, createDriveClient } = require("./client");

const DRIVE_BRIEF_ROOT_FOLDER_ID = defineString("DRIVE_BRIEF_ROOT_FOLDER_ID");
const GIVE_UP_MS = 60 * 60 * 1000;

let drive;
function getDrive() {
  drive ??= createDriveClient({
    targetPrincipal: `drive-archiver@${process.env.GCLOUD_PROJECT}.iam.gserviceaccount.com`,
  });
  return drive;
}

function isRetryable(error) {
  return error instanceof RetryLater || (error instanceof DriveError && error.retryable);
}

const onContactBriefUploaded = onObjectFinalized(
  // Files up to 50 MB are held in memory once (download → Drive PUT): 1 GiB with at most 4 files per instance
  // (default would be 80 at 1 CPU), 300 s for slow Drive uploads.
  { region: "asia-northeast3", memory: "1GiB", concurrency: 4, timeoutSeconds: 300, retry: true },
  async (event) => {
    const objectName = event.data.name;
    const ageMs = Date.now() - Date.parse(event.time);
    const outcome = await archiveBriefObject({
      db: getFirestore(),
      drive: getDrive(),
      bucket: getStorage().bucket(event.data.bucket),
      rootFolderId: DRIVE_BRIEF_ROOT_FOLDER_ID.value(),
      objectName,
      // After an hour of retries, stop and leave 'failed' on the inquiry instead.
      isRetryable: (error) => ageMs < GIVE_UP_MS && isRetryable(error),
    });
    if (outcome !== "ignored-path") console.log(`contact brief ${objectName}: ${outcome}`);
  },
);

/**
 * Drive folder link for the admin mail, or null if it could not be made now (the file trigger retries it later).
 * Waits briefly when the file trigger is creating the folder at the same moment.
 */
async function getBriefFolderUrl(contactId) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const folder = await ensureContactFolder({
        db: getFirestore(),
        drive: getDrive(),
        rootFolderId: DRIVE_BRIEF_ROOT_FOLDER_ID.value(),
        contactId,
      });
      return folder.url;
    } catch (error) {
      if (!(error instanceof RetryLater)) {
        console.error(`contact brief folder for ${contactId} failed`, error);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  return null;
}

module.exports = { onContactBriefUploaded, getBriefFolderUrl };
