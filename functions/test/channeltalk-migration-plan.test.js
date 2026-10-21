/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { planMigration } = require("../channeltalk/migration-plan");

// 모두 가상 데이터다.
const config = { testDomain: "techasset.co.kr" };

function contact(docId, email, extra = {}) {
  return { source: "contact", docId, data: { email, createdAt: 1000, ...extra } };
}

function member(uid, email, extra = {}) {
  return { source: "users", docId: uid, data: { uid, email, createdAt: 500, ...extra } };
}

function lead(id, profile = {}) {
  return { id, type: "lead", member: false, profile };
}

function plan(input) {
  return planMigration({ config, ...input });
}

function customerOf(result, email) {
  return result.customers.find((c) => c.email === email);
}

test("기존 V1 매핑이 있으면 그 고객에 연결하고 빈 칸만 채운다", async () => {
  const result = await plan({
    records: [contact("c1", "a@buyer.test", { companyName: "Acme", referralSource: "A friend" })],
    mappings: { "a@buyer.test": { channelUserId: "ch1" } },
    channel: {
      users: { ch1: lead("ch1", { email: "a@buyer.test", referralSource: "Events" }) },
      idsByEmail: { "a@buyer.test": ["ch1"] },
    },
  });
  const c = customerOf(result, "a@buyer.test");
  assert.equal(c.decision, "link");
  assert.deepEqual(c.reasons, ["v1_mapping"]);
  assert.equal(c.channelUserId, "ch1");
  assert.deepEqual(c.profile.profileOnce, { brandCompanyName: "Acme", firstSource: "contact" });
  assert.equal(c.profile.fields.referralSource, "already_set");
  assert.equal(c.profile.fields.email, "already_set");
});

test("Channel에만 있던 고객은 이메일 표로 연결하고, Firestore 기록이 없으면 손대지 않는다", async () => {
  const result = await plan({
    records: [contact("c1", "b@buyer.test", { companyName: "New Co" })],
    channel: {
      users: {
        ch2: lead("ch2", { email: "b@buyer.test", brandCompanyName: "Old Co" }),
        ch9: lead("ch9", { email: "only@channel.test" }),
      },
      idsByEmail: { "b@buyer.test": ["ch2"], "only@channel.test": ["ch9"] },
    },
  });
  const c = customerOf(result, "b@buyer.test");
  assert.equal(c.decision, "link");
  assert.deepEqual(c.reasons, ["email_unique"]);
  assert.equal(c.profile.fields.brandCompanyName, "already_set");
  assert.equal("brandCompanyName" in c.profile.profileOnce, false);
  assert.equal(customerOf(result, "only@channel.test"), undefined);
});

test("매칭이 없으면 신규 생성 후보로만 둔다", async () => {
  const result = await plan({ records: [contact("c1", "new@buyer.test")] });
  const c = customerOf(result, "new@buyer.test");
  assert.equal(c.decision, "create_candidate");
  assert.deepEqual(c.reasons, ["no_channel_match"]);
});

test("같은 이메일의 Channel 고객이 여럿이면 매핑 대표에 연결하고 나머지는 중복 후보로 남긴다", async () => {
  const channel = {
    users: { ch1: lead("ch1", { email: "d@buyer.test" }), ch3: lead("ch3", { email: "d@buyer.test" }) },
    idsByEmail: { "d@buyer.test": ["ch1", "ch3"] },
  };
  const records = [contact("c1", "d@buyer.test")];

  const mapped = customerOf(await plan({ records, channel, mappings: { "d@buyer.test": { channelUserId: "ch1" } } }), "d@buyer.test");
  assert.equal(mapped.decision, "link");
  assert.equal(mapped.channelUserId, "ch1");
  assert.deepEqual(mapped.dupCandidates, ["ch3"]);
  assert.ok(mapped.notes.includes("dup_candidate"));

  const dismissed = customerOf(
    await plan({
      records,
      channel,
      mappings: { "d@buyer.test": { channelUserId: "ch1", dupPairs: { ch1_ch3: { state: "dismissed" } } } },
    }),
    "d@buyer.test",
  );
  assert.deepEqual(dismissed.dupCandidates, []);

  const unmapped = customerOf(await plan({ records, channel }), "d@buyer.test");
  assert.equal(unmapped.decision, "review");
  assert.deepEqual(unmapped.reasons, ["multi_live_channel_users"]);
  assert.equal(unmapped.profile, null);
});

test("같은 이메일인데 Firebase uid가 다르면 검토로 보낸다", async () => {
  const result = await plan({
    records: [member("u1", "e@buyer.test"), member("u2", "e@buyer.test")],
    channel: { membersByUid: { u1: null, u2: null } },
  });
  assert.equal(result.customers.length, 1);
  assert.equal(result.customers[0].decision, "review");
  assert.ok(result.customers[0].reasons.includes("same_email_diff_uid"));
});

