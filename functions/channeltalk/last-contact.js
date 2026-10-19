/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * lastContactAt 자동 갱신: 웹훅 메시지 판정과 프로필 보호 (순수 함수 + 요청 처리기).
 *
 * 규칙 원본: docs/plans/2026-10-19-channeltalk-v2.md 6장.
 * - 판정표는 가설이다. 공식 문서(type·event·chatType·personType)와 0단계 관찰(내부대화 options,
 *   log.action)만 근거로 쓰고, 확인되지 않은 형태(연동 이메일 등)는 갱신하지 않는다(hold).
 * - 인증은 우리가 정한 수신 URL 토큰(query `auth`)만 쓴다. Channel 쪽 서명 방식은 확인 전이라 쓰지 않는다.
 * - 모드: off(아무것도 안 함) / observe(판정·형태만 로그, 쓰기 없음) / on(PATCH). 알 수 없는 값은 off.
 * - on에서도 다른 프로필 값 보호를 위해: 보내는 값은 { profile: { lastContactAt } } 하나, 쓰기 전 타입 검사,
 *   쓰기 후 다른 필드 변화 감지 시 이 인스턴스는 observe로 내려간다.
 * - 로그에는 형태와 사유만 남긴다(본문·이메일·이름·Secret 금지).
 */
const crypto = require("node:crypto");
const { floorToMinute } = require("./field-types");

const MODES = new Set(["off", "observe", "on"]);
const FIELD = "lastContactAt";
// Desk 타입이 정해진 필드(V1 4장). 여기에 타입이 틀린 값이 있으면 PATCH가 그 값을 강제 변환할 수 있다(0단계).
const TYPED_FIELDS = {
  moq: "number",
  orderCount: "number",
  briefUpdatedAt: "datetime",
  lastCheckoutCompletedAt: "datetime",
  lastContactAt: "datetime",
  businessType: "list",
  marketCountry: "list",
};
// 2020-01-01 이후, 지금+1일 이전의 밀리초만 받는다. 단위가 다르면(마이크로초 등) 갱신하지 않는다.
const MIN_MS = Date.UTC(2020, 0, 1);
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return MODES.has(mode) ? mode : "off";
}

