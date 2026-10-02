/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 고객 식별 경로, 중복 후보 판정, 태그 병합 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 1장·5장.
 * 회원 여부는 Channel의 `member` 값과 우리 uid로만 판단한다 — Web SDK 익명 사용자도
 * 자동 UUID memberId를 갖기 때문에 memberId 존재 여부는 근거가 되지 않는다.
 *
 * Channel은 같은 브라우저의 리드를 회원 boot 때 회원에 자동 통합한다(T4·X12). 이메일이 달라도 합치고,
 * 옛 고객은 `type: "unified"` + `unifiedId`로 남는다. 통합 사실은 기록하되, 최종 고객의 이메일이
 * 비어 있거나 같을 때만 그 고객을 이 이메일의 고객으로 쓴다(isEmailCompatible).
 */
const { normalizeEmail } = require("./email");

const DUP_TAG = "dup-candidate";
const MAX_TAGS = 20;
// unifiedId를 따라가는 최대 단계. 넘거나 순환하면 unresolved.
const MAX_UNIFIED_HOPS = 3;

/**
 * @param {object} input
 * @param {string|null} input.uid          제출 문서의 Firebase uid(로그인 회원)
 * @param {string} input.email             폼 이메일
 * @param {{id: string, email?: string|null}|null} input.browserUser
 *        제출 브라우저의 Channel 사용자. 서버가 Channel API로 다시 조회한 값이어야 한다.
 * @param {{channelUserId?: string|null, memberId?: string|null}|null} input.mapping
 *        channelTalkIdentities 문서
 */
function decideIdentity({ uid, email, browserUser, mapping }) {
  const formEmail = normalizeEmail(email);

  if (typeof uid === "string" && uid) {
    return { source: "member", memberId: uid, channelUserId: null, fillEmail: false, browserMismatch: false };
  }

  let browserMismatch = false;
  if (browserUser && typeof browserUser.id === "string" && browserUser.id) {
    const browserEmail = normalizeEmail(browserUser.email || "");
    if (!browserEmail || browserEmail === formEmail) {
      return {
        source: "browser",
        memberId: null,
        channelUserId: browserUser.id,
        fillEmail: !browserEmail && Boolean(formEmail),
        browserMismatch: false,
      };
    }
    // 다른 사람일 수 있다. 브라우저 고객의 이메일은 덮어쓰지 않고 폼 이메일로 찾는다.
    browserMismatch = true;
  }

  if (!formEmail) {
    return { source: null, reason: "no_email", memberId: null, channelUserId: null, fillEmail: false, browserMismatch };
  }

  if (mapping && (mapping.channelUserId || mapping.memberId)) {
    return {
      source: "email_mapping",
      memberId: mapping.memberId || null,
      channelUserId: mapping.channelUserId || null,
      fillEmail: false,
      browserMismatch,
    };
  }

  return { source: "server_lead", memberId: null, channelUserId: null, fillEmail: false, browserMismatch };
}

function userEmail(user) {
  return normalizeEmail((user && ((user.profile && user.profile.email) || user.email)) || "");
}

/** 최종 고객의 이메일이 비어 있거나 email과 같을 때만 true. */
function isEmailCompatible(user, email) {
  const own = userEmail(user);
  return !own || own === normalizeEmail(email);
}

/**
 * Channel 고객 id를 살아 있는 고객까지 따라간다.
 * @param {(id: string) => Promise<object|null>} getUser
 * @param {object} [options.initial] 이미 조회한 id의 고객(다시 조회하지 않는다)
 * @returns {Promise<
 *   {kind: "live", id, user} | {kind: "missing", id} | {kind: "unified", id, canonicalId, canonical} |
 *   {kind: "unified_missing", id, canonicalId} | {kind: "unresolved", id}
 * >}
 *   unified_missing: 통합 대상이 실제 404. unresolved: unifiedId 없음·순환·단계 초과.
 */
async function resolveChannelUser(getUser, id, { initial, maxHops = MAX_UNIFIED_HOPS } = {}) {
  const first = initial === undefined ? await getUser(id) : initial;
  if (!first) return { kind: "missing", id };
  if (first.type !== "unified") return { kind: "live", id, user: first };
  const seen = [id];
  let current = first;
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next = current.unifiedId;
    if (typeof next !== "string" || !next || seen.includes(next)) return { kind: "unresolved", id };
    seen.push(next);
    const user = await getUser(next);
    if (!user) return { kind: "unified_missing", id, canonicalId: next };
    if (user.type !== "unified") return { kind: "unified", id, canonicalId: next, canonical: user };
    current = user;
  }
  return { kind: "unresolved", id };
}

function dupPairKey(a, b) {
  return [a, b].sort().join("_");
}

function hasTag(tags, tag) {
  return (Array.isArray(tags) ? tags : []).some(
    (value) => typeof value === "string" && value.toLowerCase() === tag,
  );
}

/**
 * 같은 이메일의 두 Channel 고객에 대해 무엇을 할지 정한다.
 * - 처음 발견: tag
 * - 우리가 붙였는데 한쪽에서 사라짐: 담당자가 지운 것 → mark_dismissed(다시 붙이지 않음)
 * - dismissed / tag_limit(추가를 포기한 쌍) / unified(Channel이 이미 한 고객으로 통합): none
 */
function evaluateDupPair(pairState, currentTags) {
  const state = pairState && pairState.state;
  if (!state) return { action: "tag" };
  if (state === "tagged") {
    const removed = Object.values(currentTags || {}).some((tags) => !hasTag(tags, DUP_TAG));
    return { action: removed ? "mark_dismissed" : "none" };
  }
  return { action: "none" };
}

