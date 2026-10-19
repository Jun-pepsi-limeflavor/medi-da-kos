/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { ChannelTalkApiError } = require("../channeltalk/api");
const {
  applyCustomer, createCustomer, readLogState, runApply, selectCreateTargets, selectTargets,
} = require("../channeltalk/migration-apply");

// 모두 가상 데이터다.
function customer(key, extra = {}) {
  return {
    key,
    uid: null,
    email: `${key}@buyer.test`,
    decision: "link",
    reasons: ["email_unique"],
    notes: [],
    channelUserId: `ch-${key}`,
    dupCandidates: [],
    held: false,
    profile: { profileOnce: { brandCompanyName: "Brand", firstSource: "contact" }, fields: {} },
    ...extra,
  };
}

/** profileOnce 의미(빈 칸만 채움)를 흉내 내는 가짜 Channel. PATCH 외 쓰기 함수는 없다. */
function fakeChannel(users) {
  const state = structuredClone(users);
  const calls = [];
  return {
    state,
    calls,
    async getUser(id) {
      calls.push(["GET", id]);
      return Object.prototype.hasOwnProperty.call(state, id) ? structuredClone(state[id]) : null;
    },
    async patchUser(id, body) {
      calls.push(["PATCH", id, body]);
      assert.deepEqual(Object.keys(body), ["profileOnce"]);
      const profile = state[id].profile || (state[id].profile = {});
      for (const [field, value] of Object.entries(body.profileOnce)) {
        if (profile[field] === undefined || profile[field] === null || profile[field] === "") profile[field] = value;
      }
      return structuredClone(state[id]);
    },
  };
}

function fakeStore(mappings = {}) {
  const docs = structuredClone(mappings);
  const calls = [];
  return {
    docs,
    calls,
    async getMapping(email) {
      return docs[email] ? structuredClone(docs[email]) : null;
    },
    async recordIdentity(input) {
      calls.push(["recordIdentity", input.email, input.origin, input.uid]);
      docs[input.email] = { email: input.email, channelUserId: input.channelUserId, channelUserOrigin: input.origin, uid: input.uid, firstSource: null };
    },
    async setFirstSource(email, firstSource) {
      calls.push(["setFirstSource", email]);
      if (docs[email] && !docs[email].firstSource) docs[email].firstSource = firstSource;
    },
  };
}

const lead = (key, profile = {}) => ({ id: `ch-${key}`, type: "lead", member: false, profile: { email: `${key}@buyer.test`, ...profile } });

test("자동 적용 대상은 신원이 확실한 link뿐이고, pilot은 보류·채울 칸 없는 고객을 빼고 회원 3명·리드 2명이다", () => {
  const plan = {
    customers: [
      customer("a"),
      customer("b", { decision: "review", reasons: ["member_lead_same_email"], channelUserId: null, profile: null }),
      customer("c", { decision: "create_candidate", reasons: ["no_channel_match"], channelUserId: null }),
      customer("d", { dupCandidates: ["x"], notes: ["dup_candidate"], reasons: ["v1_mapping"] }),
      customer("e", { channelUserId: "test-1" }),
      customer("f", { held: true }),
      customer("g", { profile: { profileOnce: {}, fields: {} } }),
      customer("h", { reasons: ["uid_member"], uid: "u-h" }),
      customer("i"), customer("j"), customer("k"), customer("l"),
      customer("m1", { reasons: ["uid_member"], uid: "u-m1" }),
      customer("m2", { reasons: ["uid_member"], uid: "u-m2" }),
      customer("m3", { reasons: ["uid_member"], uid: "u-m3" }),
    ],
  };
  const pilot = selectTargets(plan, { mode: "pilot", limit: 10, testChannelIds: new Set(["test-1"]) });
  assert.deepEqual(pilot.targets.map((c) => c.key), ["a", "h", "i", "m1", "m2"]);
  assert.deepEqual(pilot.pilot, { members: 3, leads: 2 });

  const fewLeads = selectTargets({ customers: plan.customers.filter((c) => c.uid || c.key === "a") }, { mode: "pilot" });
  assert.deepEqual(fewLeads.targets.map((c) => c.key), ["a", "h", "m1", "m2"]);
  assert.deepEqual(pilot.excluded, {
    not_link: 2, dup_candidate: 1, test_channel_id: 1, pilot_skips_held: 1, pilot_nothing_to_fill: 1,
  });

  const full = selectTargets(plan, { mode: "full", doneKeys: new Set(["a"]), testChannelIds: new Set(["test-1"]) });
  assert.deepEqual(full.targets.map((c) => c.key), ["f", "g", "h", "i", "j", "k", "l", "m1", "m2", "m3"]);
  assert.equal(full.excluded.already_done, 1);
  assert.throws(() => selectTargets(plan, { mode: "all" }), /알 수 없는 실행 모드/);
});

