/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 고객 식별 경로, 중복 후보 판정, 태그 병합 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 1장·5장.
 * 회원 여부는 Channel의 `member` 값과 우리 uid로만 판단한다 — Web SDK 익명 사용자도
 * 자동 UUID memberId를 갖기 때문에 memberId 존재 여부는 근거가 되지 않는다.
 */
const { normalizeEmail } = require("./email");

const DUP_TAG = "dup-candidate";
const MAX_TAGS = 20;

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
 * - dismissed / tag_limit(추가를 포기한 쌍): none
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

module.exports = {
  DUP_TAG,
  MAX_TAGS,
  decideIdentity,
  dupPairKey,
  evaluateDupPair,
  mergeTags,
};
