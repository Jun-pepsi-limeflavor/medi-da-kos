/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * V2 기존 고객 프로필 이관 실행 (dry-run 결과 → Channel profileOnce PATCH + 매핑 기록).
 *
 * 규칙 원본: docs/plans/2026-10-19-channeltalk-v2.md 2~5장, V1 설계 1·4·5장.
 * - 대상: dry-run에서 신원이 확실히 맞은 link 고객만. 검토·신규 생성 후보·중복 후보는 손대지 않는다.
 * - 쓰기 직전 최신 고객을 다시 읽어 신원이 그대로인지 확인하고, 이미 값이 있는 칸은 빼고 빈 칸만 profileOnce로 보낸다.
 * - 기존 회원 PUT upsert, profile(덮어쓰기), 태그, 상담, 고객 생성은 하지 않는다.
 * - email은 보내지 않는다. 회원에게 같은 이메일을 쓰면 Channel이 리드를 자동 통합할 수 있다(V1 1장).
 * - 매핑은 없을 때만 V1 store.recordIdentity로 만든다. 다른 고객을 가리키는 매핑이 있으면 아무것도 쓰지 않는다.
 * - V1 channelTalkSync(보류 기록 포함)는 읽지도 쓰지도 않는다.
 */
const { ChannelTalkApiError } = require("./api");
const { normalizeEmail } = require("./email");
const { userEmail } = require("./identity");

const AUTO_REASONS = new Set(["uid_member", "v1_mapping", "email_unique"]);
// 이관에서 보내지 않는 필드. email: 자동 통합 위험. firstSource는 매핑에도 남긴다.
const NEVER_SEND = new Set(["email"]);
// pilot은 회원 경로(uid_member)와 리드 경로(email_unique·v1_mapping)를 함께 확인한다.
const PILOT_QUOTA = { member: 3, lead: 2 };
const PILOT_MAX = PILOT_QUOTA.member + PILOT_QUOTA.lead;

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** 자동 적용 대상인지와 그 이유. */
function eligibility(customer, { testChannelIds }) {
  if (customer.decision !== "link") return "not_link";
  if (!customer.channelUserId) return "no_channel_user";
  if (!customer.reasons.every((reason) => AUTO_REASONS.has(reason))) return "not_auto_reason";
  if ((customer.dupCandidates || []).length > 0 || (customer.notes || []).includes("dup_candidate")) return "dup_candidate";
  if (testChannelIds.has(customer.channelUserId)) return "test_channel_id";
  if (!customer.profile) return "no_profile_plan";
  return null;
}

/**
 * 실행 대상 목록. 키 순으로 정렬해 매번 같은 순서로 처리한다.
 * @param {object} plan  dry-run plan.json
 * @param {object} options
 * @param {"pilot"|"full"} options.mode  pilot은 보류 고객을 빼고 채울 칸이 있는 고객 중 회원 3명·리드 2명.
 *        한쪽이 모자라도 다른 쪽으로 채우지 않는다
 * @param {number} [options.limit]
 * @param {Set<string>} [options.doneKeys]  이전 실행 로그에서 끝난 고객(건너뜀)
 */
function selectTargets(plan, { mode, limit, doneKeys = new Set(), testChannelIds = new Set() }) {
  if (mode !== "pilot" && mode !== "full") throw new Error(`알 수 없는 실행 모드: ${mode}`);
  const excluded = {};
  const targets = [];
  for (const customer of [...plan.customers].sort((a, b) => a.key.localeCompare(b.key))) {
    const reason = eligibility(customer, { testChannelIds })
      || (doneKeys.has(customer.key) ? "already_done" : null)
      || (mode === "pilot" && customer.held ? "pilot_skips_held" : null)
      || (mode === "pilot" && Object.keys(customer.profile.profileOnce).length === 0 ? "pilot_nothing_to_fill" : null);
    if (reason) excluded[reason] = (excluded[reason] || 0) + 1;
    else targets.push(customer);
  }
  if (mode === "full") return { targets: targets.slice(0, limit || targets.length), eligible: targets.length, excluded };
  const members = targets.filter((c) => c.uid).slice(0, PILOT_QUOTA.member);
  const leads = targets.filter((c) => !c.uid).slice(0, PILOT_QUOTA.lead);
  const picked = new Set([...members, ...leads]);
  const chosen = targets.filter((c) => picked.has(c)).slice(0, Math.min(limit || PILOT_MAX, PILOT_MAX));
  return { targets: chosen, eligible: targets.length, excluded, pilot: { members: members.length, leads: leads.length } };
}

