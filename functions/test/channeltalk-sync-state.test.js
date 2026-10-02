/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  MAX_ATTEMPTS,
  RETRY_INTERVAL_MS,
  afterFailure,
  decideClaim,
  initialSyncDoc,
  isComplete,
  isLeaseActive,
  isRetryDue,
  leadRetryFlags,
  leaseExpiry,
  nextRetryAt,
  nextStep,
  resolveChatRecovery,
  syncDocId,
} = require("../channeltalk/sync-state");

const NOW = Date.parse("2026-10-01T07:32:00.000Z");

test("sync 문서 id는 {source}_{docId}", () => {
  assert.equal(syncDocId("contact", "AbC123"), "contact_AbC123");
  assert.throws(() => syncDocId("cmBriefs", "x"));
});

test("초기 문서: 제출 종류별 단계와 승인된 필드", () => {
  const doc = initialSyncDoc({ source: "orders", docId: "o1", email: "a@example.com", uid: "u1", flags: { test: false, internal: true }, nowMs: NOW });
  assert.deepEqual(Object.keys(doc.steps), ["identity", "profile", "chat", "note", "open", "dupTag"]);
  assert.ok(Object.values(doc.steps).every((state) => state === "pending"));
  assert.equal(doc.status, "pending");
  for (const field of ["chatCreateStartedAt", "leadCreateStartedAt", "userChatId", "nextRetryAt", "leaseUntil"]) {
    assert.equal(doc[field], null, field);
  }
  assert.deepEqual(doc.extraChatIds, []);
  assert.equal(doc.possibleOrphanLead, false);
  assert.deepEqual(doc.flags, { test: false, internal: true });

  const users = initialSyncDoc({ source: "users", docId: "u1", nowMs: NOW });
  assert.deepEqual(Object.keys(users.steps), ["identity", "profile", "dupTag"]);
});

test("건너뛸 제출은 skipped로 끝난다", () => {
  const doc = initialSyncDoc({ source: "contact", docId: "c1", skipReason: "is_test", nowMs: NOW });
  assert.equal(doc.status, "skipped");
  assert.equal(doc.skipReason, "is_test");
  assert.ok(isComplete("contact", doc.steps));
});

test("다음 단계는 끝나지 않은 첫 단계", () => {
  const steps = { identity: "done", profile: "done", chat: "creating", note: "pending", open: "pending", dupTag: "pending" };
  assert.equal(nextStep("contact", steps), "chat");
  assert.equal(nextStep("contact", { ...steps, chat: "done", note: "error" }), "note");
  assert.equal(nextStep("users", { identity: "done", profile: "done", dupTag: "skipped" }), null);
  assert.equal(nextStep("users", { identity: "creating_lead" }), "identity");
});

test("잠금은 만료 전까지만 유효하다", () => {
  assert.equal(isLeaseActive(NOW + 1, NOW), true);
  assert.equal(isLeaseActive(NOW, NOW), false);
  assert.equal(isLeaseActive(null, NOW), false);
  assert.equal(isLeaseActive({ toMillis: () => NOW + 1000 }, NOW), true);
  assert.equal(leaseExpiry(NOW), NOW + 5 * 60 * 1000);
});

test("재시도는 10분 뒤", () => {
  assert.equal(RETRY_INTERVAL_MS, 10 * 60 * 1000);
  assert.equal(nextRetryAt(NOW), NOW + RETRY_INTERVAL_MS);
});

test("실패 후 상태: 11회까지는 error + 10분 뒤 재시도, 12회째는 failed + 재시도 없음", () => {
  assert.equal(MAX_ATTEMPTS, 12);
  assert.deepEqual(afterFailure({ attempts: 1, nowMs: NOW }), { status: "error", nextRetryAt: NOW + RETRY_INTERVAL_MS });
  assert.deepEqual(afterFailure({ attempts: 11, nowMs: NOW }), { status: "error", nextRetryAt: NOW + RETRY_INTERVAL_MS });
  assert.deepEqual(afterFailure({ attempts: 12, nowMs: NOW }), { status: "failed", nextRetryAt: null });
  assert.deepEqual(afterFailure({ attempts: 13, nowMs: NOW }), { status: "failed", nextRetryAt: null });
});

