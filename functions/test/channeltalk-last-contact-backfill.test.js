/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ChannelTalkApiError } = require("../channeltalk/api");
const {
  applyBackfillTarget, buildBackfillPlan, doneFromLog, judgeMessage, latestInChat, runBackfill,
} = require("../channeltalk/last-contact-backfill");
const { createWebhookHandler } = require("../channeltalk/last-contact");

// 모두 가상 데이터다.
const NOW = Date.UTC(2026, 9, 21, 9, 0);
const at = (d, h, m = 0) => Date.UTC(2026, 9, d, h, m);
const iso = (ms) => new Date(ms).toISOString();
const msg = (createdAt, extra = {}) => ({ chatType: "userChat", personType: "user", writingType: "standard", createdAt: iso(createdAt), ...extra });

/** 가짜 Channel: 상담 목록·메시지(최신순 페이지)·고객 조회·profileOnce/profile PATCH */
function fakeChannel({ users = {}, chats = {}, messages = {}, pageSize = 2 } = {}) {
  const state = structuredClone(users);
  const calls = [];
  return {
    state,
    calls,
    async getUser(id) {
      calls.push(["GET", id]);
      return state[id] ? structuredClone(state[id]) : null;
    },
    async listUserChatsOfUserPage(userId) {
      calls.push(["CHATS", userId]);
      return { userChats: (chats[userId] || []).map((id) => ({ id, userId })), next: null };
    },
    async listMessagesPage(chatId, { cursor = null } = {}) {
      calls.push(["MSGS", chatId]);
      const all = [...(messages[chatId] || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + pageSize);
      return { messages: page, nextCursor: start + pageSize < all.length ? String(start + pageSize) : null };
    },
    async patchUser(id, body) {
      calls.push(["PATCH", id, body]);
      const profile = state[id].profile || (state[id].profile = {});
      for (const [k, v] of Object.entries(body.profileOnce || {})) if (profile[k] === undefined || profile[k] === null) profile[k] = v;
      Object.assign(profile, body.profile || {});
      return structuredClone(state[id]);
    },
  };
}

function fakeControl({ halted = false, failRead = false } = {}) {
  const s = { halted, halts: [] };
  return {
    s,
    async isHalted() { if (failRead) throw new Error("unavailable"); return s.halted; },
    async halt(info) { s.halted = true; s.halts.push(info); },
  };
}

test("과거 메시지 판정: ISO·밀리초 시각, 고객·담당자 일반 메시지와 연동 이메일만 인정", () => {
  const judge = (m) => judgeMessage(m, { userId: "u1", nowMs: NOW });
  assert.deepEqual(judge(msg(at(20, 10, 30) + 45_000)), { action: "update", reason: "customer_message", userId: "u1", atMs: at(20, 10, 30) });
  assert.equal(judge({ ...msg(at(20, 10)), createdAt: at(20, 10) }).atMs, at(20, 10));
  assert.equal(judge(msg(at(20, 10), { personType: "manager", writingType: "email" })).reason, "manager_email");
  assert.equal(judge(msg(at(20, 10), { writingType: "email" })).reason, "customer_email");
  for (const [extra, reason] of [
    [{ personType: "manager", options: ["private", "silentToUser"] }, "private_note"],
    [{ personType: "bot" }, "bot"],
    [{ personType: "manager", log: { action: "assign" } }, "system_log"],
    [{ personType: "manager", broadcastedMsg: { id: "b" } }, "broadcast"],
    [{ chatType: "group" }, "team_chat"],
  ]) assert.equal(judge(msg(at(20, 10), extra)).reason, reason);
  assert.equal(judge(msg(at(20, 10), { writingType: "workflow" })).action, "hold");
  assert.equal(judge({ ...msg(0), createdAt: "not a date" }).reason, "invalid_created_at");
});

test("상담방 하나: 최신순으로 넘기며 처음 만난 유효 메시지를 쓰고, 그보다 새 보류 메시지가 있으면 검토로 보낸다", async () => {
  const ch = fakeChannel({
    messages: {
      c1: [msg(at(20, 9)), msg(at(20, 11), { personType: "bot" }), msg(at(20, 12), { personType: "manager", options: ["private"] }), msg(at(20, 10), { personType: "manager" })],
      c2: [msg(at(20, 9)), msg(at(20, 13), { writingType: "workflow" })],
      c3: [msg(at(20, 9), { personType: "bot" })],
    },
  });
  assert.deepEqual(await latestInChat(ch, { id: "c1", userId: "u1" }, { nowMs: NOW }), { status: "found", atMs: at(20, 10), reason: "manager_message" });
  const review = await latestInChat(ch, { id: "c2", userId: "u1" }, { nowMs: NOW });
  assert.equal(review.status, "review");
  assert.deepEqual(review.holds, ["unknown_writing_type"]);
  assert.deepEqual(await latestInChat(ch, { id: "c3", userId: "u1" }, { nowMs: NOW }), { status: "none" });
});

test("계획: 여러 상담방의 최신 시각, 이미 값 있음·연락 없음·삭제·통합·타입 위험을 구분한다", async () => {
  const ch = fakeChannel({
    users: {
      u1: { id: "u1", profile: { email: "a@x.test" } },
      u2: { id: "u2", profile: { lastContactAt: at(1, 1) } },
      u3: { id: "u3", profile: {} },
      old: { id: "old", type: "unified", unifiedId: "m1", profile: { email: "m@x.test" } },
      m1: { id: "m1", member: true, profile: { email: "m@x.test" } },
      oldOther: { id: "oldOther", type: "unified", unifiedId: "m2", profile: { email: "other@x.test" } },
      m2: { id: "m2", member: true, profile: { email: "m2@x.test" } },
      risky: { id: "risky", profile: { moq: "TBD" } },
    },
    chats: { u1: ["a", "b"], u2: ["c"], u3: ["d"], old: ["e"], m1: ["f"], oldOther: ["g"], risky: ["h"] },
    messages: {
      a: [msg(at(19, 8)), msg(at(20, 7), { personType: "manager", writingType: "email" })],
      b: [msg(at(20, 9) + 20_000), msg(at(20, 11), { personType: "bot" })],
      c: [msg(at(20, 9))],
      d: [msg(at(20, 9), { personType: "bot" })],
      e: [msg(at(18, 9))],
      f: [msg(at(17, 9))],
      g: [msg(at(18, 9))],
      h: [msg(at(18, 9))],
    },
  });
  const plan = await buildBackfillPlan({ client: ch, userIds: ["u1", "u2", "u3", "gone", "old", "m1", "oldOther", "risky", "u1"], nowMs: NOW });
  assert.deepEqual(plan.targets, [
    { channelUserId: "m1", atMs: at(18, 9), sources: ["m1", "old"] },
    { channelUserId: "u1", atMs: at(20, 9), sources: ["u1"] },
  ]);
  assert.deepEqual(plan.skips.map((s) => `${s.userId}:${s.reason}`).sort(), ["gone:user_missing", "u2:already_set", "u3:no_contact"]);
  assert.deepEqual(plan.reviews.map((r) => `${r.userId}:${r.reason}`).sort(), ["oldOther:unified_other_email", "risky:type_risk"]);
  assert.equal(ch.calls.filter(([k]) => k === "PATCH").length, 0);
});

test("채우기: profileOnce만 보내고, 그 사이 값이 생겼으면 쓰지 않으며, 웹훅이 더 최신 값을 넣었으면 그대로 둔다", async () => {
  const ch = fakeChannel({ users: { u1: { id: "u1", profile: { moq: 5 } }, u2: { id: "u2", profile: { lastContactAt: at(20, 1) } } } });
  const control = fakeControl();
  const applied = await applyBackfillTarget({ channelUserId: "u1", atMs: at(19, 9) }, { api: ch, control, nowMs: NOW });
  assert.equal(applied.outcome, "applied");
  assert.deepEqual(ch.calls.find(([k]) => k === "PATCH")[2], { profileOnce: { lastContactAt: at(19, 9) } });
  assert.equal((await applyBackfillTarget({ channelUserId: "u2", atMs: at(19, 9) }, { api: ch, control, nowMs: NOW })).reason, "already_set_now");

  // 다시 읽은 직후 웹훅이 더 최신 값을 넣은 경우(profileOnce라 덮어쓰지 않음)
  const race = fakeChannel({ users: { u3: { id: "u3", profile: {} } } });
  const racing = { ...race, async patchUser(id, body) { race.state[id].profile.lastContactAt = at(21, 8); return race.patchUser(id, body); } };
  const superseded = await applyBackfillTarget({ channelUserId: "u3", atMs: at(19, 9) }, { api: racing, control, nowMs: NOW });
  assert.equal(superseded.outcome, "superseded");
  assert.equal(race.state.u3.profile.lastContactAt, at(21, 8));
});

test("채우기 후 다른 필드가 바뀌면 중단 플래그를 기록하고, 실행은 그 자리에서 멈춘다", async () => {
  const ch = fakeChannel({ users: { u1: { id: "u1", profile: { moq: 500 } }, u2: { id: "u2", profile: {} } } });
  const coercing = { ...ch, async patchUser(id, body) { const u = await ch.patchUser(id, body); ch.state[id].profile.moq = 0; return u; } };
  const control = fakeControl();
  const log = [];
  const summary = await runBackfill([{ channelUserId: "u1", atMs: at(19, 9) }, { channelUserId: "u2", atMs: at(19, 9) }], { api: coercing, control, onEntry: (e) => log.push(e) });
  assert.equal(summary.stopped, "other_fields_changed");
  assert.deepEqual(control.s.halts[0].fields, ["profile.moq"]);
  assert.equal(ch.calls.filter(([k, id]) => k === "PATCH" && id === "u2").length, 0);
});

test("실행: 중단 상태·플래그 읽기 실패·API 오류에서 재시도 없이 멈추고, 웹훅이 먼저 채운 고객은 정상으로 센다", async () => {
  const users = { u1: { id: "u1", profile: {} } };
  const targets = [{ channelUserId: "u1", atMs: at(19, 9) }];
  assert.equal((await runBackfill(targets, { api: fakeChannel({ users }), control: fakeControl({ halted: true }) })).stopped, "halted");
  assert.equal((await runBackfill(targets, { api: fakeChannel({ users }), control: fakeControl({ failRead: true }) })).stopped, "halt_check_failed");
  let gets = 0;
  const failing = { async getUser() { gets += 1; throw new ChannelTalkApiError("GET 503", { code: "server_error", ambiguous: true }); }, async patchUser() {} };
  assert.equal((await runBackfill(targets, { api: failing, control: fakeControl() })).stopped, "channel_server_error");
  assert.equal(gets, 1);

  const filled = fakeChannel({ users: { a: { id: "a", profile: { lastContactAt: 1 } }, b: { id: "b", profile: { lastContactAt: 1 } }, c: { id: "c", profile: { lastContactAt: 1 } }, d: { id: "d", profile: {} } } });
  const summary = await runBackfill(["a", "b", "c", "d"].map((id) => ({ channelUserId: id, atMs: at(19, 9) })), { api: filled, control: fakeControl(), maxSkips: 1 });
  assert.equal(summary.stopped, null);
  assert.equal(summary.applied, 1);
  assert.equal(summary.skipReasons.already_set_now, 3);
});

test("다시 실행할 때 끝난 고객을 건너뛸 목록을 로그에서 만든다", () => {
  const done = doneFromLog([
    { channelUserId: "a", outcome: "applied" },
    { channelUserId: "b", outcome: "superseded" },
    { channelUserId: "c", outcome: "skip", reason: "already_set_now" },
    { channelUserId: "d", outcome: "skip", reason: "type_risk" },
    { channelUserId: "e", outcome: "error" },
  ]);
  assert.deepEqual([...done].sort(), ["a", "b", "c"]);
});

test("실시간 웹훅과 백필이 동시에 돌아도 최신 날짜가 남는다(두 순서 모두)", async () => {
  const TOKEN = "t".repeat(32);
  const webhookEvent = { event: "push", type: "Message", entity: { chatType: "userChat", personType: "user", createdAt: at(21, 8) }, refers: { user: { id: "u1" } } };
  for (const order of ["webhook_first", "backfill_first"]) {
    const ch = fakeChannel({ users: { u1: { id: "u1", profile: {} } } });
    const control = fakeControl();
    const webhook = createWebhookHandler({
      getMode: () => "on", getToken: () => TOKEN, getApi: () => ch, log: () => {}, now: () => NOW, getAllowList: () => "*", getControl: () => control,
    });
    const runWebhook = () => webhook({ method: "POST", query: { auth: TOKEN }, headers: {}, body: webhookEvent });
    const runFill = () => runBackfill([{ channelUserId: "u1", atMs: at(19, 9) }], { api: ch, control });
    if (order === "webhook_first") { await runWebhook(); await runFill(); } else { await runFill(); await runWebhook(); }
    await Promise.all([runWebhook(), runFill()]);
    assert.equal(ch.state.u1.profile.lastContactAt, at(21, 8), order);
    assert.equal(control.s.halted, false, order);
  }
});

test("두 상담 목록 합치기: 한쪽에만 있는 상담도 반영하고, 겹치는 상담은 한 번만 읽어 날짜를 중복 계산하지 않는다", async () => {
  const ch = fakeChannel({
    users: { u1: { id: "u1", profile: {} } },
    chats: { u1: ["a", "b"] },
    messages: { a: [msg(at(18, 9))], b: [msg(at(19, 9))], g: [msg(at(20, 9), { personType: "manager" })] },
  });
  const globalChatsByUser = new Map([["u1", [{ id: "b", userId: "u1" }, { id: "g", userId: "u1" }, { id: "x", userId: "someoneElse" }]]]);
  const plan = await buildBackfillPlan({ client: ch, userIds: ["u1"], globalChatsByUser, nowMs: NOW });
  assert.deepEqual(plan.targets, [{ channelUserId: "u1", atMs: at(20, 9), sources: ["u1"] }]);
  assert.deepEqual([plan.stats.chats, plan.stats.chatsOnlyPerUser, plan.stats.chatsOnlyGlobal, plan.stats.chatsInBoth], [3, 1, 1, 1]);
  assert.deepEqual(ch.calls.filter(([k]) => k === "MSGS").map(([, id]) => id).sort(), ["a", "b", "g"]);
});

test("상담 목록 조회 실패: 확실한 거부(422 등)는 그 고객만 검토로, 애매한 실패는 실행을 멈추며 조회 완료로 보지 않는다", async () => {
  const base = fakeChannel({ users: { u1: { id: "u1", profile: {} }, u2: { id: "u2", profile: {} } }, chats: { u2: ["c"] }, messages: { c: [msg(at(19, 9))] } });
  const rejecting = {
    ...base,
    async listUserChatsOfUserPage(userId, opts) {
      if (userId === "u1") throw new ChannelTalkApiError("GET 422", { status: 422, code: "rejected" });
      return base.listUserChatsOfUserPage(userId, opts);
    },
  };
  const globalChatsByUser = new Map([["u1", [{ id: "c1", userId: "u1" }]]]);
  const plan = await buildBackfillPlan({ client: rejecting, userIds: ["u1", "u2"], globalChatsByUser, nowMs: NOW });
  assert.deepEqual(plan.reviews, [{ userId: "u1", reason: "chat_list_failed", status: 422 }]);
  assert.deepEqual(plan.targets.map((t) => t.channelUserId), ["u2"]);

  const flaky = { ...base, async listUserChatsOfUserPage() { throw new ChannelTalkApiError("GET 503", { status: 503, code: "server_error", ambiguous: true }); } };
  await assert.rejects(buildBackfillPlan({ client: flaky, userIds: ["u1"], nowMs: NOW }), /503/);
});