class StopRun extends Error {}


/**
 * 빈 칸만 profileOnce로 채우고(휴대폰 번호는 따로), 매핑이 없으면 만든다. 이관·생성이 같이 쓴다.
 * @param {Set<string>} [neverSend]  보내지 않을 필드
 */
async function fillProfileAndMap(customer, user, { api, store, nowMs, entry, email, mapping, origin, neverSend = NEVER_SEND }) {
  const profile = (user && user.profile) || {};
  const send = {};
  for (const [field, value] of Object.entries(customer.profile.profileOnce)) {
    if (neverSend.has(field)) entry.dropped[field] = "never_send";
    else if (hasValue(profile[field])) entry.dropped[field] = "already_set_now";
    else send[field] = value;
  }

  const { mobileNumber, ...rest } = send;
  if (Object.keys(rest).length > 0) {
    await api.patchUser(user.id, { profileOnce: rest });
    entry.applied.push(...Object.keys(rest).sort());
  }
  if (mobileNumber !== undefined) {
    try {
      await api.patchUser(user.id, { profileOnce: { mobileNumber } });
      entry.applied.push("mobileNumber");
    } catch (error) {
      // V1과 같은 규칙: 번호 자체가 거부되면(422) 번호만 포기한다.
      if (!(error instanceof ChannelTalkApiError && error.status === 422)) throw error;
      entry.dropped.mobileNumber = "rejected_by_channel";
    }
  }

  if (email && !mapping) {
    await store.recordIdentity({ email, channelUserId: user.id, origin, uid: customer.uid || null, nowMs });
    entry.mapping = "created";
  }
  const firstSource = customer.profile.profileOnce.firstSource;
  if (email && firstSource && (!mapping || !mapping.firstSource)) await store.setFirstSource(email, firstSource, nowMs);
}

/**
 * 고객 한 명을 처리한다. 신원 불일치는 건너뛰고(skip), API·저장 오류는 던진다(실행 중단).
 * @returns {Promise<object>} 로그 한 줄(고객 정보는 key 외에 담지 않는다)
 */
async function applyCustomer(customer, { api, store, nowMs }) {
  const entry = { key: customer.key, outcome: "skip", reason: null, applied: [], dropped: {}, mapping: "unchanged" };
  const skip = (reason) => Object.assign(entry, { reason });
  const email = normalizeEmail(customer.email || "");

  const user = await api.getUser(customer.channelUserId);
  if (!user) return skip("channel_user_missing");
  if (user.type === "unified") return skip("channel_user_unified");
  const currentEmail = userEmail(user);
  if (email && currentEmail && currentEmail !== email) return skip("channel_email_changed");
  if (customer.uid && !(user.member === true && user.memberId === customer.uid)) return skip("member_mismatch");
  if (!customer.uid && user.member === true) return skip("unexpected_member");

  let mapping = null;
  if (email) {
    mapping = await store.getMapping(email);
    if (mapping && mapping.channelUserId && mapping.channelUserId !== customer.channelUserId) return skip("mapping_conflict");
    if (mapping && mapping.uid && customer.uid && mapping.uid !== customer.uid) return skip("mapping_uid_conflict");
  }

  await fillProfileAndMap(customer, user, { api, store, nowMs, entry, email, mapping, origin: customer.uid ? "member" : "imported" });
  entry.outcome = entry.applied.length > 0 || entry.mapping === "created" ? "applied" : "already_done";
  return entry;
}