test("최신 프로필을 다시 읽어 빈 칸만 profileOnce로 보내고, email은 보내지 않으며, 매핑은 없을 때만 만든다", async () => {
  const channel = fakeChannel({ "ch-a": lead("a", { brandCompanyName: "Kept" }) });
  const store = fakeStore();
  const target = customer("a", {
    profile: { profileOnce: { brandCompanyName: "Brand", email: "a@buyer.test", referralSource: "A friend", firstSource: "contact" }, fields: {} },
  });
  const entry = await applyCustomer(target, { api: channel, store, nowMs: 1 });

  assert.equal(entry.outcome, "applied");
  assert.deepEqual(entry.applied, ["firstSource", "referralSource"]);
  assert.deepEqual(entry.dropped, { brandCompanyName: "already_set_now", email: "never_send" });
  assert.equal(channel.state["ch-a"].profile.brandCompanyName, "Kept");
  assert.equal(entry.mapping, "created");
  assert.deepEqual(store.calls[0], ["recordIdentity", "a@buyer.test", "imported", null]);
  assert.equal(store.docs["a@buyer.test"].firstSource, "contact");
});

test("회원은 memberId가 우리 uid와 같을 때만 처리하고, 휴대폰 번호는 따로 보내 422면 번호만 포기한다", async () => {
  const member = { id: "ch-m", type: "member", member: true, memberId: "u-m", profile: { email: "m@buyer.test" } };
  const channel = fakeChannel({ "ch-m": member });
  const rejectingMobile = {
    ...channel,
    async patchUser(id, body) {
      if (body.profileOnce.mobileNumber) throw new ChannelTalkApiError("PATCH 422", { status: 422, code: "rejected" });
      return channel.patchUser(id, body);
    },
  };
  const store = fakeStore();
  const target = customer("m", {
    uid: "u-m",
    reasons: ["uid_member"],
    channelUserId: "ch-m",
    profile: { profileOnce: { name: "Kim", mobileNumber: "+821012345678" }, fields: {} },
  });
  const entry = await applyCustomer(target, { api: rejectingMobile, store, nowMs: 1 });
  assert.deepEqual(entry.applied, ["name"]);
  assert.equal(entry.dropped.mobileNumber, "rejected_by_channel");
  assert.deepEqual(store.calls[0], ["recordIdentity", "m@buyer.test", "member", "u-m"]);

  const mismatch = await applyCustomer({ ...target, uid: "u-other" }, { api: fakeChannel({ "ch-m": member }), store: fakeStore(), nowMs: 1 });
  assert.deepEqual([mismatch.outcome, mismatch.reason], ["skip", "member_mismatch"]);
});

