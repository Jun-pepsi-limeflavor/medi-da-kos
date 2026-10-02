/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  DUP_TAG,
  decideIdentity,
  dupPairKey,
  evaluateDupPair,
  mergeTags,
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