test("회원과 리드가 같은 이메일이면 자동 연결·생성하지 않고 검토로 보낸다", async () => {
  const m = { id: "m3", type: "member", member: true, profile: { email: "f@buyer.test" } };
  const conflict = await plan({
    records: [member("u3", "f@buyer.test")],
    channel: {
      users: { m3: m, l4: lead("l4", { email: "f@buyer.test" }) },
      membersByUid: { u3: m },
      idsByEmail: { "f@buyer.test": ["m3", "l4"] },
    },
  });
  assert.equal(conflict.customers[0].decision, "review");
  assert.deepEqual(conflict.customers[0].reasons, ["member_lead_same_email"]);

  const memberMissing = await plan({
    records: [member("u3", "f@buyer.test")],
    channel: { users: { l4: lead("l4", { email: "f@buyer.test" }) }, membersByUid: { u3: null }, idsByEmail: { "f@buyer.test": ["l4"] } },
  });
  assert.equal(memberMissing.customers[0].decision, "review");
  assert.deepEqual(memberMissing.customers[0].reasons, ["member_lead_same_email"]);

  const alone = await plan({
    records: [member("u3", "f@buyer.test", { companyName: "Brand" })],
    channel: { users: { m3: m }, membersByUid: { u3: m }, idsByEmail: { "f@buyer.test": ["m3"] } },
  });
  assert.equal(alone.customers[0].decision, "link");
  assert.deepEqual(alone.customers[0].reasons, ["uid_member"]);
  assert.equal(alone.customers[0].profile.profileOnce.brandCompanyName, "Brand");
});

test("통합 고객은 이메일이 맞는 최종 고객까지 따라가고, 아니면 검토로 보낸다", async () => {
  const records = [contact("c1", "g@buyer.test")];
  const mappings = { "g@buyer.test": { channelUserId: "old1" } };
  const old1 = { id: "old1", type: "unified", unifiedId: "m5", profile: {} };

  const resolved = customerOf(
    await plan({ records, mappings, channel: { users: { old1, m5: { id: "m5", type: "member", member: true, profile: {} } } } }),
    "g@buyer.test",
  );
  assert.equal(resolved.decision, "link");
  assert.equal(resolved.channelUserId, "m5");
  assert.ok(resolved.notes.includes("unified_resolved"));

  const otherEmail = customerOf(
    await plan({
      records,
      mappings,
      channel: { users: { old1, m5: { id: "m5", type: "member", member: true, profile: { email: "x@other.test" } } } },
    }),
    "g@buyer.test",
  );
  assert.equal(otherEmail.decision, "review");
  assert.deepEqual(otherEmail.reasons, ["unified_other_email"]);

  const loop = customerOf(
    await plan({
      records,
      mappings,
      channel: { users: { old1: { ...old1, unifiedId: "old2" }, old2: { id: "old2", type: "unified", unifiedId: "old1" } } },
    }),
    "g@buyer.test",
  );
  assert.equal(loop.decision, "review");
  assert.deepEqual(loop.reasons, ["unified_unresolved"]);
});

test("OFF 기간 보류 건은 테스트 신호가 있어도 이관 대상이고 V1 기록은 바꾸지 않는다", async () => {
  const syncDocs = {
    contact_h1: { pendingReason: "intake_disabled", heldReason: "pre_activation", nextRetryAt: null, status: "pending" },
  };
  const before = structuredClone(syncDocs);
  const result = await plan({
    records: [contact("h1", "held@buyer.test", { isTest: true })],
    syncDocs,
    exclusion: { firestoreIds: ["contact_h1"] },
  });
  const c = customerOf(result, "held@buyer.test");
  assert.equal(c.decision, "create_candidate");
  assert.equal(c.held, true);
  assert.ok(c.notes.includes("held_no_match"));
  assert.deepEqual(syncDocs, before);
});

test("테스트 데이터는 정책 순서대로 건너뛰고, 보호 목록이 우선한다", async () => {
  const result = await plan({
    records: [
      contact("t1", "real1@buyer.test"),
      contact("t2", "real2@buyer.test", { isTest: true }),
      contact("t3", "kimbm+chtest-x@techasset.co.kr"),
      contact("t4", "listed@buyer.test"),
      contact("t5", "protected@buyer.test", { isTest: true }),
      contact("t6", ""),
    ],
    exclusion: {
      firestoreIds: ["contact_t1", "contact_t5"],
      emails: ["LISTED@buyer.test"],
      protectedIds: ["contact_t5"],
    },
  });
  const reasons = Object.fromEntries(result.records.map((r) => [r.id, r.reason]));
  assert.equal(reasons.contact_t1, "v1_test_id");
  assert.equal(reasons.contact_t2, "is_test");
  assert.equal(reasons.contact_t3, "v1_test_email");
  assert.equal(reasons.contact_t4, "v1_test_email");
  assert.equal(reasons.contact_t6, "invalid_email");
  assert.equal(customerOf(result, "protected@buyer.test").decision, "create_candidate");
  assert.equal(result.summary.records["skip:is_test"], 1);
});

