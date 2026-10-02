/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  DUP_TAG,
  applyIdentityRecord,
  applyUnifiedRecord,
  canonicalizePrimary,
  decideIdentity,
  dupPairKey,
  evaluateDupPair,
  isEmailCompatible,
  mergeTags,
  resolveChannelUser,
} = require("../channeltalk/identity");

const email = "buyer@example.com";

test("로그인 회원은 uid로 식별한다", () => {
  const result = decideIdentity({ uid: "uid-1", email, browserUser: { id: "ch-1", email: "other@example.com" }, mapping: null });
  assert.equal(result.source, "member");
  assert.equal(result.memberId, "uid-1");
});

test("브라우저 고객 이메일이 비어 있으면 그 고객을 쓰고 이메일을 채운다", () => {
  const result = decideIdentity({ uid: null, email, browserUser: { id: "ch-1", email: null }, mapping: null });
  assert.deepEqual(result, { source: "browser", memberId: null, channelUserId: "ch-1", fillEmail: true, browserMismatch: false });
});

test("브라우저 고객 이메일이 폼 이메일과 같으면(대소문자 무시) 그 고객을 쓴다", () => {
  const result = decideIdentity({ uid: null, email: "Buyer@Example.com", browserUser: { id: "ch-1", email: "buyer@example.com" }, mapping: null });
  assert.equal(result.source, "browser");
  assert.equal(result.fillEmail, false);
});

test("브라우저 고객에 다른 이메일이 있으면 덮어쓰지 않고 매핑으로 찾는다", () => {
  const result = decideIdentity({
    uid: null,
    email,
    browserUser: { id: "ch-1", email: "someone-else@example.com" },
    mapping: { channelUserId: "ch-9" },
  });
  assert.equal(result.source, "email_mapping");
  assert.equal(result.channelUserId, "ch-9");
  assert.equal(result.fillEmail, false);
  assert.equal(result.browserMismatch, true);
});

test("브라우저 고객이 다른 이메일이고 매핑도 없으면 서버 리드", () => {
  const result = decideIdentity({ uid: null, email, browserUser: { id: "ch-1", email: "someone-else@example.com" }, mapping: null });
  assert.equal(result.source, "server_lead");
  assert.equal(result.channelUserId, null);
  assert.equal(result.browserMismatch, true);
});

test("브라우저 id가 없으면 매핑, 매핑도 없으면 서버 리드", () => {
  assert.equal(decideIdentity({ uid: null, email, browserUser: null, mapping: { channelUserId: "ch-9" } }).source, "email_mapping");
  assert.equal(decideIdentity({ uid: null, email, browserUser: null, mapping: null }).source, "server_lead");
  assert.equal(decideIdentity({ uid: null, email, browserUser: { id: "" }, mapping: null }).source, "server_lead");
});

test("매핑이 회원이면 memberId를 함께 돌려준다", () => {
  const result = decideIdentity({ uid: null, email, browserUser: null, mapping: { channelUserId: "ch-9", memberId: "uid-9" } });
  assert.equal(result.memberId, "uid-9");
});

test("Channel 자동 UUID memberId만 있는 매핑은 회원으로 보지 않는다(memberId가 null인 매핑 그대로)", () => {
  // 우리는 자동 UUID를 저장하지 않으므로 매핑의 memberId는 회원일 때만 값이 있다.
  const result = decideIdentity({ uid: null, email, browserUser: null, mapping: { channelUserId: "ch-9", memberId: null } });
  assert.equal(result.source, "email_mapping");
  assert.equal(result.memberId, null);
});

test("이메일도 uid도 없으면 식별하지 않는다", () => {
  const result = decideIdentity({ uid: null, email: "", browserUser: null, mapping: null });
  assert.equal(result.source, null);
  assert.equal(result.reason, "no_email");
});

test("중복 쌍 키는 순서와 무관하다", () => {
  assert.equal(dupPairKey("b", "a"), "a_b");
  assert.equal(dupPairKey("a", "b"), "a_b");
});