/**
 * Channel 태그 PATCH는 전체 교체다. 최신 태그에 하나를 더한 목록을 만든다.
 * Channel은 태그를 소문자로 저장하므로 대소문자 무시로 중복을 본다.
 */
function mergeTags(currentTags, tag, limit = MAX_TAGS) {
  const tags = (Array.isArray(currentTags) ? currentTags : []).filter((value) => typeof value === "string");
  const wanted = String(tag).toLowerCase();
  if (hasTag(tags, wanted)) return { tags, changed: false, reason: "already" };
  if (tags.length >= limit) return { tags, changed: false, reason: "limit" };
  return { tags: [...tags, wanted], changed: true, reason: "added" };
}

function unique(ids) {
  return [...new Set((ids || []).filter((id) => typeof id === "string" && id))];
}

/**
 * 통합된 대표를 최종 고객으로 바꾼다. 최종 고객이 이번에 살아 있고 이 이메일과 맞는다고 확인된
 * 고객(live: id → origin)일 때만 바꾸고, 아니면 그대로 둔다(다음 식별이 새 고객으로 바꾼다).
 */
function canonicalizePrimary({ primary, origin }, { unified, live }) {
  const canonical = primary ? unified[primary] : null;
  if (canonical && canonical in live) return { primary: canonical, origin: live[canonical] };
  return { primary, origin };
}

function mappingIdsAfter(data, { primary, unified, missing, live }) {
  const others = new Set(data.otherChannelUserIds || []);
  Object.keys(live).forEach((id) => others.add(id));
  others.delete(primary);
  Object.keys(unified).forEach((id) => others.delete(id));
  missing.forEach((id) => others.delete(id));
  return [...others];
}

function mergeUnified(previous, additions, live) {
  const next = { ...(previous || {}) };
  for (const [from, to] of Object.entries(additions || {})) {
    if (from && typeof to === "string" && to && from !== to) next[from] = to;
  }
  // 살아 있다고 확인된 고객은 통합 기록보다 우선한다.
  Object.keys(live).forEach((id) => delete next[id]);
  return next;
}

/**
 * 식별 결과를 반영한 매핑 필드(순수 함수). store.recordIdentity가 트랜잭션 안에서 쓴다.
 * - 대표가 없거나, missingIds에 있거나, 통합된 id면 이번 고객으로 바꾼다.
 * - missingIds: 실제 404로 확인된 id. unified: { 옛 id: 최종 고객 id }.
 * - 우리 uid로 식별한 회원일 때만 uid·memberId를 쓴다(처음 한 번).
 * @param {object|null} data 지금 매핑 문서(없으면 null)
 */
function applyIdentityRecord(data, { channelUserId, origin, uid = null, missingIds = [], unified = {} }) {
  const missing = unique(missingIds).filter((id) => id !== channelUserId);
  const live = { [channelUserId]: origin };
  const nextUnified = mergeUnified(data && data.unifiedChannelUserIds, unified, live);
  if (!data) {
    return {
      channelUserId,
      channelUserOrigin: origin,
      uid: uid || null,
      memberId: uid || null,
      otherChannelUserIds: [],
      missingChannelUserIds: missing,
      unifiedChannelUserIds: nextUnified,
    };
  }
  const current = { primary: data.channelUserId || null, origin: data.channelUserOrigin || null };
  const replace = !current.primary || missing.includes(current.primary) || current.primary in nextUnified;
  const { primary, origin: primaryOrigin } = replace ? { primary: channelUserId, origin } : current;
  const fields = {
    channelUserId: primary,
    channelUserOrigin: primaryOrigin,
    otherChannelUserIds: mappingIdsAfter(data, { primary, unified: nextUnified, missing, live }),
    missingChannelUserIds: unique([...(data.missingChannelUserIds || []), ...missing]),
    unifiedChannelUserIds: nextUnified,
  };
  if (uid && !data.uid) Object.assign(fields, { uid, memberId: uid });
  return fields;
}

/**
 * 중복 판정 중 확인한 통합·사라짐을 반영한 매핑 필드(순수 함수). store.recordUnified가 쓴다.
 * @param {object} input.live 살아 있고 이 이메일과 맞는 고객 { id: origin }. 대표 교체 후보이자 otherChannelUserIds에 남긴다
 */
function applyUnifiedRecord(data, { unified = {}, missingIds = [], live = {} }) {
  const missing = unique(missingIds).filter((id) => !(id in live));
  const nextUnified = mergeUnified(data.unifiedChannelUserIds, unified, live);
  const { primary, origin } = canonicalizePrimary(
    { primary: data.channelUserId || null, origin: data.channelUserOrigin || null },
    { unified: nextUnified, live },
  );
  return {
    channelUserId: primary,
    channelUserOrigin: origin,
    otherChannelUserIds: mappingIdsAfter(data, { primary, unified: nextUnified, missing, live }),
    missingChannelUserIds: unique([...(data.missingChannelUserIds || []), ...missing]),
    unifiedChannelUserIds: nextUnified,
  };
}

module.exports = {
  DUP_TAG,
  MAX_TAGS,
  MAX_UNIFIED_HOPS,
  applyIdentityRecord,
  applyUnifiedRecord,
  canonicalizePrimary,
  decideIdentity,
  dupPairKey,
  evaluateDupPair,
  isEmailCompatible,
  mergeTags,
  resolveChannelUser,
  userEmail,
};