// ── 신규 생성 ────────────────────────────────────────────────────────────────
// 회원: @uid가 지금도 없을 때만 PUT @uid { profile: { firebaseUid } } (V1 규칙). 리드: POST /open/users { email }.
// 생성 요청 전에 intent를 로그에 남기고, 생성 뒤에는 Channel id를 남긴다. 마지막 줄이 intent·created_pending이면
// 결과를 알 수 없는 고객이므로 다음 실행에서 자동으로 다시 만들지 않는다(사람이 Desk에서 확인).
const CREATE_REASON = { member: "member_404", lead: "no_channel_match" };
const CREATE_PILOT_MAX = 2;

/** 실행 로그들에서 끝난 고객과 결과를 알 수 없는 고객을 고른다. */
function readLogState(entries) {
  const last = new Map();
  for (const entry of entries) last.set(entry.key, entry);
  const doneKeys = new Set();
  const uncertainKeys = new Set();
  for (const [key, entry] of last) {
    if (["applied", "already_done", "created"].includes(entry.outcome)) doneKeys.add(key);
    else if (["intent", "created_pending"].includes(entry.outcome)) uncertainKeys.add(key);
    else if (entry.outcome === "error" && entry.uncertain) uncertainKeys.add(key);
  }
  // 한 번이라도 생성 의도를 남긴 고객은 끝났어도 다시 만들지 않는다.
  for (const entry of entries) if (entry.outcome === "intent" && !doneKeys.has(entry.key)) uncertainKeys.add(entry.key);
  return { doneKeys, uncertainKeys };
}

/**
 * 생성 대상. 허용 목록(사람이 확인한 키)에 있고, 이번 dry-run에서도 같은 사유의 create_candidate인 고객만.
 * @param {"member"|"lead"} options.kind
 */
function selectCreateTargets(plan, { kind, allowKeys, doneKeys = new Set(), uncertainKeys = new Set(), pilot = false, limit }) {
  if (!CREATE_REASON[kind]) throw new Error(`알 수 없는 생성 종류: ${kind}`);
  if (!(allowKeys instanceof Set) || allowKeys.size === 0) throw new Error("생성 허용 목록이 필요합니다");
  const excluded = {};
  const targets = [];
  for (const c of [...plan.customers].sort((a, b) => a.key.localeCompare(b.key))) {
    if (c.decision !== "create_candidate" || (kind === "member") !== Boolean(c.uid)) continue;
    const reason = !allowKeys.has(c.key) ? "not_allowed"
      : c.reasons.length !== 1 || c.reasons[0] !== CREATE_REASON[kind] ? "unexpected_reason"
        : !c.email ? "no_email"
          : doneKeys.has(c.key) ? "already_done"
            : uncertainKeys.has(c.key) ? "uncertain_previous_attempt"
              : null;
    if (reason) excluded[reason] = (excluded[reason] || 0) + 1;
    else targets.push(c);
  }
  const max = pilot ? Math.min(limit || CREATE_PILOT_MAX, CREATE_PILOT_MAX) : limit || targets.length;
  return { targets: targets.slice(0, max), eligible: targets.length, excluded };
}

/**
 * 고객 한 명을 새로 만든다. 직전 재확인에서 이미 있으면 만들지 않고 건너뛴다.
 * @param {(entry: object) => void} options.intent  생성 요청 전·후 로그를 바로 남긴다
 * @param {boolean} [options.memberEmail]  회원에게 email을 profileOnce로 보낼지(같은 이메일 리드가 있으면 Channel이 통합한다)
 */