test("중복 쌍: 처음이면 태그, 담당자가 지웠으면 dismissed 처리, 이후 다시 붙이지 않음", () => {
  assert.deepEqual(evaluateDupPair(undefined, {}), { action: "tag" });
  assert.deepEqual(
    evaluateDupPair({ state: "tagged" }, { a: [DUP_TAG, "vip"], b: [DUP_TAG] }),
    { action: "none" },
  );
  assert.deepEqual(
    evaluateDupPair({ state: "tagged" }, { a: ["vip"], b: [DUP_TAG] }),
    { action: "mark_dismissed" },
  );
  assert.deepEqual(evaluateDupPair({ state: "dismissed" }, { a: [], b: [] }), { action: "none" });
  assert.deepEqual(evaluateDupPair({ state: "tag_limit" }, { a: [], b: [] }), { action: "none" });
});

test("태그 병합: 담당자 태그를 유지하고 하나만 더한다", () => {
  assert.deepEqual(mergeTags(["vip", "응대중"], DUP_TAG), { tags: ["vip", "응대중", DUP_TAG], changed: true, reason: "added" });
  assert.deepEqual(mergeTags(null, DUP_TAG), { tags: [DUP_TAG], changed: true, reason: "added" });
});

test("태그 병합: 이미 있으면(대소문자 무시) 바꾸지 않는다", () => {
  const result = mergeTags(["Dup-Candidate"], DUP_TAG);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "already");
});

test("태그 병합: 20개면 기존 태그를 지우지 않고 추가를 포기한다", () => {
  const tags = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const result = mergeTags(tags, DUP_TAG);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "limit");
  assert.deepEqual(result.tags, tags);
});

function usersApi(users) {
  const reads = [];
  return {
    reads,
    getUser: async (id) => {
      reads.push(id);
      return users[id] ? { id, ...users[id] } : null;
    },
  };
}

test("고객 따라가기: live·missing·unified 1·2단계·끝이 404·unifiedId 없음·순환·단계 초과", async () => {
  const { getUser } = usersApi({
    live: { type: "member" },
    a: { type: "unified", unifiedId: "live" },
    b: { type: "unified", unifiedId: "a" },
    toGone: { type: "unified", unifiedId: "gone" },
    noTarget: { type: "unified" },
    loop1: { type: "unified", unifiedId: "loop2" },
    loop2: { type: "unified", unifiedId: "loop1" },
    h1: { type: "unified", unifiedId: "h2" },
    h2: { type: "unified", unifiedId: "h3" },
    h3: { type: "unified", unifiedId: "h4" },
    h4: { type: "unified", unifiedId: "live" },
  });
  assert.equal((await resolveChannelUser(getUser, "live")).kind, "live");
  assert.deepEqual(await resolveChannelUser(getUser, "nope"), { kind: "missing", id: "nope" });
  const one = await resolveChannelUser(getUser, "a");
  assert.deepEqual([one.kind, one.canonicalId, one.canonical.id], ["unified", "live", "live"]);
  const two = await resolveChannelUser(getUser, "b");
  assert.deepEqual([two.kind, two.canonicalId], ["unified", "live"]);
  assert.deepEqual(await resolveChannelUser(getUser, "toGone"), { kind: "unified_missing", id: "toGone", canonicalId: "gone" });
  assert.equal((await resolveChannelUser(getUser, "noTarget")).kind, "unresolved");
  assert.equal((await resolveChannelUser(getUser, "loop1")).kind, "unresolved");
  assert.equal((await resolveChannelUser(getUser, "h1")).kind, "unresolved"); // 4단계
  const three = await resolveChannelUser(getUser, "h2"); // 3단계까지는 따라간다
  assert.deepEqual([three.kind, three.canonicalId], ["unified", "live"]);
});

test("고객 따라가기: 이미 조회한 고객을 넘기면 다시 조회하지 않는다", async () => {
  const api = usersApi({ m: { type: "member" } });
  const found = await resolveChannelUser(api.getUser, "x", { initial: { id: "x", type: "unified", unifiedId: "m" } });
  assert.equal(found.canonicalId, "m");
  assert.deepEqual(api.reads, ["m"]);
});

test("이메일 호환: 비어 있거나 같을 때만(대소문자 무시), profile.email 없으면 최상위 email", () => {
  assert.equal(isEmailCompatible({ profile: {} }, email), true);
  assert.equal(isEmailCompatible({ profile: { email: "BUYER@example.com" } }, email), true);
  assert.equal(isEmailCompatible({ profile: { email: "other@example.com" } }, email), false);
  assert.equal(isEmailCompatible({ email: "other@example.com" }, email), false);
  assert.equal(isEmailCompatible({ email: "buyer@example.com" }, email), true);
});

