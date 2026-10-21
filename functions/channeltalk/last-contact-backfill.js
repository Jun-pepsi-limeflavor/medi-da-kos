/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * lastContactAt 과거 기록 채우기(백필). 규칙 원본: docs/plans/2026-10-19-channeltalk-v2.md 6장.
 *
 * - 판정은 실시간 웹훅과 같은 classifyEvent를 쓴다(고객·담당자 일반 메시지와 Channel 연동 이메일만 인정,
 *   내부대화·봇·시스템 로그·팀챗·일괄 발송 제외, 모르는 작성 유형은 보류).
 * - 고객 한 명의 모든 상담방에서 가장 최근의 유효한 메시지 시각(분 단위)을 고른다.
 * - lastContactAt이 비어 있는 고객만 profileOnce로 채운다. 이미 값이 있으면 쓰지 않는다.
 *   profileOnce는 빈 칸에만 들어가므로 그 사이 웹훅이 더 최신 값을 넣었어도 덮어쓰지 않는다.
 * - 쓰기 전 타입 검사, 쓰기 후 전체 비교(compareUsers), Firestore 중단 플래그를 웹훅과 함께 쓴다.
 * - Channel 조회는 GET 전용 클라이언트(createHistoryClient)로 한다. V1 접수 클라이언트(api.js)는 바꾸지 않는다.
 */
const { ChannelTalkApiError } = require("./api");
const { toMillis } = require("./field-types");
const { isEmailCompatible, resolveChannelUser } = require("./identity");
const { classifyEvent, compareUsers, findTypeRisks } = require("./last-contact");

const BASE_URL = "https://api.channel.io";
const PAGE_LIMIT = 100;

/**
 * 백필용 GET 전용 Channel 클라이언트. 404는 null, 그 밖의 실패는 ChannelTalkApiError.
 * 오류 메시지에 경로의 id를 넣지 않는다.
 */
