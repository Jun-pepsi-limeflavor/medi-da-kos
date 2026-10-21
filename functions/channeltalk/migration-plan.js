/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * V2 기존 고객 이관 dry-run 판정 (순수 함수, 쓰기 없음).
 *
 * 규칙 원본: docs/plans/2026-10-19-channeltalk-v2.md 2~5장, V1 설계 1·4·5장.
 * 입력은 미리 읽어 둔 스냅샷뿐이다. 이 모듈은 Firestore·Channel API를 직접 부르지 않는다.
 * - 매칭 먼저, 생성은 마지막. 불확실하면 review.
 * - 기존 프로필은 빈 칸만(profileOnce). 기존 회원 PUT, 자동 병합 없음.
 * - OFF 기간 보류 건(pendingReason: intake_disabled)은 보호 대상이다. V1 기록은 읽기만 한다.
 * - 자동 관리 필드(orderCount 등)는 이관 범위가 정해지지 않아 계획에 넣지 않는다.
 */
const { isAllowedTestEmail, normalizeEmail } = require("./email");
const { isEmailCompatible, resolveChannelUser } = require("./identity");
const { buildProfileUpdate } = require("./profile");
const { isHeldBeforeActivation, syncDocId } = require("./sync-state");

const SOURCES = ["users", "contact", "landingRequests", "orders"];
// 회원 본인이 입력한 users 값이 폼 값보다 우선하는 필드.
const MEMBER_FIRST_FIELDS = new Set(["name", "brandCompanyName", "mobileNumber", "marketCountry"]);
// 가장 이른 제출 값을 쓰는 필드. 원천끼리 달라도 충돌로 보지 않는다.
const EARLIEST_FIELDS = new Set(["firstSource"]);
// 다시 태그·검토하지 않는 중복 쌍 상태(V1 5장).
const SETTLED_PAIR_STATES = new Set(["dismissed", "unified"]);

class NotFetched extends Error {}

function toSet(list) {
  return new Set(Array.isArray(list) ? list : []);
}

function toMs(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? Infinity : ms;
  }
  return Infinity;
}

function sortedUnique(list) {
  return [...new Set(list)].sort();
}

function byRecordOrder(a, b) {
  return toMs(a.data.createdAt) - toMs(b.data.createdAt) || a.id.localeCompare(b.id);
}

/** 원천 문서에서 uid와 이메일을 뽑는다. orders는 이메일이 없어 users 문서에서 가져온다. */
function identityOf(record, usersByUid) {
  const data = record.data || {};
  if (record.source === "users") return { uid: record.docId, email: normalizeEmail(data.email) };
  if (record.source === "orders") {
    const uid = typeof data.uid === "string" && data.uid ? data.uid : null;
    const user = uid ? usersByUid.get(uid) : null;
    return { uid, email: user ? normalizeEmail(user.email) : "", missingUser: Boolean(uid && !user) };
  }
  const uid = record.source === "contact" && typeof data.uid === "string" && data.uid ? data.uid : null;
  return { uid, email: normalizeEmail(data.email) };
}

/** 정책 문서 2장 순서. 보호 → 정확한 문서 id → isTest → 테스트 이메일. */
function exclusionOf(record, ctx) {
  if (ctx.protectedIds.has(record.id) || record.held) return null;
  if (ctx.testFirestoreIds.has(record.id)) return "v1_test_id";
  if (record.data && record.data.isTest === true) return "is_test";
  if (record.email && (ctx.testEmails.has(record.email) || isAllowedTestEmail(record.email, ctx.testDomain))) {
    return "v1_test_email";
  }
  return null;
}

/** uid·이메일 노드를 묶어 같은 고객 후보끼리 모은다(union-find). */
function groupRecords(records) {
  const parent = new Map();
  const find = (node) => {
    if (!parent.has(node)) parent.set(node, node);
    let root = node;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(node, root);
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };
  for (const record of records) {
    const nodes = [];
    if (record.uid) nodes.push(`uid:${record.uid}`);
    if (record.email) nodes.push(`email:${record.email}`);
    nodes.forEach((node) => find(node));
    if (nodes.length === 2) union(nodes[0], nodes[1]);
  }
  const groups = new Map();
  for (const record of records) {
    const root = find(record.uid ? `uid:${record.uid}` : `email:${record.email}`);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(record);
  }
  return groups;
}