test("Channel 테스트 id: 404는 예상된 결과로 보고, 살아 있거나 목록에 없는 404는 검토로 보낸다", async () => {
  const records = [contact("c1", "k@buyer.test")];
  const mappings = { "k@buyer.test": { channelUserId: "tid" } };

  const expected404 = customerOf(
    await plan({ records, mappings, channel: { users: { tid: null } }, exclusion: { channelUserIds: ["tid"] } }),
    "k@buyer.test",
  );
  assert.equal(expected404.decision, "create_candidate");
  assert.ok(expected404.notes.includes("test_channel_id_404_expected"));

  const alive = customerOf(
    await plan({ records, mappings, channel: { users: { tid: lead("tid") } }, exclusion: { channelUserIds: ["tid"] } }),
    "k@buyer.test",
  );
  assert.deepEqual(alive.reasons, ["test_channel_id"]);

  const unverified = customerOf(
    await plan({ records, mappings, channel: { users: { tid: lead("tid") } }, exclusion: { unverifiedDeletedUserIds: ["tid"] } }),
    "k@buyer.test",
  );
  assert.deepEqual(unverified.reasons, ["deleted_id_unverified_alive"]);

  const unexpected = customerOf(await plan({ records, mappings, channel: { users: { tid: null } } }), "k@buyer.test");
  assert.deepEqual(unexpected.reasons, ["unexpected_404"]);

  const notFetched = customerOf(await plan({ records, mappings }), "k@buyer.test");
  assert.deepEqual(notFetched.reasons, ["channel_not_fetched"]);
});

test("원천끼리 값이 다르면 그 필드는 쓰지 않고, 회원 값과 가장 이른 firstSource를 우선한다", async () => {
  const conflict = customerOf(
    await plan({
      records: [
        contact("c1", "p@buyer.test", { companyName: "One", referralSource: "A friend", createdAt: 2000 }),
        contact("c2", "p@buyer.test", { companyName: "Two", referralSource: "A friend", createdAt: 3000 }),
      ],
    }),
    "p@buyer.test",
  );
  assert.equal(conflict.profile.fields.brandCompanyName, "field_conflict");
  assert.equal("brandCompanyName" in conflict.profile.profileOnce, false);
  assert.equal(conflict.profile.profileOnce.referralSource, "A friend");

  const memberFirst = customerOf(
    await plan({
      records: [
        member("u9", "q@buyer.test", { companyName: "Member Brand", createdAt: 5000 }),
        contact("c3", "q@buyer.test", { uid: "u9", companyName: "Form Brand", createdAt: 1000 }),
      ],
      channel: { membersByUid: { u9: null } },
    }),
    "q@buyer.test",
  );
  assert.equal(memberFirst.decision, "create_candidate");
  assert.equal(memberFirst.profile.profileOnce.brandCompanyName, "Member Brand");
  assert.equal(memberFirst.profile.profileOnce.firstSource, "contact");
});

test("주문의 회원 문서가 없거나 V1 빈 리드 표시가 있으면 검토로 보낸다", async () => {
  const result = await plan({
    records: [
      { source: "orders", docId: "o1", data: { uid: "ghost", createdAt: 1 } },
      contact("c1", "orphan@buyer.test"),
    ],
    syncDocs: { contact_c1: { possibleOrphanLead: true } },
    channel: { membersByUid: { ghost: null } },
  });
  assert.deepEqual(result.customers.find((c) => c.uid === "ghost").reasons, ["order_without_user"]);
  assert.deepEqual(customerOf(result, "orphan@buyer.test").reasons, ["orphan_flag"]);
});

test("buyers에만 있는 고객은 검토 대상이고, 웹 고객과 겹치면 목록에 넣지 않는다", async () => {
  const result = await plan({
    records: [contact("c1", "web@buyer.test")],
    buyers: [{ id: "b1", emails: ["WEB@buyer.test"] }, { id: "b2", emails: ["mail-only@buyer.test"] }],
  });
  assert.deepEqual(result.buyers, [{ buyerId: "b2", decision: "review", reason: "buyer_only" }]);
});

test("같은 입력을 반복하거나 순서를 바꿔도 결과가 같고 입력을 바꾸지 않는다", async () => {
  const input = {
    records: [
      contact("c2", "r@buyer.test", { companyName: "R", createdAt: 2000 }),
      member("u1", "s@buyer.test"),
      contact("c1", "r@buyer.test", { companyName: "R", createdAt: 1000 }),
      contact("c3", "kimbm+chtest@techasset.co.kr"),
    ],
    mappings: { "r@buyer.test": { channelUserId: "ch1" } },
    channel: { users: { ch1: lead("ch1", { email: "r@buyer.test" }) }, membersByUid: { u1: null } },
  };
  const before = structuredClone(input);
  const first = await plan(input);
  const second = await plan(input);
  const reversed = await plan({ ...input, records: [...input.records].reverse() });
  assert.deepEqual(second, first);
  assert.deepEqual(reversed, first);
  assert.deepEqual(input, before);
});