test("중복 쌍: unified면 다시 붙이지 않는다(기존 상태 판정은 그대로)", () => {
  assert.deepEqual(evaluateDupPair({ state: "unified" }, { a: [], b: [] }), { action: "none" });
  assert.deepEqual(evaluateDupPair({ state: "tagged" }, { a: ["vip"], b: [DUP_TAG] }), { action: "mark_dismissed" });
});

test("매핑 기록: 통합된 대표는 이번 고객으로 바꾸고, 통합 id는 others·missing과 섞지 않는다", () => {
  const data = { channelUserId: "L", channelUserOrigin: "browser", otherChannelUserIds: ["O"], missingChannelUserIds: [], unifiedChannelUserIds: {} };
  const fields = applyIdentityRecord(data, { channelUserId: "N", origin: "server_lead", unified: { L: "M" } });
  assert.equal(fields.channelUserId, "N");
  assert.equal(fields.channelUserOrigin, "server_lead");
  assert.deepEqual(fields.otherChannelUserIds, ["O"]);
  assert.deepEqual(fields.missingChannelUserIds, []);
  assert.deepEqual(fields.unifiedChannelUserIds, { L: "M" });
});

test("매핑 기록: unifiedChannelUserIds가 없던 문서도 처리하고, 살아 있다고 확인된 id의 통합 기록은 지운다", () => {
  const fields = applyIdentityRecord({ channelUserId: "P", otherChannelUserIds: [] }, { channelUserId: "X", origin: "browser" });
  assert.deepEqual(fields.unifiedChannelUserIds, {});
  const revived = applyIdentityRecord({ channelUserId: "P", otherChannelUserIds: [], unifiedChannelUserIds: { X: "Y" } }, { channelUserId: "X", origin: "browser" });
  assert.deepEqual(revived.unifiedChannelUserIds, {});
  assert.deepEqual(revived.otherChannelUserIds, ["X"]);
  assert.deepEqual(applyIdentityRecord(null, { channelUserId: "A", origin: "browser" }).unifiedChannelUserIds, {});
});

test("대표 정리: 대표의 최종 고객이 살아 있고 이메일이 맞는 고객일 때만 바꾼다", () => {
  assert.deepEqual(canonicalizePrimary({ primary: "L", origin: "browser" }, { unified: { L: "M" }, live: { M: "member" } }), { primary: "M", origin: "member" });
  assert.deepEqual(canonicalizePrimary({ primary: "L", origin: "browser" }, { unified: { L: "M" }, live: { N: "server_lead" } }), { primary: "L", origin: "browser" });
  assert.deepEqual(canonicalizePrimary({ primary: "P", origin: "browser" }, { unified: {}, live: { M: "member" } }), { primary: "P", origin: "browser" });
});

test("통합 기록: 다른 이메일 고객과의 관계는 기록만 하고 대표·others는 바꾸지 않으며 기존 관계는 유지", () => {
  const data = { channelUserId: "L", channelUserOrigin: "browser", otherChannelUserIds: ["O"], missingChannelUserIds: [], unifiedChannelUserIds: { Z: "Y" } };
  const fields = applyUnifiedRecord(data, { unified: { L: "B-member" }, live: { O: "browser" } });
  assert.equal(fields.channelUserId, "L");
  assert.deepEqual(fields.otherChannelUserIds, ["O"]);
  assert.deepEqual(fields.unifiedChannelUserIds, { Z: "Y", L: "B-member" });

  const same = applyUnifiedRecord(data, { unified: { L: "M" }, live: { M: "member" } });
  assert.equal(same.channelUserId, "M");
  assert.equal(same.channelUserOrigin, "member");
  assert.deepEqual(same.otherChannelUserIds, ["O"]);

  const gone = applyUnifiedRecord({ ...data, otherChannelUserIds: ["O", "M"] }, { unified: { L: "M" }, missingIds: ["M"], live: { O: "browser" } });
  assert.deepEqual(gone.missingChannelUserIds, ["M"]);
  assert.deepEqual(gone.otherChannelUserIds, ["O"]);
});