function createResolver(channelUsers) {
  const getUser = async (id) => {
    if (!Object.prototype.hasOwnProperty.call(channelUsers, id)) throw new NotFetched(id);
    return channelUsers[id];
  };
  return async (id) => {
    try {
      return await resolveChannelUser(getUser, id);
    } catch (error) {
      if (error instanceof NotFetched) return { kind: "not_fetched", id };
      throw error;
    }
  };
}

/**
 * Channel id 하나를 최종 고객까지 따라가 후보로 넣거나 검토 사유를 남긴다.
 * @returns {Promise<string|null>} 살아 있는 최종 고객 id
 */
async function addCandidate(id, email, via, state, ctx) {
  const review = (code) => {
    state.reviews.push(code);
    return null;
  };
  const testId = ctx.testChannelIds.has(id);
  const unverified = ctx.unverifiedDeletedIds.has(id);
  const result = await ctx.resolve(id);
  if (result.kind === "not_fetched") return review("channel_not_fetched");
  if (result.kind === "missing") {
    if (testId || unverified) state.notes.push("test_channel_id_404_expected");
    else state.reviews.push("unexpected_404");
    return null;
  }
  if (unverified) return review("deleted_id_unverified_alive");
  if (testId) return review("test_channel_id");
  if (result.kind === "unresolved" || result.kind === "unified_missing") return review("unified_unresolved");
  const finalId = result.kind === "unified" ? result.canonicalId : id;
  const user = result.kind === "unified" ? result.canonical : result.user;
  if (ctx.testChannelIds.has(finalId)) return review("test_channel_id");
  if (email && !isEmailCompatible(user, email)) {
    return review(result.kind === "unified" ? "unified_other_email" : "mapping_email_mismatch");
  }
  if (result.kind === "unified") state.notes.push("unified_resolved");
  if (!state.finals.has(finalId)) state.finals.set(finalId, { user, via: new Set() });
  state.finals.get(finalId).via.add(via);
  return finalId;
}

/** 원천별 profileOnce 후보를 필드별로 합친다. 값이 갈리면 그 필드는 쓰지 않는다. */
function planProfile(records, existingProfile, usersByUid) {
  const candidates = new Map();
  const alreadySet = new Set();
  for (const record of [...records].sort(byRecordOrder)) {
    const { profileOnce, result } = buildProfileUpdate({
      kind: record.source,
      data: record.data,
      uid: record.uid,
      user: record.source === "orders" && record.uid ? usersByUid.get(record.uid) : undefined,
      existingProfile,
    });
    for (const [field, value] of Object.entries(profileOnce)) {
      if (!candidates.has(field)) candidates.set(field, []);
      candidates.get(field).push({ value, source: record.source });
    }
    for (const [field, reason] of Object.entries(result.skipped)) {
      if (reason === "already_set") alreadySet.add(field);
    }
  }

  const profileOnce = {};
  const fields = {};
  for (const field of alreadySet) fields[field] = "already_set";
  for (const field of [...candidates.keys()].sort()) {
    let list = candidates.get(field);
    if (EARLIEST_FIELDS.has(field)) list = [list[0]];
    else if (MEMBER_FIRST_FIELDS.has(field) && list.some((item) => item.source === "users")) {
      list = list.filter((item) => item.source === "users");
    }
    const distinct = new Set(list.map((item) => JSON.stringify(item.value)));
    if (distinct.size > 1) {
      fields[field] = "field_conflict";
      continue;
    }
    profileOnce[field] = list[0].value;
    fields[field] = "apply";
  }
  return { profileOnce, fields: Object.fromEntries(Object.entries(fields).sort()) };
}