async function createCustomer(customer, { api, store, nowMs, intent, memberEmail = false }) {
  const kind = customer.uid ? "member" : "lead";
  const entry = { key: customer.key, outcome: "skip", reason: null, action: `create_${kind}`, applied: [], dropped: {}, mapping: "unchanged" };
  const skip = (reason) => Object.assign(entry, { reason });
  const email = normalizeEmail(customer.email || "");
  if (!email) return skip("no_email");

  const mapping = await store.getMapping(email);
  if (mapping) return skip("mapping_exists_now");
  if (kind === "member" && (await api.getUserByMemberId(customer.uid))) return skip("member_exists_now");

  intent({ key: customer.key, outcome: "intent", action: entry.action });
  const user = kind === "member"
    ? await api.upsertMember(customer.uid, { profile: { firebaseUid: customer.uid } })
    : await api.createLead({ email });
  if (!user || !user.id) throw new CreateUncertain("created_without_id");
  intent({ key: customer.key, outcome: "created_pending", action: entry.action, channelUserId: user.id });
  if (user.type === "unified" || (kind === "member" && !(user.member === true && user.memberId === customer.uid))) {
    throw new CreateUncertain("created_unexpected_type");
  }
  entry.channelUserId = user.id;

  const neverSend = kind === "member" && !memberEmail ? NEVER_SEND : new Set();
  await fillProfileAndMap(customer, user, {
    api, store, nowMs, entry, email, mapping: null, origin: kind === "member" ? "member" : "server_lead", neverSend,
  });
  entry.outcome = "created";
  return entry;
}

class CreateUncertain extends Error {}

/**
 * 대상을 순서대로 처리한다.
 * 중단: API·저장 오류 한 건(재시도 없음), 신원 불일치 건너뜀이 maxSkips에 도달, PATCH 수가 maxWrites에 도달.
 * @param {(entry: object) => void} [options.onEntry]  건마다 로그를 바로 남긴다(중단돼도 처리분이 남도록)
 */
async function runApply(targets, {
  api, store, now = () => Date.now(), maxSkips = 3, maxWrites = Infinity, onEntry = () => {},
  handler = applyCustomer, memberEmail = false,
}) {
  const summary = {
    processed: 0, applied: 0, created: 0, alreadyDone: 0, skipped: 0, skipReasons: {}, patches: 0, creates: 0, mappingsCreated: 0, stopped: null,
  };
  const write = (counter, call) => async (...args) => {
    if (summary.patches + summary.creates >= maxWrites) throw new StopRun(`쓰기 요청 상한(${maxWrites})에 도달했습니다`);
    summary[counter] += 1;
    return call(...args);
  };
  const countingApi = {
    getUser: (id) => api.getUser(id),
    getUserByMemberId: (uid) => api.getUserByMemberId(uid),
    patchUser: write("patches", (id, body) => api.patchUser(id, body)),
    upsertMember: write("creates", (uid, body) => api.upsertMember(uid, body)),
    createLead: write("creates", (profile) => api.createLead(profile)),
  };
  for (const customer of targets) {
    let entry;
    let attempted = false;
    try {
      entry = await handler(customer, {
        api: countingApi,
        store,
        nowMs: now(),
        memberEmail,
        intent: (line) => {
          attempted = true;
          onEntry(line);
        },
      });
    } catch (error) {
      const code = error instanceof StopRun ? "write_limit"
        : error instanceof CreateUncertain ? error.message
          : error instanceof ChannelTalkApiError ? `channel_${error.code}` : "store_error";
      // 생성 요청을 보낸 뒤의 오류는 고객이 이미 만들어졌을 수 있다. 자동으로 다시 만들지 않는다.
      onEntry({ key: customer.key, outcome: "error", reason: code, ...(attempted ? { uncertain: true } : {}) });
      summary.stopped = code;
      break;
    }
    onEntry(entry);
    summary.processed += 1;
    if (entry.mapping === "created") summary.mappingsCreated += 1;
    if (entry.outcome === "created") summary.created += 1;
    else if (entry.outcome === "applied") summary.applied += 1;
    else if (entry.outcome === "already_done") summary.alreadyDone += 1;
    else {
      summary.skipped += 1;
      summary.skipReasons[entry.reason] = (summary.skipReasons[entry.reason] || 0) + 1;
      if (summary.skipped >= maxSkips) {
        summary.stopped = "too_many_identity_skips";
        break;
      }
    }
  }
  return summary;
}

module.exports = {
  AUTO_REASONS,
  CREATE_PILOT_MAX,
  PILOT_MAX,
  PILOT_QUOTA,
  applyCustomer,
  createCustomer,
  readLogState,
  runApply,
  selectCreateTargets,
  selectTargets,
};
