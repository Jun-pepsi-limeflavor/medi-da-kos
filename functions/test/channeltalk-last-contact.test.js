/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { ChannelTalkApiError } = require("../channeltalk/api");
const {
  changedOtherFields, classifyEvent, createWebhookHandler, describeShape, findTypeRisks, normalizeMode, verifyAuth,
} = require("../channeltalk/last-contact");

// 모두 가상 데이터다.
const NOW = Date.UTC(2026, 9, 19, 9, 0, 30);
const TOKEN = "t".repeat(32);

function message(entity = {}, refers = { user: { id: "u1" } }) {
  return {
    event: "push",
    type: "Message",
    entity: { chatType: "userChat", personType: "user", chatId: "c1", createdAt: NOW - 60_000 + 15_000, plainText: "secret body", ...entity },
    refers,
  };
}

test("모드는 off·observe·on만 받고 나머지는 off다", () => {
  assert.equal(normalizeMode("ON"), "on");
  assert.equal(normalizeMode(" observe "), "observe");
  assert.equal(normalizeMode("true"), "off");
  assert.equal(normalizeMode(undefined), "off");
});

test("인증은 16자 이상 기대값과 정확히 같을 때만 통과한다", () => {
  assert.equal(verifyAuth(TOKEN, TOKEN), true);
  assert.equal(verifyAuth("x", TOKEN), false);
  assert.equal(verifyAuth(undefined, TOKEN), false);
  assert.equal(verifyAuth("short", "short"), false);
  assert.equal(verifyAuth("", ""), false);
});

test("고객·담당자 실제 메시지만 갱신하고 시각은 분 단위로 내린다", () => {
  const customer = classifyEvent(message(), { nowMs: NOW });
  assert.deepEqual(customer, { action: "update", reason: "customer_message", userId: "u1", atMs: Date.UTC(2026, 9, 19, 8, 59) });
  const manager = classifyEvent(message({ personType: "manager", personId: "m9" }, { userChat: { userId: "u1" } }), { nowMs: NOW });
  assert.equal(manager.action, "update");
  assert.equal(manager.reason, "manager_message");
  assert.equal(manager.userId, "u1");
});

test("내부대화·봇·시스템 로그·팀챗은 제외하고, 근거가 부족하면 보류한다", () => {
  const cases = [
    [message({ personType: "bot", options: ["private", "silentToUser"] }), "ignore", "private_note"],
    [message({ personType: "manager", options: ["private"] }), "ignore", "private_note"],
    [message({ personType: "bot" }), "ignore", "bot"],
    [message({ log: { action: "open" } }), "ignore", "system_log"],
    [message({ chatType: "group" }), "ignore", "team_chat"],
    [{ ...message(), type: "UserChat" }, "ignore", "not_message_type"],
    [{ ...message(), event: "update" }, "hold", "unknown_event"],
    [message({ chatType: "other" }), "hold", "unknown_chat_type"],
    [message({ personType: "workflow" }), "hold", "unknown_person_type"],
    [message({ emailId: "e1" }), "hold", "email_unverified"],
    [message({ source: "email" }), "hold", "email_unverified"],
    [message({}, {}), "hold", "no_user_id"],
    [message({}, { user: { id: "u1" }, userChat: { userId: "u2" } }), "hold", "user_ref_mismatch"],
    [message({ createdAt: (NOW - 60_000) * 1000 }), "hold", "invalid_created_at"],
    [message({ createdAt: "1760000000000" }), "hold", "invalid_created_at"],
    [null, "hold", "no_payload"],
  ];
  for (const [payload, action, reason] of cases) {
    assert.deepEqual(
      (({ action: a, reason: r }) => ({ action: a, reason: r }))(classifyEvent(payload, { nowMs: NOW })),
      { action, reason },
      reason,
    );
  }
});

test("형태 요약에는 값(본문·id)이 없고 키 이름과 헤더 이름만 있다", () => {
  const shape = describeShape(message({ options: ["private"] }), { "X-Signature": "abc", "Content-Type": "application/json" });
  const text = JSON.stringify(shape);
  assert.ok(!text.includes("secret body") && !text.includes("u1") && !text.includes("abc"));
  assert.deepEqual(shape.headerNames, ["content-type", "x-signature"]);
  assert.equal(shape.createdAtDigits, 13);
  assert.ok(shape.entityKeys.includes("plainText"));
});

test("타입이 틀린 필드를 찾고, 쓰기 전후 다른 필드 변화를 찾는다", () => {
  assert.deepEqual(findTypeRisks({ moq: "500", businessType: "Agency", lastContactAt: 1, name: "x" }), ["businessType", "moq"]);
  assert.deepEqual(findTypeRisks({ moq: 500, marketCountry: ["미국"], orderCount: null }), []);
  assert.deepEqual(changedOtherFields({ moq: "500", lastContactAt: 1 }, { moq: 0, lastContactAt: 2 }), ["moq"]);
  assert.deepEqual(changedOtherFields({ a: [1] }, { a: [1], lastContactAt: 5 }), []);
});

function fakeApi(users) {
  const state = structuredClone(users);
  const calls = [];
  return {
    state,
    calls,
    async getUser(id) {
      calls.push(["GET", id]);
      return state[id] ? structuredClone(state[id]) : null;
    },
    async patchUser(id, body) {
      calls.push(["PATCH", id, body]);
      state[id].profile = { ...state[id].profile, ...body.profile };
      return structuredClone(state[id]);
    },
  };
}

