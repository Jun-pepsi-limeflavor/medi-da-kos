/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { ChannelTalkApiError, createChannelTalkApi } = require("../channeltalk/api");
const {
  assertOutsideRepo,
  collectAndPlan,
  createReadOnlyReader,
  normalizeExclusion,
  parseDeskExport,
  readOnlyFetch,
  redactError,
} = require("../channeltalk/migration-collect");

// 모두 가상 데이터다.
const config = { testDomain: "techasset.co.kr" };

const exclusionRaw = {
  version: 9,
  exclude: {
    firestore: {
      contact: ["tc1"],
      landingRequests: ["tl1"],
      channelTalkSync: ["contact_tc1"],
      channelTalkIdentities: ["test%40mapping.test"],
    },
    channelTalk: {
      userIds: ["tch1"],
      memberIds: ["zz-test-member-a"],
      userStatus: { tch1: { status: "deleted_id_unverified" } },
    },
    emails: ["listed@buyer.test"],
  },
  protected: {
    heldPreActivation: ["contact_h1"],
    realAfterOn: ["contact/r1", "channelTalkSync/landingRequests_r2", "channelTalkIdentities/x%40y.test", "자유 메모"],
    bots: ["웹 접수 (bot)"],
  },
  review: [{ id: "note", reason: "manual" }],
};

function fakeDocs(collections) {
  const calls = [];
  const listDocs = async (name, options = {}) => {
    calls.push([name, options.prefix || null]);
    return (collections[name] || []).filter((d) => !options.prefix || d.id.startsWith(options.prefix));
  };
  return { listDocs, calls };
}

function fakeReader(users, members) {
  const calls = [];
  return {
    calls,
    stats: { requests: 0 },
    async getUser(id) {
      calls.push(["user", id]);
      return Object.prototype.hasOwnProperty.call(users, id) ? users[id] : null;
    },
    async getUserByMemberId(uid) {
      calls.push(["member", uid]);
      return Object.prototype.hasOwnProperty.call(members, uid) ? members[uid] : null;
    },
  };
}

test("비공개 제외 목록을 판정 입력 모양으로 바꾸고, 형식을 모르는 보호 항목은 세기만 한다", () => {
  const ex = normalizeExclusion(exclusionRaw);
  assert.equal(ex.version, 9);
  assert.deepEqual(ex.exclusion.firestoreIds, ["contact_tc1", "landingRequests_tl1"]);
  assert.deepEqual(ex.exclusion.protectedIds, ["contact_h1", "contact_r1", "landingRequests_r2"]);
  assert.deepEqual(ex.exclusion.unverifiedDeletedUserIds, ["tch1"]);
  assert.equal(ex.unrecognizedProtected, 2);
  assert.equal(ex.reviewEntries, 1);
  assert.ok(ex.mappingKeys.has("test%40mapping.test"));
  assert.ok(ex.testMemberIds.has("zz-test-member-a"));
});

test("Desk 내보내기 CSV를 이메일 → 고객 id 표로 바꾼다", () => {
  const csv = '﻿id,"Email",name\r\nch1,A@Buyer.test,"Kim, A"\nch2,a@buyer.test,B\nch3,,C\n';
  const parsed = parseDeskExport(csv, { idColumn: "id", emailColumn: "Email" });
  assert.deepEqual(parsed.index, { "a@buyer.test": ["ch1", "ch2"] });
  assert.equal(parsed.rows, 3);
  assert.equal(parsed.skipped, 1);
  assert.throws(() => parseDeskExport(csv, { idColumn: "id", emailColumn: "mail" }), /열을 찾지 못했습니다/);
});

test("읽기 전용 fetch는 GET 외 요청을 보내기 전에 막는다", async () => {
  const sent = [];
  const fetchImpl = readOnlyFetch(async (url, options) => {
    sent.push(options.method);
    return { ok: true, status: 200, text: async () => '{"user":{"id":"x"}}', headers: { get: () => null } };
  });
  const api = createChannelTalkApi({ accessKey: "k", accessSecret: "s", version: "2026-06-01", fetchImpl });
  assert.deepEqual(await api.getUser("x"), { id: "x" });
  await assert.rejects(api.patchUser("x", { profileOnce: {} }), /PATCH 요청을 막았습니다|network_error/);
  await assert.rejects(api.createLead({}), /network_error|막았습니다/);
  assert.deepEqual(sent, ["GET"]);
});