test("신원이 달라졌으면 아무것도 쓰지 않고 건너뛴다", async () => {
  const cases = [
    [{}, "channel_user_missing"],
    [{ "ch-a": { id: "ch-a", type: "unified", unifiedId: "x", profile: {} } }, "channel_user_unified"],
    [{ "ch-a": lead("a", { email: "other@buyer.test" }) }, "channel_email_changed"],
    [{ "ch-a": { ...lead("a"), member: true, memberId: "u-x" } }, "unexpected_member"],
  ];
  for (const [users, reason] of cases) {
    const channel = fakeChannel(users);
    const store = fakeStore();
    const entry = await applyCustomer(customer("a"), { api: channel, store, nowMs: 1 });
    assert.deepEqual([entry.outcome, entry.reason], ["skip", reason]);
    assert.ok(!channel.calls.some(([kind]) => kind === "PATCH"), reason);
    assert.deepEqual(store.calls, [], reason);
  }

  const channel = fakeChannel({ "ch-a": lead("a") });
  const store = fakeStore({ "a@buyer.test": { channelUserId: "ch-other" } });
  const conflict = await applyCustomer(customer("a"), { api: channel, store, nowMs: 1 });
  assert.deepEqual([conflict.outcome, conflict.reason], ["skip", "mapping_conflict"]);
  assert.ok(!channel.calls.some(([kind]) => kind === "PATCH"));
});

test("다시 실행하면 이미 채운 칸과 매핑은 건너뛰어 PATCH·매핑 쓰기가 없다", async () => {
  const channel = fakeChannel({ "ch-a": lead("a"), "ch-b": lead("b") });
  const store = fakeStore();
  const targets = [customer("a"), customer("b")];
  const first = await runApply(targets, { api: channel, store });
  assert.equal(first.applied, 2);
  assert.equal(first.mappingsCreated, 2);

  const patchesBefore = channel.calls.filter(([kind]) => kind === "PATCH").length;
  const storeCallsBefore = store.calls.length;
  const second = await runApply(targets, { api: channel, store });
  assert.equal(second.alreadyDone, 2);
  assert.equal(second.patches, 0);
  assert.equal(channel.calls.filter(([kind]) => kind === "PATCH").length, patchesBefore);
  assert.equal(store.calls.length, storeCallsBefore);
});

test("API 오류는 재시도 없이 실행을 멈추고, 신원 건너뜀·PATCH 상한에서도 멈춘다", async () => {
  let gets = 0;
  const failing = {
    async getUser() { gets += 1; return lead("a"); },
    async patchUser() { throw new ChannelTalkApiError("PATCH 503", { status: 503, code: "server_error", ambiguous: true }); },
  };
  const log = [];
  const stopped = await runApply([customer("a"), customer("b")], { api: failing, store: fakeStore(), onEntry: (e) => log.push(e) });
  assert.equal(stopped.stopped, "channel_server_error");
  assert.equal(gets, 1);
  assert.deepEqual(log.map((e) => e.outcome), ["error"]);

  const skips = await runApply([customer("a"), customer("b"), customer("c")], { api: fakeChannel({}), store: fakeStore(), maxSkips: 2 });
  assert.equal(skips.stopped, "too_many_identity_skips");
  assert.equal(skips.processed, 2);

  const capped = await runApply([customer("a"), customer("b")], {
    api: fakeChannel({ "ch-a": lead("a"), "ch-b": lead("b") }),
    store: fakeStore(),
    maxWrites: 1,
  });
  assert.equal(capped.stopped, "write_limit");
  assert.equal(capped.applied, 1);
});

test("이관 경로는 생성 호출이 없고, 모듈 전체에 상담·내부대화·태그·덮어쓰기 호출이 없다", () => {
  const code = (file) => readFileSync(path.join(__dirname, file), "utf8")
    .split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
  assert.doesNotMatch(applyCustomer.toString(), /upsertMember|createLead/);
  for (const file of ["../channeltalk/migration-apply.js", "../scripts/channeltalk-migration-apply.mjs"]) {
    const source = code(file);
    assert.doesNotMatch(source, /\b(createUserChat|sendPrivateNote|openUserChat|recordUnified|setDupPairState|claim|updateSync)\b/, file);
    assert.doesNotMatch(source, /\btags\s*:/, file);
    // profile(덮어쓰기)은 회원 생성 본문 { profile: { firebaseUid } } 하나뿐이다.
    const profileBodies = source.match(/\bprofile:\s*\{[^}]*\}/g) || [];
    assert.ok(profileBodies.every((body) => /^profile:\s*\{\s*firebaseUid: customer\.uid\s*\}$/.test(body)), file);
  }
});