function handler({ mode = "on", api = fakeApi({}), token = TOKEN } = {}) {
  const logs = [];
  const handle = createWebhookHandler({ getMode: () => mode, getToken: () => token, getApi: () => api, log: (e) => logs.push(e), now: () => NOW });
  return { handle, logs, api };
}
const req = (body, auth = TOKEN) => ({ method: "POST", query: { auth }, headers: {}, body });

test("인증되지 않은 요청과 off 모드는 아무것도 하지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: {} } });
  const h = handler({ api });
  assert.equal((await h.handle(req(message(), "wrong"))).status, 401);
  assert.equal((await h.handle({ ...req(message()), method: "GET" })).status, 405);
  assert.equal((await handler({ api, token: "" }).handle(req(message(), ""))).status, 401);
  assert.equal((await handler({ api, mode: "off" }).handle(req(message()))).body, "off");
  assert.equal((await handler({ api, mode: "garbage" }).handle(req(message()))).body, "off");
  assert.deepEqual(api.calls, []);
});

test("observe 모드는 판정과 형태만 남기고 Channel을 호출하지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: {} } });
  const h = handler({ api, mode: "observe" });
  await h.handle(req(message()));
  assert.deepEqual(api.calls, []);
  assert.equal(h.logs[0].outcome, "observed");
  assert.equal(h.logs[0].action, "update");
  assert.ok(!JSON.stringify(h.logs).includes("secret body"));
});

test("on 모드는 lastContactAt 하나만 보내고, 같거나 오래된 이벤트로는 되돌리지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500, name: "Kim" } } });
  const h = handler({ api });
  await h.handle(req(message()));
  const patches = api.calls.filter(([k]) => k === "PATCH");
  assert.deepEqual(patches[0][2], { profile: { lastContactAt: Date.UTC(2026, 9, 19, 8, 59) } });
  assert.equal(h.logs.at(-1).outcome, "updated");

  await h.handle(req(message()));
  await h.handle(req(message({ createdAt: NOW - 3_600_000 })));
  assert.equal(api.calls.filter(([k]) => k === "PATCH").length, 1);
  assert.deepEqual(h.logs.slice(-2).map((l) => l.skipReason), ["not_newer", "not_newer"]);
  assert.equal(api.state.u1.profile.lastContactAt, Date.UTC(2026, 9, 19, 8, 59));
  assert.equal(api.state.u1.profile.moq, 500);
});

test("타입이 틀린 필드가 있거나 고객이 없거나 통합됐으면 쓰지 않는다", async () => {
  const api = fakeApi({
    u1: { id: "u1", profile: { moq: "TBD" } },
    u2: { id: "u2", type: "unified", unifiedId: "u3", profile: {} },
  });
  const h = handler({ api });
  await h.handle(req(message()));
  await h.handle(req(message({}, { user: { id: "u2" } })));
  await h.handle(req(message({}, { user: { id: "u9" } })));
  assert.deepEqual(h.logs.map((l) => l.skipReason), ["type_risk", "user_unified", "user_missing"]);
  assert.deepEqual(h.logs[0].fields, ["moq"]);
  assert.equal(api.calls.filter(([k]) => k === "PATCH").length, 0);
});

test("쓰기 후 다른 필드가 바뀌면 경고하고, 이 인스턴스는 이후 쓰지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500 } }, u2: { id: "u2", profile: {} } });
  const coercing = {
    ...api,
    async patchUser(id, body) {
      const user = await api.patchUser(id, body);
      user.profile.moq = 0;
      return user;
    },
  };
  const h = handler({ api: coercing });
  await h.handle(req(message()));
  assert.equal(h.logs[0].outcome, "alert");
  assert.deepEqual(h.logs[0].fields, ["moq"]);
  await h.handle(req(message({}, { user: { id: "u2" } })));
  assert.equal(h.logs[1].mode, "observe");
  assert.equal(api.calls.filter(([k, id]) => k === "PATCH" && id === "u2").length, 0);
});

test("API 오류는 재시도하지 않고 200으로 기록만 한다", async () => {
  const failing = { async getUser() { throw new ChannelTalkApiError("GET 503", { code: "server_error", ambiguous: true }); }, async patchUser() {} };
  const h = handler({ api: failing });
  const res = await h.handle(req(message()));
  assert.equal(res.status, 200);
  assert.deepEqual([h.logs[0].outcome, h.logs[0].skipReason], ["error", "server_error"]);
});

test("수신 함수는 아직 index.js에서 내보내지 않고, 단일 인스턴스·공개 호출·기본 off로 설정돼 있다", () => {
  const index = readFileSync(path.join(__dirname, "../index.js"), "utf8");
  assert.doesNotMatch(index, /last-contact/);
  const trigger = readFileSync(path.join(__dirname, "../channeltalk/last-contact-trigger.js"), "utf8");
  assert.match(trigger, /maxInstances: 1/);
  assert.match(trigger, /concurrency: 1/);
  assert.match(trigger, /CHANNELTALK_LAST_CONTACT_MODE", \{ default: "off" \}/);
  const { channelTalkLastContactWebhook } = require("../channeltalk/last-contact-trigger");
  assert.equal(typeof channelTalkLastContactWebhook, "function");
});