test("reader는 애매한 실패를 다시 시도하고, 재시도 소진·확실한 거부·요청 상한에서 멈춘다", async () => {
  const waits = [];
  const sleep = async (ms) => { waits.push(ms); };
  let n = 0;
  const flaky = {
    async getUser() {
      n += 1;
      if (n === 1) throw new ChannelTalkApiError("GET /open/users/x 429", { status: 429, code: "rate_limited", ambiguous: true, retryAfterSeconds: 3 });
      if (n === 2) throw new ChannelTalkApiError("GET /open/users/x 503", { status: 503, code: "server_error", ambiguous: true });
      return { id: "x" };
    },
  };
  const reader = createReadOnlyReader(flaky, { intervalMs: 0, sleep, backoffMs: 10 });
  assert.deepEqual(await reader.getUser("x"), { id: "x" });
  assert.deepEqual(waits, [3000, 20]);
  assert.equal(reader.stats.retries, 2);

  const alwaysBusy = { async getUser() { throw new ChannelTalkApiError("busy", { code: "server_error", ambiguous: true }); } };
  const giveUp = createReadOnlyReader(alwaysBusy, { intervalMs: 0, sleep, maxRetries: 2, backoffMs: 1 });
  await assert.rejects(giveUp.getUser("x"), /busy/);
  assert.equal(giveUp.stats.requests, 3);

  const rejected = { async getUser() { throw new ChannelTalkApiError("GET 401", { status: 401, code: "rejected" }); } };
  const stop = createReadOnlyReader(rejected, { intervalMs: 0, sleep });
  await assert.rejects(stop.getUser("x"), /401/);
  assert.equal(stop.stats.requests, 1);

  const capped = createReadOnlyReader({ async getUser() { return null; } }, { intervalMs: 0, sleep, maxRequests: 1 });
  assert.equal(await capped.getUser("a"), null);
  assert.equal(capped.stats.notFound, 1);
  await assert.rejects(capped.getUser("b"), /요청 상한/);
});

test("수집은 읽기만 하고, 제외 대상은 조회하지 않으며, 통합 고객을 따라가 판정한다", async () => {
  const { listDocs, calls: docCalls } = fakeDocs({
    users: [
      { id: "u1", data: { email: "m@buyer.test", createdAt: 1 } },
      { id: "zz-test-member-a", data: { email: "tm@buyer.test", createdAt: 1 } },
    ],
    contact: [
      { id: "c1", data: { email: "a@buyer.test", companyName: "A", createdAt: 2 } },
      { id: "tc1", data: { email: "t@buyer.test", createdAt: 2 } },
      { id: "h1", data: { email: "held@buyer.test", isTest: true, createdAt: 2 } },
      { id: "c2", data: { email: "desk@buyer.test", companyName: "New", createdAt: 2 } },
    ],
    landingRequests: [],
    orders: [{ id: "o1", data: { uid: "u1", createdAt: 3 } }],
    channelTalkSync: [{ id: "contact_h1", data: { pendingReason: "intake_disabled", heldReason: "pre_activation" } }],
    channelTalkIdentities: [
      { id: "a%40buyer.test", data: { email: "a@buyer.test", channelUserId: "old1" } },
      { id: "test%40mapping.test", data: { email: "held@buyer.test", channelUserId: "tch1" } },
    ],
    buyers: [{ id: "b1", data: { emails: ["mail-only@buyer.test"] } }],
    conversationIdentities: [{ id: "channeltalk:main:ing1", data: {} }, { id: "email:x@y.test", data: {} }],
  });
  const reader = fakeReader(
    {
      old1: { id: "old1", type: "unified", unifiedId: "m9", profile: {} },
      m9: { id: "m9", type: "member", member: true, profile: { email: "a@buyer.test" } },
      d1: { id: "d1", type: "lead", member: false, profile: { email: "desk@buyer.test", brandCompanyName: "Kept" } },
    },
    { u1: { id: "mu1", type: "member", member: true, profile: { email: "m@buyer.test" } } },
  );

  const { plan, meta } = await collectAndPlan({
    listDocs,
    reader,
    exclusionRaw,
    deskIndex: { "desk@buyer.test": ["d1"] },
    includeIngestIds: true,
    config,
  });

  assert.ok(docCalls.some(([name, prefix]) => name === "conversationIdentities" && prefix === "channeltalk:main:"));
  assert.ok(!reader.calls.some(([kind, id]) => kind === "member" && id.startsWith("zz-test-member-")));
  assert.ok(!reader.calls.some(([, id]) => id === "tch1"), "제외된 테스트 매핑의 id는 조회하지 않는다");
  assert.ok(reader.calls.some(([kind, id]) => kind === "user" && id === "m9"), "통합 대상까지 따라간다");
  assert.ok(reader.calls.some(([kind, id]) => kind === "user" && id === "ing1"));

  const byEmail = Object.fromEntries(plan.customers.map((c) => [c.email, c]));
  assert.equal(byEmail["a@buyer.test"].decision, "link");
  assert.equal(byEmail["a@buyer.test"].channelUserId, "m9");
  assert.equal(byEmail["m@buyer.test"].decision, "link");
  assert.deepEqual(byEmail["m@buyer.test"].reasons, ["uid_member"]);
  assert.equal(byEmail["desk@buyer.test"].channelUserId, "d1");
  assert.equal(byEmail["desk@buyer.test"].profile.fields.brandCompanyName, "already_set");
  assert.equal(byEmail["held@buyer.test"].held, true);
  assert.equal(byEmail["held@buyer.test"].decision, "create_candidate");
  assert.equal(byEmail["t@buyer.test"], undefined);
  assert.deepEqual(plan.buyers.map((b) => b.reason), ["buyer_only"]);

  assert.equal(meta.channelIndexComplete, true);
  assert.equal(meta.excludedMappings, 1);
  assert.equal(meta.counts.contact, 4);
});