// ── 신규 생성 ────────────────────────────────────────────────────────────────

function createChannel({ members = {}, failCreate = null, noId = false } = {}) {
  const base = fakeChannel({});
  let seq = 0;
  return {
    ...base,
    async getUserByMemberId(uid) {
      base.calls.push(["GET@", uid]);
      return members[uid] || null;
    },
    async upsertMember(uid, body) {
      base.calls.push(["PUT@", uid, body]);
      if (failCreate) throw failCreate;
      const user = { id: `new-${(seq += 1)}`, type: "member", member: true, memberId: uid, profile: { ...body.profile } };
      if (!noId) base.state[user.id] = user;
      return noId ? {} : structuredClone(user);
    },
    async createLead(profile) {
      base.calls.push(["POST", profile]);
      if (failCreate) throw failCreate;
      const user = { id: `new-${(seq += 1)}`, type: "lead", member: false, profile: { ...profile } };
      base.state[user.id] = user;
      return structuredClone(user);
    },
  };
}

function candidate(key, extra = {}) {
  return customer(key, {
    decision: "create_candidate",
    reasons: ["no_channel_match"],
    channelUserId: null,
    profile: { profileOnce: { email: `${key}@buyer.test`, brandCompanyName: "Brand", firstSource: "contact" }, fields: {} },
    ...extra,
  });
}
const memberCandidate = (key) => candidate(key, {
  uid: `u-${key}`,
  reasons: ["member_404"],
  profile: { profileOnce: { email: `${key}@buyer.test`, name: "Kim", firstSource: "signup" }, fields: {} },
});

test("생성 대상은 허용 목록·같은 사유의 create_candidate만이고, 회원·리드를 나누며 pilot은 최대 2명이다", () => {
  const plan = {
    customers: [
      memberCandidate("m1"), memberCandidate("m2"), memberCandidate("m3"), memberCandidate("m4"),
      candidate("l1"), candidate("l2"), candidate("l3", { reasons: ["no_channel_match", "x"] }),
      customer("done-link"),
    ],
  };
  const allowKeys = new Set(["m1", "m2", "m3", "l1", "l2", "l3"]);
  const members = selectCreateTargets(plan, { kind: "member", allowKeys, doneKeys: new Set(["m1"]), uncertainKeys: new Set(["m2"]), pilot: true });
  assert.deepEqual(members.targets.map((c) => c.key), ["m3"]);
  assert.deepEqual(members.excluded, { already_done: 1, uncertain_previous_attempt: 1, not_allowed: 1 });
  const leads = selectCreateTargets(plan, { kind: "lead", allowKeys, pilot: true });
  assert.deepEqual(leads.targets.map((c) => c.key), ["l1", "l2"]);
  assert.equal(leads.excluded.unexpected_reason, 1);
  assert.throws(() => selectCreateTargets(plan, { kind: "lead", allowKeys: new Set() }), /허용 목록/);
});

test("회원은 @uid가 지금도 없을 때만 PUT { profile: { firebaseUid } }로 만들고, 생성 전 intent를 남긴 뒤 빈 칸만 채운다", async () => {
  const channel = createChannel();
  const store = fakeStore();
  const lines = [];
  const entry = await createCustomer(memberCandidate("m1"), { api: channel, store, nowMs: 1, intent: (l) => lines.push(l) });

  assert.equal(entry.outcome, "created");
  assert.deepEqual(lines.map((l) => l.outcome), ["intent", "created_pending"]);
  const kinds = channel.calls.map(([k]) => k);
  assert.deepEqual(kinds, ["GET@", "PUT@", "PATCH"]);
  assert.deepEqual(channel.calls[1][2], { profile: { firebaseUid: "u-m1" } });
  assert.deepEqual(channel.calls[2][2], { profileOnce: { firstSource: "signup", name: "Kim" } });
  assert.equal(entry.dropped.email, "never_send");
  assert.deepEqual(store.calls[0], ["recordIdentity", "m1@buyer.test", "member", "u-m1"]);

  const withEmail = createChannel();
  await createCustomer(memberCandidate("m2"), { api: withEmail, store: fakeStore(), nowMs: 1, intent: () => {}, memberEmail: true });
  assert.equal(withEmail.calls[2][2].profileOnce.email, "m2@buyer.test");
});

