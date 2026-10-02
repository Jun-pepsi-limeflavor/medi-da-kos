// functions/channeltalk/store.js를 Firestore 에뮬레이터에서 실제 트랜잭션으로 확인한다.
// firebase-admin은 functions 패키지 사본을 써서 store.js와 같은 Timestamp·FieldValue를 공유한다.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import assert from "node:assert/strict";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { createStore, SYNC, IDENTITIES } = require("./channeltalk/store.js");

const app = initializeApp({ projectId: "demo-medidakos" }, `channeltalk-store-${randomUUID()}`);
const db = getFirestore(app);
const store = createStore(db, { Timestamp, FieldValue });
const NOW = Date.parse("2026-10-02T01:00:00.000Z");
const syncable = { sync: true, skipReason: null, flags: { test: false, internal: false } };
const written = [];

after(async () => {
  await Promise.all(written.map((ref) => ref.delete().catch(() => {})));
  await deleteApp(app);
});

function track(collection, id) {
  written.push(db.collection(collection).doc(id));
}

test("처리권: 동시에 두 번 잡으면 한 번만 process", async () => {
  const docId = `c-${randomUUID()}`;
  track(SYNC, `contact_${docId}`);
  const input = { source: "contact", docId, email: "buyer@example.com", classification: syncable, enabled: true, nowMs: NOW };
  const results = await Promise.all([store.claim(input), store.claim(input)]);
  assert.deepEqual(results.map((r) => r.action).sort(), ["none", "process"]);
  const sync = await store.getSync("contact", docId);
  assert.equal(sync.status, "processing");
  assert.equal(sync.attempts, 1);
  assert.equal(sync.leaseUntil, NOW + 5 * 60 * 1000);
  assert.equal(sync.nextRetryAt, NOW + 10 * 60 * 1000);
  const raw = (await db.collection(SYNC).doc(`contact_${docId}`).get()).data();
  assert.ok(raw.leaseUntil instanceof Timestamp);
});

test("처리권: 스위치가 꺼져 있으면 pending + intake_disabled로 기록", async () => {
  const docId = `d-${randomUUID()}`;
  track(SYNC, `contact_${docId}`);
  const result = await store.claim({ source: "contact", docId, email: "buyer@example.com", classification: syncable, enabled: false, nowMs: NOW, submittedAtMs: NOW - 1000 });
  assert.equal(result.action, "defer");
  const sync = await store.getSync("contact", docId);
  assert.equal(sync.status, "pending");
  assert.equal(sync.pendingReason, "intake_disabled");
  assert.equal(sync.nextRetryAt, NOW - 1000);
});

test("updateSync는 steps 점 경로와 시각 필드를 저장한다", async () => {
  const docId = `u-${randomUUID()}`;
  track(SYNC, `contact_${docId}`);
  await store.claim({ source: "contact", docId, email: "buyer@example.com", classification: syncable, enabled: true, nowMs: NOW });
  await store.updateSync("contact", docId, { "steps.chat": "creating", chatCreateStartedAt: NOW + 5 }, NOW + 10);
  const sync = await store.getSync("contact", docId);
  assert.equal(sync.steps.chat, "creating");
  assert.equal(sync.steps.identity, "pending");
  assert.equal(sync.chatCreateStartedAt, NOW + 5);
  assert.equal(sync.updatedAt, NOW + 10);
});

test("매핑: 첫 고객은 대표, 다른 고객은 otherChannelUserIds, 회원 uid는 한 번만", async () => {
  const email = `buyer-${randomUUID()}@example.com`;
  track(IDENTITIES, encodeURIComponent(email));
  await store.recordIdentity({ email, channelUserId: "lead-1", origin: "browser", nowMs: NOW });
  await store.recordIdentity({ email: email.toUpperCase(), channelUserId: "member-1", origin: "member", uid: "uid-1", nowMs: NOW });
  await store.recordIdentity({ email, channelUserId: "member-1", origin: "member", uid: "uid-1", nowMs: NOW });
  const mapping = await store.getMapping(email);
  assert.equal(mapping.channelUserId, "lead-1");
  assert.equal(mapping.channelUserOrigin, "browser");
  assert.deepEqual(mapping.otherChannelUserIds, ["member-1"]);
  assert.equal(mapping.uid, "uid-1");
  assert.equal(mapping.memberId, "uid-1");

  await store.setDupPairState(email, "lead-1_member-1", "tagged", NOW);
  await store.setFirstSource(email, "contact", NOW);
  await store.setFirstSource(email, "signup", NOW);
  const updated = await store.getMapping(email);
  assert.equal(updated.dupPairs["lead-1_member-1"].state, "tagged");
  assert.equal(updated.firstSource, "contact");
});