test("재시도 대상: 시각이 된 error·멈춘 pending/processing만, failed·success·skipped·잠금 중은 제외", () => {
  const due = NOW - 1;
  assert.equal(isRetryDue({ status: "error", nextRetryAt: due }, NOW), true);
  assert.equal(isRetryDue({ status: "processing", nextRetryAt: due, leaseUntil: NOW - 1 }, NOW), true);
  assert.equal(isRetryDue({ status: "pending", nextRetryAt: due }, NOW), true);
  assert.equal(isRetryDue({ status: "error", nextRetryAt: NOW + 1000 }, NOW), false);
  assert.equal(isRetryDue({ status: "error", nextRetryAt: null }, NOW), false);
  assert.equal(isRetryDue({ status: "processing", nextRetryAt: due, leaseUntil: NOW + 1000 }, NOW), false);
  for (const status of ["failed", "success", "skipped"]) {
    assert.equal(isRetryDue({ status, nextRetryAt: due }, NOW), false, status);
  }
  assert.equal(isRetryDue(null, NOW), false);
});

const started = NOW;
function chat(id, overrides = {}) {
  return { id, userId: "ch-user", state: "initial", createdAt: new Date(started + 5000).toISOString(), ...overrides };
}

test("상담 복구: 찾은 상담이 없으면 새로 만든다", () => {
  assert.deepEqual(resolveChatRecovery({ candidates: [], channelUserId: "ch-user", chatCreateStartedAt: started }), { action: "create" });
});

test("상담 복구: 1건이면 채택한다", () => {
  assert.deepEqual(
    resolveChatRecovery({ candidates: [chat("c1")], channelUserId: "ch-user", chatCreateStartedAt: started }),
    { action: "adopt", chatId: "c1", extraChatIds: [] },
  );
});

test("상담 복구: 2건 이상이면 가장 먼저 생긴 것을 채택하고 나머지는 extraChatIds", () => {
  const result = resolveChatRecovery({
    candidates: [
      chat("late", { createdAt: started + 30000 }),
      chat("early", { createdAt: started + 1000 }),
      chat("mid", { createdAt: started + 2000 }),
    ],
    channelUserId: "ch-user",
    chatCreateStartedAt: started,
  });
  assert.deepEqual(result, { action: "adopt", chatId: "early", extraChatIds: ["mid", "late"] });
});

test("상담 복구: 다른 고객, initial이 아닌 상담, 의도 기록보다 오래된 상담은 제외", () => {
  const result = resolveChatRecovery({
    candidates: [
      chat("other-user", { userId: "someone-else" }),
      chat("opened", { state: "opened" }),
      chat("too-old", { createdAt: started - 2 * 60 * 1000 }),
      chat("within-skew", { createdAt: started - 30 * 1000 }),
    ],
    channelUserId: "ch-user",
    chatCreateStartedAt: started,
  });
  assert.deepEqual(result, { action: "adopt", chatId: "within-skew", extraChatIds: [] });
});

test("상담 복구: 의도 기록 시각이 없으면 새로 만든다", () => {
  assert.deepEqual(resolveChatRecovery({ candidates: [chat("c1")], channelUserId: "ch-user", chatCreateStartedAt: null }), { action: "create" });
});

test("서버 리드 생성이 애매하게 끝난 뒤 재시도하면 possibleOrphanLead", () => {
  assert.deepEqual(leadRetryFlags({ identity: "creating_lead" }), { possibleOrphanLead: true });
  assert.deepEqual(leadRetryFlags({ identity: "pending" }), { possibleOrphanLead: false });
  assert.deepEqual(leadRetryFlags(null), { possibleOrphanLead: false });
});

const syncable = { sync: true, skipReason: null, flags: { test: false, internal: false } };
const testOnly = { sync: false, skipReason: "is_test", flags: { test: false, internal: false } };
const claimBase = { source: "contact", docId: "c1", email: "buyer@example.com", nowMs: NOW };