/** 상수 시간 비교. 기대값이 비어 있으면 항상 거부한다. */
function verifyAuth(provided, expected) {
  if (typeof expected !== "string" || expected.length < 16) return false;
  if (typeof provided !== "string" || !provided) return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function lower(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * 메시지 이벤트를 판정한다.
 * @returns {{ action: "update"|"ignore"|"hold", reason: string, userId?: string, atMs?: number }}
 *   update: 실제 고객·담당자 메시지. ignore: 확실히 제외. hold: 근거가 부족해 갱신하지 않음.
 */
function classifyEvent(payload, { nowMs = Date.now() } = {}) {
  if (!payload || typeof payload !== "object") return { action: "hold", reason: "no_payload" };
  if (lower(payload.type) !== "message") return { action: "ignore", reason: "not_message_type" };
  if (lower(payload.event) !== "push") return { action: "hold", reason: "unknown_event" };
  const entity = payload.entity;
  if (!entity || typeof entity !== "object") return { action: "hold", reason: "no_entity" };

  const chatType = lower(entity.chatType);
  if (chatType === "group") return { action: "ignore", reason: "team_chat" };
  if (chatType !== "userchat") return { action: "hold", reason: "unknown_chat_type" };
  if (entity.log) return { action: "ignore", reason: "system_log" };

  const options = Array.isArray(entity.options) ? entity.options.map(lower) : [];
  if (options.includes("private")) return { action: "ignore", reason: "private_note" };
  if (options.includes("silenttouser")) return { action: "ignore", reason: "silent_to_user" };

  const personType = lower(entity.personType);
  if (personType === "bot") return { action: "ignore", reason: "bot" };
  if (personType !== "user" && personType !== "manager") return { action: "hold", reason: "unknown_person_type" };

  // 연동 이메일의 형태는 확인 전이다. 이메일 흔적이 있는 메시지는 판정을 보류한다.
  if (Object.keys(entity).some((key) => /mail/i.test(key)) || /mail/i.test(String(entity.source || entity.medium || ""))) {
    return { action: "hold", reason: "email_unverified" };
  }

  const refers = payload.refers && typeof payload.refers === "object" ? payload.refers : {};
  const fromUser = refers.user && typeof refers.user.id === "string" ? refers.user.id : null;
  const fromChat = refers.userChat && typeof refers.userChat.userId === "string" ? refers.userChat.userId : null;
  if (fromUser && fromChat && fromUser !== fromChat) return { action: "hold", reason: "user_ref_mismatch" };
  const userId = fromUser || fromChat || (personType === "user" && typeof entity.personId === "string" ? entity.personId : null);
  if (!userId) return { action: "hold", reason: "no_user_id" };

  const createdAt = entity.createdAt;
  if (!Number.isSafeInteger(createdAt) || createdAt < MIN_MS || createdAt > nowMs + MAX_FUTURE_MS) {
    return { action: "hold", reason: "invalid_created_at" };
  }
  return { action: "update", reason: personType === "user" ? "customer_message" : "manager_message", userId, atMs: floorToMinute(createdAt) };
}

/** 로그용 형태 요약. 값(본문·이메일·이름·id)은 넣지 않는다. */
function describeShape(payload, headers = {}) {
  const entity = (payload && payload.entity) || {};
  return {
    type: typeof payload?.type === "string" ? payload.type : null,
    event: typeof payload?.event === "string" ? payload.event : null,
    chatType: typeof entity.chatType === "string" ? entity.chatType : null,
    personType: typeof entity.personType === "string" ? entity.personType : null,
    options: Array.isArray(entity.options) ? entity.options.filter((o) => typeof o === "string").slice(0, 10) : null,
    logAction: entity.log && typeof entity.log.action === "string" ? entity.log.action : entity.log ? "present" : null,
    createdAtDigits: Number.isFinite(entity.createdAt) ? String(Math.trunc(entity.createdAt)).length : null,
    entityKeys: Object.keys(entity).sort(),
    refersKeys: payload && payload.refers && typeof payload.refers === "object" ? Object.keys(payload.refers).sort() : [],
    headerNames: Object.keys(headers || {}).map((h) => h.toLowerCase()).sort(),
  };
}

function isValidType(kind, value) {
  if (value === null || value === undefined || value === "") return true;
  if (kind === "number" || kind === "datetime") return typeof value === "number" && Number.isFinite(value);
  if (kind === "list") return Array.isArray(value) && value.every((v) => typeof v === "string");
  return true;
}

/** 타입이 틀린 필드 이름. 하나라도 있으면 PATCH하지 않는다. */
function findTypeRisks(profile) {
  const p = profile || {};
  return Object.keys(TYPED_FIELDS).filter((field) => !isValidType(TYPED_FIELDS[field], p[field])).sort();
}

/** 쓰기 전후 프로필에서 lastContactAt 외에 바뀐 필드 이름. */
function changedOtherFields(before, after) {
  const a = before || {};
  const b = after || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => key !== FIELD && JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .sort();
}

/**
 * 웹훅 요청 처리기. 의존성을 주입받아 단위 테스트한다.
 * @param {object} deps
 * @param {() => string} deps.getMode
 * @param {() => string} deps.getToken          수신 URL 토큰(Secret)
 * @param {() => {getUser: Function, patchUser: Function}} deps.getApi  on 모드에서만 만든다
 * @param {(entry: object) => void} deps.log
 */
function createWebhookHandler({ getMode, getToken, getApi, log, now = () => Date.now() }) {
  let tripped = false;

  return async function handleWebhook(req) {
    if (req.method !== "POST") return { status: 405, body: "method_not_allowed" };
    // 인증을 먼저 본다. 인증되지 않은 요청은 어떤 모드에서도 처리하지 않는다.
    if (!verifyAuth(req.query && req.query.auth, getToken())) {
      log({ outcome: "rejected", reason: "auth" });
      return { status: 401, body: "unauthorized" };
    }
    const configured = normalizeMode(getMode());
    const mode = configured === "on" && tripped ? "observe" : configured;
    if (mode === "off") return { status: 200, body: "off" };

    const payload = req.body;
    const decision = classifyEvent(payload, { nowMs: now() });
    const base = { mode, action: decision.action, reason: decision.reason };
    if (mode === "observe" || decision.action !== "update") {
      log({ ...base, outcome: "observed", shape: describeShape(payload, req.headers) });
      return { status: 200, body: "ok" };
    }

    try {
      return await applyUpdate(getApi(), decision, base);
    } catch (error) {
      // API 오류는 재시도하지 않는다(재전송 동작 미확인). 다음 메시지나 과거 기록 채우기에서 보완된다.
      return done(log, base, "error", error && (error.code || error.name) ? String(error.code || error.name) : "unknown", { level: "error" });
    }
  };

  async function applyUpdate(api, decision, base) {
    const user = await api.getUser(decision.userId);
    if (!user) return done(log, base, "skip", "user_missing");
    if (user.type === "unified") return done(log, base, "skip", "user_unified");
    const before = user.profile || {};
    const risks = findTypeRisks(before);
    if (risks.length > 0) return done(log, base, "skip", "type_risk", { fields: risks });
    const current = Number.isFinite(before[FIELD]) ? floorToMinute(before[FIELD]) : null;
    if (current !== null && current >= decision.atMs) return done(log, base, "skip", "not_newer");

    const patched = await api.patchUser(decision.userId, { profile: { [FIELD]: decision.atMs } });
    const after = (patched && patched.profile) || ((await api.getUser(decision.userId)) || {}).profile || {};
    const changed = changedOtherFields(before, after);
    if (changed.length > 0) {
      tripped = true;
      return done(log, base, "alert", "other_fields_changed", { fields: changed, level: "error" });
    }
    if (!Number.isFinite(after[FIELD]) || floorToMinute(after[FIELD]) !== decision.atMs) {
      return done(log, base, "warn", "value_not_applied", { level: "warn" });
    }
    return done(log, base, "updated", null);
  }
}

function done(log, base, outcome, reason, extra = {}) {
  log({ ...base, outcome, ...(reason ? { skipReason: reason } : {}), ...extra });
  return { status: 200, body: "ok" };
}

module.exports = {
  TYPED_FIELDS,
  changedOtherFields,
  classifyEvent,
  createWebhookHandler,
  describeShape,
  findTypeRisks,
  normalizeMode,
  verifyAuth,
};
