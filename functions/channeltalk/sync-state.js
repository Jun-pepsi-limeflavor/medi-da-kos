/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * channelTalkSync 처리 기록 계산 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 8장 "중복 방지".
 * 시각은 모두 밀리초 숫자로 받는다. Firestore Timestamp 변환은 호출하는 쪽이 한다.
 */
const { toMillis } = require("./field-types");

const STEPS_BY_SOURCE = {
  users: ["identity", "profile", "dupTag"],
  contact: ["identity", "profile", "chat", "note", "open", "dupTag"],
  landingRequests: ["identity", "profile", "chat", "note", "open", "dupTag"],
  orders: ["identity", "profile", "chat", "note", "open", "dupTag"],
};

const FINISHED = new Set(["done", "skipped"]);
const LEASE_MS = 5 * 60 * 1000;
const RETRY_INTERVAL_MS = 10 * 60 * 1000;
// 최초 처리를 포함한 자동 처리 시도의 최대 횟수. 도달하면 failed로 두고 사람이 확인한다.
const MAX_ATTEMPTS = 12;
// Channel 서버와 우리 서버의 시각 차이를 감안한 여유
const CLOCK_SKEW_MS = 60 * 1000;

function stepsFor(source) {
  const steps = STEPS_BY_SOURCE[source];
  if (!steps) throw new Error(`지원하지 않는 원천: ${source}`);
  return steps;
}

function syncDocId(source, docId) {
  stepsFor(source);
  return `${source}_${docId}`;
}

/** 처음 생성할 sync 문서. skipReason이 있으면 처리하지 않고 skipped로 끝낸다. */
function initialSyncDoc({ source, docId, email = null, uid = null, flags, skipReason = null, nowMs }) {
  const steps = Object.fromEntries(stepsFor(source).map((step) => [step, skipReason ? "skipped" : "pending"]));
  return {
    source,
    docId,
    email,
    uid,
    identitySource: null,
    channelUserId: null,
    userChatId: null,
    chatCreateStartedAt: null,
    extraChatIds: [],
    leadCreateStartedAt: null,
    possibleOrphanLead: false,
    noteMessageIds: [],
    noteParts: 0,
    steps,
    status: skipReason ? "skipped" : "pending",
    skipReason,
    flags: flags || { test: false, internal: false },
    profileResult: null,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
    leaseUntil: null,
    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

/** 아직 끝나지 않은 첫 단계. 모두 끝났으면 null. */
function nextStep(source, steps) {
  return stepsFor(source).find((step) => !FINISHED.has((steps || {})[step])) || null;
}

function isComplete(source, steps) {
  return nextStep(source, steps) === null;
}

function isLeaseActive(leaseUntil, nowMs) {
  const until = toMillis(leaseUntil);
  return until !== null && until > nowMs;
}

function leaseExpiry(nowMs, durationMs = LEASE_MS) {
  return nowMs + durationMs;
}

/** 실패 후 다음 재시도 시각. 10분 주기 스캔이 nextRetryAt <= 지금 인 건을 집는다. */
function nextRetryAt(nowMs, intervalMs = RETRY_INTERVAL_MS) {
  return nowMs + intervalMs;
}

/**
 * 한 번의 자동 처리가 실패한 뒤의 상태.
 * - error: 자동 재시도 대상. nextRetryAt을 잡는다.
 * - failed: 자동 재시도 종료, 사람 확인 필요. nextRetryAt은 비운다.
 * @param {number} attempts 이번 시도를 포함한, 최초 처리부터의 자동 처리 시도 횟수
 */
function afterFailure({ attempts, nowMs, maxAttempts = MAX_ATTEMPTS, intervalMs = RETRY_INTERVAL_MS }) {
  if (attempts >= maxAttempts) return { status: "failed", nextRetryAt: null };
  return { status: "error", nextRetryAt: nextRetryAt(nowMs, intervalMs) };
}

// 처리 중에 함수가 멈추면 status가 pending·processing으로 남는다. 잠금이 풀린 뒤 다시 집는다.
const RETRYABLE_STATUSES = new Set(["pending", "processing", "error"]);

/** 재시도 스캔이 집을 건인가. failed·success·skipped와 잠금 중인 건은 제외한다. */
function isRetryDue(doc, nowMs) {
  if (!doc || !RETRYABLE_STATUSES.has(doc.status)) return false;
  const due = toMillis(doc.nextRetryAt);
  if (due === null || due > nowMs) return false;
  return !isLeaseActive(doc.leaseUntil, nowMs);
}

/**
 * 상담 생성 결과가 애매할 때(steps.chat === "creating") 이미 만들어진 상담을 찾는다.
 * candidates는 GET /open/user-chats?state=initial 결과다. 이 고객의 상담 중
 * chatCreateStartedAt(여유 포함) 이후에 생긴 initial 상담만 본다.
 *
 * @returns {{action: "create"} | {action: "adopt", chatId: string, extraChatIds: string[]}}
 */
function resolveChatRecovery({ candidates, channelUserId, chatCreateStartedAt, skewMs = CLOCK_SKEW_MS }) {
  const startedAt = toMillis(chatCreateStartedAt);
  if (startedAt === null) return { action: "create" };
  const matches = (Array.isArray(candidates) ? candidates : [])
    .filter((chat) => chat && chat.userId === channelUserId && chat.state === "initial")
    .map((chat) => ({ id: chat.id, createdAt: toMillis(chat.createdAt) }))
    .filter((chat) => chat.id && chat.createdAt !== null && chat.createdAt >= startedAt - skewMs)
    .sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
  if (!matches.length) return { action: "create" };
  return { action: "adopt", chatId: matches[0].id, extraChatIds: matches.slice(1).map((chat) => chat.id) };
}

/**
 * 서버 리드 생성 응답을 못 받은 채(steps.identity === "creating_lead") 다시 시도하는 경우.
 * API에 이메일 검색이 없어 이전 시도의 리드를 찾을 수 없으므로 빈 리드가 남았을 수 있다고 표시한다.
 */
function leadRetryFlags(steps) {
  return { possibleOrphanLead: (steps || {}).identity === "creating_lead" };
}

module.exports = {
  CLOCK_SKEW_MS,
  LEASE_MS,
  MAX_ATTEMPTS,
  RETRY_INTERVAL_MS,
  afterFailure,
  initialSyncDoc,
  isRetryDue,
  isComplete,
  isLeaseActive,
  leadRetryFlags,
  leaseExpiry,
  nextRetryAt,
  nextStep,
  resolveChatRecovery,
  stepsFor,
  syncDocId,
};