function createHistoryClient({ accessKey, accessSecret, version, fetchImpl = globalThis.fetch, timeoutMs = 10000, baseUrl = BASE_URL }) {
  if (!accessKey || !accessSecret) throw new TypeError("Channel Talk access key and secret are required");
  async function get(path, label, query = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}${params.size ? `?${params}` : ""}`, {
        method: "GET",
        headers: { "x-access-key": accessKey, "x-access-secret": accessSecret, "Channel-Version": version, Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      const code = error && error.name === "AbortError" ? "timeout" : "network_error";
      throw new ChannelTalkApiError(`GET ${label} ${code}`, { code, ambiguous: true });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      const ambiguous = res.status === 429 || res.status >= 500;
      throw new ChannelTalkApiError(`GET ${label} ${res.status}`, { status: res.status, code: ambiguous ? (res.status === 429 ? "rate_limited" : "server_error") : "rejected", ambiguous });
    }
    try {
      return await res.json();
    } catch {
      throw new ChannelTalkApiError(`GET ${label} invalid_json`, { code: "invalid_json", ambiguous: true });
    }
  }
  const enc = encodeURIComponent;
  return {
    async getUser(userId) {
      const data = await get(`/open/users/${enc(userId)}`, "user");
      return data && data.user ? data.user : null;
    },
    /** 상태별 전체 상담 목록. 종료 상담은 최근 100개까지만 나온다(2026-10-21 확인). */
    async listUserChatsPage({ state, cursor = null, limit = PAGE_LIMIT }) {
      const data = await get("/open/user-chats", "user-chats", { state, limit, sortOrder: "desc", cursor });
      return { userChats: (data && data.userChats) || [], nextCursor: (data && data.hasNext && data.nextCursor) || null };
    },
    /** 고객 한 명의 상담 목록(상태 무관, v5). */
    async listUserChatsOfUserPage(userId, { since = null, limit = PAGE_LIMIT } = {}) {
      const data = await get(`/open/v5/users/${enc(userId)}/user-chats`, "user user-chats", { limit, sortOrder: "desc", since });
      return { userChats: (data && data.userChats) || [], next: (data && typeof data.next === "string" && data.next) || null };
    },
    /** 상담 메시지 한 페이지(최신순). createdAt은 ISO 문자열로 온다. */
    async listMessagesPage(userChatId, { cursor = null, limit = PAGE_LIMIT } = {}) {
      const data = await get(`/open/user-chats/${enc(userChatId)}/messages`, "messages", { limit, sortOrder: "desc", cursor });
      return { messages: (data && data.messages) || [], nextCursor: (data && data.hasNext && data.nextCursor) || null };
    },
  };
}

/** 과거 메시지 한 건을 웹훅과 같은 규칙으로 판정한다. ISO·밀리초 시각을 모두 받는다. */
function judgeMessage(message, { userId, nowMs }) {
  const createdAt = toMillis(message && message.createdAt);
  const entity = { ...(message || {}), chatType: (message && message.chatType) || "userChat", createdAt: Number.isFinite(createdAt) ? Math.trunc(createdAt) : null };
  return classifyEvent({ type: "Message", event: "push", entity, refers: { userChat: { userId } } }, { nowMs });
}

/**
 * 상담방 하나에서 가장 최근의 유효한 메시지 시각. 최신순으로 넘기다 처음 만난 유효 메시지에서 멈춘다.
 * 그보다 새로운 보류(hold) 메시지가 있으면 판단을 사람에게 넘긴다(review).
 */
async function latestInChat(client, chat, { nowMs, maxPages = 5 }) {
  let cursor = null;
  const holds = new Set();
  for (let page = 0; page < maxPages; page += 1) {
    const { messages, nextCursor } = await client.listMessagesPage(chat.id, { cursor });
    for (const message of messages) {
      const decision = judgeMessage(message, { userId: chat.userId, nowMs });
      if (decision.action === "update") {
        return holds.size > 0 ? { status: "review", reason: "newer_unverified_message", holds: [...holds].sort(), atMs: decision.atMs } : { status: "found", atMs: decision.atMs, reason: decision.reason };
      }
      if (decision.action === "hold") holds.add(decision.reason);
    }
    if (!nextCursor || nextCursor === cursor) return holds.size > 0 ? { status: "review", reason: "unverified_only", holds: [...holds].sort() } : { status: "none" };
    cursor = nextCursor;
  }
  return { status: "review", reason: "page_limit" };
}

/** 고객 한 명의 모든 상담(상태 무관). */
async function listChatsOfUser(client, userId, { maxPages = 10 } = {}) {
  const chats = [];
  let since = null;
  for (let page = 0; page < maxPages; page += 1) {
    const { userChats, next } = await client.listUserChatsOfUserPage(userId, { since });
    chats.push(...userChats.filter((c) => c && c.userId === userId));
    if (!next || next === since) return { chats, complete: true };
    since = next;
  }
  return { chats, complete: false };
}

/**
 * 백필 계획을 만든다(읽기만).
 * @param {object} input
 * @param {object} input.client     createHistoryClient(또는 같은 모양)
 * @param {string[]} input.userIds  상담 기록이 있을 수 있는 Channel 고객 id(전체 상담 목록·Firestore 기록에서 수집)
 * @param {Map<string, object[]>} [input.globalChatsByUser]  전체 상담 목록(상태별)에서 모은 고객별 상담.
 *   고객별 목록에 안 나오는 상담이 있어(2026-10-21 확인) 두 목록을 상담 id로 합친다.
 * @returns {Promise<{targets, skips, reviews, stats}>}
 */
async function buildBackfillPlan({ client, userIds, globalChatsByUser = new Map(), nowMs = Date.now(), maxChatPages = 10, maxMessagePages = 5 }) {
  const users = new Map();
  const getUser = async (id) => {
    if (!users.has(id)) users.set(id, await client.getUser(id));
    return users.get(id);
  };
  const byFinal = new Map(); // 최종 고객 id → { user, atMs, sources, chats }
  const skips = [];
  const reviews = [];
  const stats = { userIds: 0, chats: 0, chatsWithContact: 0, chatsOnlyPerUser: 0, chatsOnlyGlobal: 0, chatsInBoth: 0 };
  const chatResults = new Map(); // 상담 id → latestInChat 결과(같은 상담을 두 번 읽지 않는다)

  for (const userId of [...new Set(userIds)].sort()) {
    stats.userIds += 1;
    const resolved = await resolveChannelUser(getUser, userId);
    if (resolved.kind === "missing") { skips.push({ userId, reason: "user_missing" }); continue; }
    if (resolved.kind === "unresolved" || resolved.kind === "unified_missing") { reviews.push({ userId, reason: "unified_unresolved" }); continue; }
    const finalUser = resolved.kind === "unified" ? resolved.canonical : resolved.user;
    const original = resolved.kind === "unified" ? await getUser(userId) : finalUser;
    // 통합 전 고객의 기록은 이메일이 비었거나 같을 때만 최종 고객으로 옮긴다(V1 1장 규칙).
    if (resolved.kind === "unified" && !isEmailCompatible(finalUser, emailOf(original))) {
      reviews.push({ userId, finalUserId: finalUser.id, reason: "unified_other_email" });
      continue;
    }

    let listed;
    try {
      listed = await listChatsOfUser(client, userId, { maxPages: maxChatPages });
    } catch (error) {
      // 확실한 거부(4xx)는 이 고객만 검토로 보낸다. 애매한 실패(429·5xx·시간 초과)는 실행을 멈춘다.
      if (error instanceof ChannelTalkApiError && !error.ambiguous) {
        reviews.push({ userId, reason: "chat_list_failed", status: error.status });
        continue;
      }
      throw error;
    }
    if (!listed.complete) { reviews.push({ userId, reason: "chat_page_limit" }); continue; }
    const merged = new Map();
    const perUserIds = new Set(listed.chats.map((c) => c.id));
    const globalChats = (globalChatsByUser.get(userId) || []).filter((c) => c && c.userId === userId);
    const globalIds = new Set(globalChats.map((c) => c.id));
    for (const c of [...listed.chats, ...globalChats]) if (!merged.has(c.id)) merged.set(c.id, c);
    for (const id of merged.keys()) {
      if (perUserIds.has(id) && globalIds.has(id)) stats.chatsInBoth += 1;
      else if (perUserIds.has(id)) stats.chatsOnlyPerUser += 1;
      else stats.chatsOnlyGlobal += 1;
    }
    const chats = [...merged.values()];
    stats.chats += chats.length;
    let best = null;
    let review = null;
    for (const chat of chats) {
      if (!chatResults.has(chat.id)) chatResults.set(chat.id, await latestInChat(client, chat, { nowMs, maxPages: maxMessagePages }));
      const result = chatResults.get(chat.id);
      if (result.status === "found") {
        stats.chatsWithContact += 1;
        if (!best || result.atMs > best) best = result.atMs;
      } else if (result.status === "review") {
        review = review || { userId, reason: result.reason, holds: result.holds || [] };
      }
    }
    if (review) { reviews.push(review); continue; }
    const entry = byFinal.get(finalUser.id) || { user: finalUser, atMs: null, sources: [] };
    entry.sources.push(userId);
    if (best !== null && (entry.atMs === null || best > entry.atMs)) entry.atMs = best;
    byFinal.set(finalUser.id, entry);
  }

  const targets = [];
  for (const [channelUserId, entry] of [...byFinal.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const profile = entry.user.profile || {};
    if (entry.atMs === null) { skips.push({ userId: channelUserId, reason: "no_contact" }); continue; }
    if (Number.isFinite(profile.lastContactAt)) { skips.push({ userId: channelUserId, reason: "already_set" }); continue; }
    const risks = findTypeRisks(profile);
    if (risks.length > 0) { reviews.push({ userId: channelUserId, reason: "type_risk", fields: risks }); continue; }
    targets.push({ channelUserId, atMs: entry.atMs, sources: entry.sources.sort() });
  }
  return { targets, skips, reviews, stats };
}

function emailOf(user) {
  return (user && ((user.profile && user.profile.email) || user.email)) || "";
}

/**
 * 고객 한 명 채우기. 쓰기 직전 다시 읽어 확인하고, profileOnce만 보낸다.
 * @returns {Promise<object>} 로그 한 줄(값·id 외 개인정보 없음)
 */
async function applyBackfillTarget(target, { api, control, nowMs }) {
  const entry = { channelUserId: target.channelUserId, outcome: "skip", reason: null };
  const skip = (reason, extra = {}) => Object.assign(entry, { reason, ...extra });
  const user = await api.getUser(target.channelUserId);
  if (!user) return skip("user_missing");
  if (user.type === "unified") return skip("user_unified");
  const before = user.profile || {};
  if (Number.isFinite(before.lastContactAt)) return skip("already_set_now");
  const risks = findTypeRisks(before);
  if (risks.length > 0) return skip("type_risk", { fields: risks });

  await api.patchUser(target.channelUserId, { profileOnce: { lastContactAt: target.atMs } });
  const reread = await api.getUser(target.channelUserId);
  if (!reread) {
    await control.halt({ reason: "user_missing_after_patch", fields: [], channelUserId: target.channelUserId, nowMs });
    return Object.assign(entry, { outcome: "alert", reason: "user_missing_after_patch" });
  }
  const diff = compareUsers(user, reread);
  if (diff.unexpected.length > 0) {
    await control.halt({ reason: "other_fields_changed", fields: diff.unexpected, channelUserId: target.channelUserId, nowMs });
    return Object.assign(entry, { outcome: "alert", reason: "other_fields_changed", fields: diff.unexpected, auto: diff.auto });
  }
  const after = (reread.profile || {}).lastContactAt;
  if (after === target.atMs) return Object.assign(entry, { outcome: "applied", auto: diff.auto });
  // profileOnce라 그 사이 웹훅이 넣은 더 최신 값이 유지된 경우
  if (Number.isFinite(after) && after > target.atMs) return Object.assign(entry, { outcome: "superseded" });
  return Object.assign(entry, { outcome: "warn", reason: "value_not_applied" });
}

/**
 * 대상 순서대로 채운다. 매 건 쓰기 전에 중단 플래그를 확인하고(읽기 실패도 중단), 오류·이상·건너뜀 상한에서 멈춘다.
 */
async function runBackfill(targets, { api, control, now = () => Date.now(), maxSkips = 3, maxWrites = Infinity, onEntry = () => {} }) {
  const summary = { processed: 0, applied: 0, superseded: 0, skipped: 0, skipReasons: {}, patches: 0, stopped: null };
  for (const target of targets) {
    try {
      if (await control.isHalted()) { summary.stopped = "halted"; break; }
    } catch {
      summary.stopped = "halt_check_failed";
      break;
    }
    if (summary.patches >= maxWrites) { summary.stopped = "write_limit"; break; }
    let entry;
    try {
      entry = await applyBackfillTarget(target, {
        api: { ...api, patchUser: (id, body) => { summary.patches += 1; return api.patchUser(id, body); } },
        control,
        nowMs: now(),
      });
    } catch (error) {
      const code = error instanceof ChannelTalkApiError ? `channel_${error.code}` : "error";
      onEntry({ channelUserId: target.channelUserId, outcome: "error", reason: code });
      summary.stopped = code;
      break;
    }
    onEntry(entry);
    summary.processed += 1;
    if (entry.outcome === "applied") summary.applied += 1;
    else if (entry.outcome === "superseded") summary.superseded += 1;
    else if (entry.outcome === "alert" || entry.outcome === "warn") { summary.stopped = entry.reason; break; }
    else {
      summary.skipped += 1;
      summary.skipReasons[entry.reason] = (summary.skipReasons[entry.reason] || 0) + 1;
      // 그 사이 웹훅이 값을 채운 경우(already_set_now)는 정상이라 중단 횟수에 넣지 않는다.
      const unexpected = Object.entries(summary.skipReasons).filter(([r]) => r !== "already_set_now").reduce((n, [, c]) => n + c, 0);
      if (unexpected >= maxSkips) { summary.stopped = "too_many_skips"; break; }
    }
  }
  return summary;
}

/** 실행 로그에서 이미 끝난 고객(applied·superseded·already_set_now). */
function doneFromLog(entries) {
  return new Set(entries.filter((e) => ["applied", "superseded"].includes(e.outcome) || e.reason === "already_set_now").map((e) => e.channelUserId));
}

module.exports = {
  applyBackfillTarget,
  buildBackfillPlan,
  createHistoryClient,
  doneFromLog,
  judgeMessage,
  latestInChat,
  listChatsOfUser,
  runBackfill,
};