async function planCustomer(key, group, ctx) {
  const uids = sortedUnique(group.map((r) => r.uid).filter(Boolean));
  const emails = sortedUnique(group.map((r) => r.email).filter(Boolean));
  const state = { reviews: [], notes: [], finals: new Map() };
  const uid = uids[0] || null;
  const email = emails[0] || "";

  if (uids.length > 1) state.reviews.push("same_email_diff_uid");
  if (emails.length > 1) state.reviews.push("uid_multiple_emails");
  if (group.some((r) => r.missingUser)) state.reviews.push("order_without_user");
  if (group.some((r) => r.sync && (r.sync.possibleOrphanLead || r.sync.possibleOrphanChat))) {
    state.reviews.push("orphan_flag");
  }

  let member = null;
  if (uid && uids.length === 1) {
    const found = Object.prototype.hasOwnProperty.call(ctx.membersByUid, uid) ? ctx.membersByUid[uid] : undefined;
    if (found === undefined) state.reviews.push("member_not_fetched");
    else if (found && found.type === "unified") state.reviews.push("member_unified");
    else if (found) {
      member = found;
      state.finals.set(found.id, { user: found, via: new Set(["uid"]) });
    }
  }

  const mapping = email ? ctx.mappings[email] : null;
  let mappingFinal = null;
  if (mapping && emails.length === 1) {
    if (mapping.uid && uid && mapping.uid !== uid) state.reviews.push("mapping_uid_mismatch");
    if (mapping.channelUserId) mappingFinal = await addCandidate(mapping.channelUserId, email, "mapping", state, ctx);
  }
  if (email && emails.length === 1) {
    for (const id of sortedUnique(ctx.idsByEmail[email] || [])) await addCandidate(id, email, "email", state, ctx);
  }

  const finals = [...state.finals.keys()].sort();
  let decision;
  let reason;
  let channelUserId = null;
  let dupCandidates = [];

  if (state.reviews.length > 0) {
    decision = "review";
  } else if (uid) {
    const others = finals.filter((id) => !member || id !== member.id);
    const hasLead = others.some((id) => state.finals.get(id).user.member !== true);
    if (others.length > 0) {
      decision = "review";
      state.reviews.push(hasLead ? "member_lead_same_email" : "multi_live_channel_users");
    } else if (member) {
      [decision, reason, channelUserId] = ["link", "uid_member", member.id];
    } else {
      [decision, reason] = ["create_candidate", "member_404"];
    }
  } else if (finals.length === 0) {
    [decision, reason] = ["create_candidate", "no_channel_match"];
  } else if (finals.length === 1) {
    [decision, reason, channelUserId] = ["link", mappingFinal ? "v1_mapping" : "email_unique", finals[0]];
  } else if (mappingFinal) {
    [decision, reason, channelUserId] = ["link", "v1_mapping", mappingFinal];
    const pairs = (mapping && mapping.dupPairs) || {};
    dupCandidates = finals.filter((id) => {
      if (id === mappingFinal) return false;
      const pair = pairs[[id, mappingFinal].sort().join("_")];
      return !(pair && SETTLED_PAIR_STATES.has(pair.state));
    });
    if (dupCandidates.length > 0) state.notes.push("dup_candidate");
  } else {
    decision = "review";
    state.reviews.push("multi_live_channel_users");
  }

  const held = group.some((r) => r.held);
  if (held) state.notes.push(decision === "create_candidate" ? "held_no_match" : "held");

  const target = channelUserId ? state.finals.get(channelUserId).user : null;
  const profile = decision === "link" || decision === "create_candidate"
    ? planProfile(group, target ? target.profile || {} : {}, ctx.usersByUid)
    : null;

  return {
    key,
    uid,
    email: email || null,
    decision,
    reasons: sortedUnique(reason ? [reason, ...state.reviews] : state.reviews),
    notes: sortedUnique(state.notes),
    channelUserId,
    dupCandidates,
    held,
    records: group.map((r) => r.id).sort(),
    profile,
  };
}