test("재시도 조회: nextRetryAt이 지난 건만 오래된 순, failed·lease 중은 제외", async () => {
  const base = `r-${randomUUID()}`;
  const ids = [`${base}-old`, `${base}-new`, `${base}-failed`, `${base}-leased`, `${base}-future`];
  ids.forEach((id) => track(SYNC, `contact_${id}`));
  const far = NOW - 365 * 24 * 60 * 60 * 1000; // 다른 테스트 문서보다 앞서도록 아주 오래된 시각
  await store.claim({ source: "contact", docId: ids[0], email: "a@example.com", classification: syncable, enabled: false, nowMs: NOW, submittedAtMs: far });
  await store.claim({ source: "contact", docId: ids[1], email: "a@example.com", classification: syncable, enabled: false, nowMs: NOW, submittedAtMs: far + 1000 });
  await store.claim({ source: "contact", docId: ids[2], email: "a@example.com", classification: syncable, enabled: false, nowMs: NOW, submittedAtMs: far });
  await store.updateSync("contact", ids[2], { status: "failed", nextRetryAt: null }, NOW);
  await store.claim({ source: "contact", docId: ids[3], email: "a@example.com", classification: syncable, enabled: false, nowMs: NOW, submittedAtMs: far });
  await store.updateSync("contact", ids[3], { status: "processing", leaseUntil: NOW + 60000 }, NOW);
  await store.claim({ source: "contact", docId: ids[4], email: "a@example.com", classification: syncable, enabled: false, nowMs: NOW, submittedAtMs: NOW + 60000 });

  const due = (await store.listRetryDue(NOW, 50)).map((doc) => doc.docId).filter((id) => id.startsWith(base));
  assert.deepEqual(due, [ids[0], ids[1]]);
});

test("주문 목록: 같은 uid의 주문과 isTest", async () => {
  const uid = `uid-${randomUUID()}`;
  const a = `o-${randomUUID()}`;
  const b = `o-${randomUUID()}`;
  track("orders", a);
  track("orders", b);
  await db.collection("orders").doc(a).set({ uid, isTest: false, createdAt: "2026-09-01T00:00:00.000Z" });
  await db.collection("orders").doc(b).set({ uid, isTest: true, createdAt: "2026-09-02T00:00:00.000Z" });
  const orders = (await store.listOrdersForUid(uid)).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  assert.deepEqual(orders.map((o) => [o.id, o.isTest]), [[a, false], [b, true]]);
});

test("매핑: 사라진 대표는 새 고객으로 교체하고 missingChannelUserIds로 옮긴다", async () => {
  const email = `stale-${randomUUID()}@example.com`;
  track(IDENTITIES, encodeURIComponent(email));
  await store.recordIdentity({ email, channelUserId: "gone-1", origin: "browser", nowMs: NOW });
  await store.recordIdentity({ email, channelUserId: "other-1", origin: "browser", nowMs: NOW });
  await store.recordIdentity({ email, channelUserId: "lead-2", origin: "server_lead", missingIds: ["gone-1"], nowMs: NOW });
  const mapping = await store.getMapping(email);
  assert.equal(mapping.channelUserId, "lead-2");
  assert.equal(mapping.channelUserOrigin, "server_lead");
  assert.deepEqual(mapping.missingChannelUserIds, ["gone-1"]);
  assert.deepEqual(mapping.otherChannelUserIds, ["other-1"]);

  // 이미 대표가 정정된 뒤 같은 고객으로 다시 기록해도 바뀌지 않는다
  await store.recordIdentity({ email, channelUserId: "lead-2", origin: "browser", nowMs: NOW });
  const again = await store.getMapping(email);
  assert.equal(again.channelUserId, "lead-2");
  assert.deepEqual(again.otherChannelUserIds, ["other-1"]);
});