test("Desk 내보내기가 없으면 색인이 불완전하다고 표시한다", async () => {
  const { listDocs } = fakeDocs({ contact: [{ id: "c1", data: { email: "n@buyer.test" } }] });
  const { plan, meta } = await collectAndPlan({ listDocs, reader: fakeReader({}, {}), exclusionRaw: {}, config });
  assert.equal(meta.channelIndexComplete, false);
  assert.equal(meta.channelIndexSource, "known_ids_only");
  assert.equal(plan.customers[0].decision, "create_candidate");
});

test("결과 경로는 저장소 밖이어야 하고, 오류 문구에서 Channel id를 지운다", () => {
  assert.throws(() => assertOutsideRepo("/repo/out", "/repo"), /저장소 안/);
  assert.throws(() => assertOutsideRepo("/repo", "/repo"), /저장소 안/);
  assert.doesNotThrow(() => assertOutsideRepo("/home/me/private/out", "/repo"));
  assert.equal(redactError(new Error("GET /open/users/abc123 429")), "GET /open/users/… 429");
  assert.equal(redactError(new Error("GET /open/users/@uid9 503")), "GET /open/users/… 503");
});

test("수집·실행 코드에 Firestore·Channel 쓰기 호출이 없다", () => {
  const read = (file) => readFileSync(path.join(__dirname, file), "utf8");
  const code = (source) => source.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
  const channelWrites = /\b(patchUser|upsertMember|createLead|createUserChat|sendPrivateNote|openUserChat)\b/;
  // 판정·수집 모듈은 Firestore를 직접 다루지 않는다(listDocs로 받은 값만 쓴다).
  for (const file of ["../channeltalk/migration-plan.js", "../channeltalk/migration-collect.js"]) {
    const source = code(read(file));
    assert.doesNotMatch(source, /firebase-admin|\.collection\(|\.doc\(/, file);
    assert.doesNotMatch(source, channelWrites, file);
  }
  // 실행 스크립트의 Firestore 호출은 get뿐이다.
  const runner = code(read("../scripts/channeltalk-migration-dry-run.mjs"));
  assert.doesNotMatch(runner, /\.(set|update|delete|create|add|batch|runTransaction|bulkWriter|recursiveDelete)\(/);
  assert.doesNotMatch(runner, channelWrites);
});

function threadFixture() {
  return {
    users: [{ id: "u1", data: { email: "m@buyer.test", createdAt: 1 } }],
    contact: [
      { id: "c1", data: { email: "lead@buyer.test", createdAt: 2 } },
      { id: "c2", data: { email: "none@buyer.test", createdAt: 2 } },
    ],
    landingRequests: [],
    orders: [],
    channelTalkSync: [],
    channelTalkIdentities: [],
    buyers: [],
    threads: [
      { id: "channeltalk:main:t1", data: { identityId: "email:LEAD@buyer.test", channelTalkUserId: "l1" } },
      { id: "channeltalk:main:t2", data: { identityId: "email:m@buyer.test", channelTalkUserId: "l2" } },
      { id: "channeltalk:main:t3", data: { identityId: "email:stranger@else.test", channelTalkUserId: "s1" } },
      { id: "channeltalk:main:t4", data: { identityId: "channeltalk:main:anon", channelTalkUserId: "anon" } },
      { id: "channeltalk:main:tt", data: { identityId: "email:lead@buyer.test", channelTalkUserId: "tch2" } },
      { id: "channeltalk:main:t5", data: { identityId: "email:lead@buyer.test", channelTalkUserId: "tdel" } },
    ],
  };
}

const threadExclusion = {
  exclude: {
    firestore: { threads: ["channeltalk:main:tt"] },
    channelTalk: { userIds: ["tdel"], userStatus: { tdel: { status: "deleted" } } },
  },
};

const threadUsers = {
  l1: { id: "l1", type: "lead", member: false, profile: { email: "lead@buyer.test" } },
  l2: { id: "l2", type: "lead", member: false, profile: { email: "m@buyer.test" } },
};
const threadMembers = { u1: { id: "mu1", type: "member", member: true, profile: { email: "m@buyer.test" } } };

test("스레드 기반 조회는 우리 고객 이메일과 같은 상담의 Channel id만, 테스트 스레드·삭제된 테스트 id 없이 조회한다", async () => {
  const { listDocs, calls: docCalls } = fakeDocs(threadFixture());
  const reader = fakeReader(threadUsers, threadMembers);
  const { plan, meta } = await collectAndPlan({ listDocs, reader, exclusionRaw: threadExclusion, includeThreadIds: true, config });

  assert.ok(docCalls.some(([name, prefix]) => name === "threads" && prefix === "channeltalk:"));
  assert.deepEqual(reader.calls.filter(([kind]) => kind === "user").map(([, id]) => id).sort(), ["l1", "l2"]);
  assert.deepEqual(meta.estimate.threads, { testSkipped: 1, matched: 3, otherEmail: 1, noEmail: 1 });
  assert.equal(meta.estimate.skippedKnownDeletedTestIds, 1);
  assert.equal(meta.estimate.expected, 3);

  const byEmail = Object.fromEntries(plan.customers.map((c) => [c.email, c]));
  assert.equal(byEmail["lead@buyer.test"].decision, "link");
  assert.deepEqual(byEmail["lead@buyer.test"].reasons, ["email_unique"]);
  assert.equal(byEmail["lead@buyer.test"].channelUserId, "l1");
  assert.equal(byEmail["m@buyer.test"].decision, "review");
  assert.deepEqual(byEmail["m@buyer.test"].reasons, ["member_lead_same_email"]);
  assert.equal(byEmail["none@buyer.test"].decision, "create_candidate");
  assert.equal(meta.channelIndexComplete, false);
});

test("estimateOnly는 Channel을 호출하지 않고, 예상 요청이 상한을 넘으면 조회 전에 멈춘다", async () => {
  const { listDocs } = fakeDocs(threadFixture());
  const { meta, plan } = await collectAndPlan({ listDocs, exclusionRaw: threadExclusion, includeThreadIds: true, estimateOnly: true, config });
  assert.equal(plan, undefined);
  assert.equal(meta.estimate.memberRequests, 1);
  assert.equal(meta.estimate.userRequests, 2);
  assert.equal(meta.estimate.upperBound, 1 + 2 * 4);

  const reader = fakeReader(threadUsers, threadMembers);
  await assert.rejects(
    collectAndPlan({ listDocs, reader, exclusionRaw: threadExclusion, includeThreadIds: true, maxRequests: 2, config }),
    /상한 2건을 넘어/,
  );
  assert.equal(reader.calls.length, 0);
});

test("스냅샷을 재사용하면 Firestore·Channel을 다시 읽지 않고 같은 판정을 낸다", async () => {
  const { listDocs } = fakeDocs(threadFixture());
  const first = await collectAndPlan({
    listDocs,
    reader: fakeReader(threadUsers, threadMembers),
    exclusionRaw: threadExclusion,
    includeThreadIds: true,
    config,
  });
  const snapshot = JSON.parse(JSON.stringify(first.snapshot));
  const reader = fakeReader({}, {});
  const again = await collectAndPlan({ reader, exclusionRaw: threadExclusion, includeThreadIds: true, snapshot, config });
  assert.equal(reader.calls.length, 0);
  assert.equal(again.meta.estimate.expected, 0);
  assert.deepEqual(again.meta.estimate.reusedFromSnapshot, { members: 1, users: 2 });
  assert.deepEqual(again.plan, first.plan);

  await assert.rejects(
    collectAndPlan({ reader, exclusionRaw: threadExclusion, includeIngestIds: true, snapshot, config }),
    /다시 읽어야 합니다/,
  );
});