test("리드는 POST { email }로 만들고 server_lead 매핑을 남기며, 직전 재확인에서 이미 있으면 만들지 않는다", async () => {
  const channel = createChannel();
  const store = fakeStore();
  const entry = await createCustomer(candidate("l1"), { api: channel, store, nowMs: 1, intent: () => {} });
  assert.equal(entry.outcome, "created");
  assert.deepEqual(channel.calls[0], ["POST", { email: "l1@buyer.test" }]);
  assert.deepEqual(channel.calls[1][2], { profileOnce: { brandCompanyName: "Brand", firstSource: "contact" } });
  assert.equal(entry.dropped.email, "already_set_now");
  assert.deepEqual(store.calls[0], ["recordIdentity", "l1@buyer.test", "server_lead", null]);

  const mapped = createChannel();
  const skip = await createCustomer(candidate("l2"), { api: mapped, store: fakeStore({ "l2@buyer.test": { channelUserId: "x" } }), nowMs: 1, intent: () => {} });
  assert.deepEqual([skip.outcome, skip.reason], ["skip", "mapping_exists_now"]);
  assert.deepEqual(mapped.calls, []);

  const existing = createChannel({ members: { "u-m1": { id: "m", type: "member", member: true, memberId: "u-m1" } } });
  const skipMember = await createCustomer(memberCandidate("m1"), { api: existing, store: fakeStore(), nowMs: 1, intent: () => {} });
  assert.deepEqual([skipMember.outcome, skipMember.reason], ["skip", "member_exists_now"]);
  assert.ok(!existing.calls.some(([k]) => k === "PUT@"));
});

test("생성 응답이 불확실하면 재시도 없이 멈추고, 그 고객은 다음 실행에서 다시 만들지 않는다", async () => {
  const lines = [];
  const timeout = new ChannelTalkApiError("POST timeout", { code: "timeout", ambiguous: true });
  const channel = createChannel({ failCreate: timeout });
  const summary = await runApply([candidate("l1"), candidate("l2")], {
    api: channel, store: fakeStore(), handler: createCustomer, maxSkips: 1, onEntry: (l) => lines.push(l),
  });
  assert.equal(summary.stopped, "channel_timeout");
  assert.equal(channel.calls.filter(([k]) => k === "POST").length, 1);
  assert.deepEqual(lines.map((l) => [l.outcome, l.uncertain || false]), [["intent", false], ["error", true]]);

  const state = readLogState(lines);
  assert.ok(state.uncertainKeys.has("l1"));
  const again = selectCreateTargets({ customers: [candidate("l1"), candidate("l2")] }, { kind: "lead", allowKeys: new Set(["l1", "l2"]), ...state });
  assert.deepEqual(again.targets.map((c) => c.key), ["l2"]);

  const noId = await runApply([memberCandidate("m1")], { api: createChannel({ noId: true }), store: fakeStore(), handler: createCustomer });
  assert.equal(noId.stopped, "created_without_id");
});

test("생성 실행은 완료 고객을 created로 세고, 같은 로그로 다시 고르면 대상에서 빠진다", async () => {
  const lines = [];
  const summary = await runApply([candidate("l1"), memberCandidate("m1")], {
    api: createChannel(), store: fakeStore(), handler: createCustomer, onEntry: (l) => lines.push(l),
  });
  assert.equal(summary.created, 2);
  assert.equal(summary.creates, 2);
  assert.equal(summary.mappingsCreated, 2);
  const state = readLogState(lines);
  assert.deepEqual([...state.doneKeys].sort(), ["l1", "m1"]);
  assert.equal(state.uncertainKeys.size, 0);
});