test("처리권: 처음이고 켜져 있으면 processing, attempts 1, lease 5분, 안전망 10분", () => {
  const result = decideClaim({ ...claimBase, existing: null, classification: syncable, enabled: true });
  assert.equal(result.action, "process");
  assert.equal(result.create.status, "processing");
  assert.equal(result.create.attempts, 1);
  assert.equal(result.create.leaseUntil, NOW + 5 * 60 * 1000);
  assert.equal(result.create.nextRetryAt, NOW + RETRY_INTERVAL_MS);
  assert.equal(result.create.pendingReason, null);
});

test("처리권: 일반 isTest는 스위치와 무관하게 skipped(is_test)로 확정", () => {
  for (const enabled of [true, false]) {
    const result = decideClaim({ ...claimBase, existing: null, classification: testOnly, enabled });
    assert.equal(result.action, "skip");
    assert.equal(result.create.status, "skipped");
    assert.equal(result.create.skipReason, "is_test");
    assert.equal(result.create.pendingReason, null);
    assert.equal(result.create.nextRetryAt, null);
  }
});

test("처리권: 스위치가 꺼져 있으면 pending + intake_disabled, nextRetryAt=제출 시각, attempts 0", () => {
  const submittedAtMs = NOW - 60 * 1000;
  const result = decideClaim({ ...claimBase, existing: null, classification: syncable, enabled: false, submittedAtMs });
  assert.equal(result.action, "defer");
  assert.equal(result.create.status, "pending");
  assert.equal(result.create.pendingReason, "intake_disabled");
  assert.equal(result.create.skipReason, null);
  assert.equal(result.create.nextRetryAt, submittedAtMs);
  assert.equal(result.create.attempts, 0);
  assert.equal(result.create.leaseUntil, null);
});

test("처리권: 대기 중이던 건은 켜진 뒤 pendingReason을 지우고 1회째로 처리", () => {
  const deferred = decideClaim({ ...claimBase, existing: null, classification: syncable, enabled: false }).create;
  const result = decideClaim({ ...claimBase, existing: deferred, classification: syncable, enabled: true });
  assert.equal(result.action, "process");
  assert.equal(result.patch.attempts, 1);
  assert.equal(result.patch.pendingReason, null);
  assert.equal(result.patch.status, "processing");
});

test("처리권: 꺼져 있으면 기존 건(pending·error)을 건드리지 않는다", () => {
  assert.deepEqual(decideClaim({ ...claimBase, existing: { status: "error", attempts: 3 }, classification: syncable, enabled: false }), { action: "none" });
  assert.deepEqual(decideClaim({ ...claimBase, existing: { status: "pending", attempts: 0 }, classification: syncable, enabled: false }), { action: "none" });
});

test("처리권: success·skipped·failed와 lease가 유효한 건은 처리하지 않는다", () => {
  for (const status of ["success", "skipped", "failed"]) {
    assert.deepEqual(decideClaim({ ...claimBase, existing: { status, attempts: 1 }, classification: syncable, enabled: true }), { action: "none" }, status);
  }
  assert.deepEqual(
    decideClaim({ ...claimBase, existing: { status: "processing", attempts: 1, leaseUntil: NOW + 1000 }, classification: syncable, enabled: true }),
    { action: "none" },
  );
});

test("처리권: 이미 12회면 API를 부르지 않고 failed", () => {
  const result = decideClaim({ ...claimBase, existing: { status: "processing", attempts: 12, leaseUntil: NOW - 1 }, classification: syncable, enabled: true });
  assert.equal(result.action, "fail");
  assert.deepEqual(result.patch, { status: "failed", nextRetryAt: null, leaseUntil: null, updatedAt: NOW });
});

test("처리권: 11회까지 실패한 error 건은 12회째로 처리", () => {
  const result = decideClaim({ ...claimBase, existing: { status: "error", attempts: 11, nextRetryAt: NOW - 1 }, classification: syncable, enabled: true });
  assert.equal(result.action, "process");
  assert.equal(result.patch.attempts, 12);
});
