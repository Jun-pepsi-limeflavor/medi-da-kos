// /api/cookie-consent의 Firestore 쓰기 방식을 에뮬레이터에서 실제 Admin SDK로 확인한다:
// create() + serverTimestamp, 같은 eventId 두 번째 create는 ALREADY_EXISTS(code 6) → 라우트는 중복 성공으로 처리.
// 운영·dev Firebase에는 접속하지 않는다(demo-medidakos 에뮬레이터 전용).
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";

const app = initializeApp({ projectId: "demo-medidakos" }, `cookie-consent-${randomUUID()}`);
const db = getFirestore(app);
const created = [];

after(async () => {
  await Promise.all(created.map((ref) => ref.delete().catch(() => {})));
  await deleteApp(app);
});

test("create() stores once; a second create with the same eventId fails with ALREADY_EXISTS (code 6)", async () => {
  const ref = db.collection("cookieConsentLogs").doc(randomUUID());
  created.push(ref);
  const deleteAt = new Date("2028-05-24T03:00:00.000Z");
  const data = { consentId: randomUUID(), action: "consent", analytics: true, marketing: false, deleteAt, recordedAt: FieldValue.serverTimestamp() };

  await ref.create(data);
  const snap = await ref.get();
  assert.ok(snap.get("recordedAt") instanceof Timestamp, "server time");
  assert.ok(snap.get("deleteAt") instanceof Timestamp, "Date is stored as a Timestamp (TTL field)");
  assert.equal(snap.get("deleteAt").toDate().toISOString(), deleteAt.toISOString());

  await assert.rejects(ref.create({ ...data, analytics: false }), (error) => error.code === 6);
  assert.equal((await ref.get()).get("analytics"), true, "first record unchanged");
});