/**
 * @param {object} input
 * @param {{source: string, docId: string, data: object}[]} input.records  users·contact·landingRequests·orders 문서
 * @param {{id: string, emails?: string[]}[]} [input.buyers]
 * @param {Object<string, object>} [input.mappings]   정규화 이메일 → channelTalkIdentities 문서
 * @param {Object<string, object>} [input.syncDocs]   `{source}_{docId}` → channelTalkSync 문서
 * @param {object} [input.channel]
 * @param {Object<string, object|null>} [input.channel.users]        Channel id → GET 결과(null = 404). 없는 키 = 조회 안 함
 * @param {Object<string, object|null>} [input.channel.membersByUid] uid → GET @uid 결과(null = 404)
 * @param {Object<string, string[]>} [input.channel.idsByEmail]      정규화 이메일 → Channel 고객 id(목록·내보내기)
 * @param {object} [input.exclusion]  비공개 제외 목록을 이 모양으로 바꿔 넘긴다
 * @param {string[]} [input.exclusion.protectedIds]       `{source}_{docId}`
 * @param {string[]} [input.exclusion.firestoreIds]       `{source}_{docId}`
 * @param {string[]} [input.exclusion.emails]
 * @param {string[]} [input.exclusion.channelUserIds]
 * @param {string[]} [input.exclusion.unverifiedDeletedUserIds]
 * @param {{testDomain: string}} input.config
 */
async function planMigration(input) {
  const channel = input.channel || {};
  const exclusion = input.exclusion || {};
  const syncDocs = input.syncDocs || {};
  const ctx = {
    protectedIds: toSet(exclusion.protectedIds),
    testFirestoreIds: toSet(exclusion.firestoreIds),
    testEmails: new Set((exclusion.emails || []).map(normalizeEmail).filter(Boolean)),
    testChannelIds: toSet(exclusion.channelUserIds),
    unverifiedDeletedIds: toSet(exclusion.unverifiedDeletedUserIds),
    testDomain: input.config.testDomain,
    mappings: input.mappings || {},
    membersByUid: channel.membersByUid || {},
    idsByEmail: channel.idsByEmail || {},
    resolve: createResolver(channel.users || {}),
    usersByUid: new Map(),
  };

  const raw = (input.records || [])
    .filter((r) => SOURCES.includes(r.source))
    .map((r) => ({ ...r, data: r.data || {}, id: syncDocId(r.source, r.docId) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const r of raw) if (r.source === "users") ctx.usersByUid.set(r.docId, r.data);

  const recordResults = [];
  const included = [];
  for (const r of raw) {
    const sync = syncDocs[r.id] || null;
    const record = { ...r, sync, held: isHeldBeforeActivation(sync), ...identityOf(r, ctx.usersByUid) };
    const skip = exclusionOf(record, ctx) || (!record.uid && !record.email ? "invalid_email" : null);
    if (skip) recordResults.push({ id: r.id, decision: "skip", reason: skip, customerKey: null });
    else included.push(record);
  }

  const customers = [];
  for (const [key, group] of groupRecords(included)) customers.push(await planCustomer(key, group, ctx));
  customers.sort((a, b) => a.key.localeCompare(b.key));
  for (const customer of customers) {
    for (const id of customer.records) {
      recordResults.push({ id, decision: customer.decision, reason: customer.reasons[0] || null, customerKey: customer.key });
    }
  }
  recordResults.sort((a, b) => a.id.localeCompare(b.id));

  const knownEmails = new Set(customers.map((c) => c.email).filter(Boolean));
  const buyers = (input.buyers || [])
    .filter((b) => !(b.emails || []).map(normalizeEmail).some((e) => knownEmails.has(e)))
    .map((b) => ({ buyerId: b.id, decision: "review", reason: "buyer_only" }))
    .sort((a, b) => a.buyerId.localeCompare(b.buyerId));

  const summary = { customers: {}, records: {}, buyersOnly: buyers.length };
  for (const c of customers) summary.customers[c.decision] = (summary.customers[c.decision] || 0) + 1;
  for (const r of recordResults) {
    const label = r.decision === "skip" ? `skip:${r.reason}` : r.decision;
    summary.records[label] = (summary.records[label] || 0) + 1;
  }

  return { customers, records: recordResults, buyers, summary };
}

module.exports = {
  planMigration,
};
