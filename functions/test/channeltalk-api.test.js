/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ChannelTalkApiError, createChannelTalkApi } = require("../channeltalk/api");

function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, init) => {
    calls.push({ url, ...init });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    const { status = 200, body = {}, headers = {} } = next || {};
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (name) => headers[name.toLowerCase()] ?? null },
      text: async () => (body === null ? "" : JSON.stringify(body)),
    };
  };
  return { impl, calls };
}

function api(responses) {
  const fetch = fakeFetch(responses);
  return { client: createChannelTalkApi({ accessKey: "k", accessSecret: "s", version: "2026-06-01", fetchImpl: fetch.impl }), calls: fetch.calls };
}

test("인증 헤더와 Channel-Version을 붙이고 응답 객체를 꺼낸다", async () => {
  const { client, calls } = api([{ body: { user: { id: "u1" } } }]);
  assert.deepEqual(await client.getUser("u1"), { id: "u1" });
  assert.equal(calls[0].url, "https://api.channel.io/open/users/u1");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].headers["x-access-key"], "k");
  assert.equal(calls[0].headers["x-access-secret"], "s");
  assert.equal(calls[0].headers["Channel-Version"], "2026-06-01");
});

test("필수 설정이 없으면 만들지 않는다", () => {
  assert.throws(() => createChannelTalkApi({ accessKey: "", accessSecret: "s", version: "2026-06-01", fetchImpl: () => {} }));
  assert.throws(() => createChannelTalkApi({ accessKey: "k", accessSecret: "s", version: "5", fetchImpl: () => {} }));
});

test("조회 404는 null", async () => {
  const { client } = api([{ status: 404, body: { type: "NOT_FOUND" } }, { status: 404 }, { status: 404 }]);
  assert.equal(await client.getUser("missing"), null);
  assert.equal(await client.getUserByMemberId("missing"), null);
  assert.equal(await client.getUserChat("missing"), null);
});

test("memberId 경로는 @를 붙이고 인코딩한다", async () => {
  const { client, calls } = api([{ body: { user: { id: "u1" } } }]);
  await client.upsertMember("uid/1", { profile: { firebaseUid: "uid/1" } });
  assert.equal(calls[0].url, "https://api.channel.io/open/users/@uid%2F1");
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].body), { profile: { firebaseUid: "uid/1" } });
});

test("리드 생성은 profile JSON 문자열을 form으로 보낸다", async () => {
  const { client, calls } = api([{ body: { user: { id: "lead1" } } }]);
  const lead = await client.createLead({ email: "buyer@example.com" });
  assert.equal(lead.id, "lead1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.deepEqual(JSON.parse(new URLSearchParams(calls[0].body).get("profile")), { email: "buyer@example.com" });
});

test("내부대화는 private + silentToUser와 봇 이름으로 보낸다", async () => {
  const { client, calls } = api([{ body: { message: { id: "m1" } } }]);
  const message = await client.sendPrivateNote("chat1", "본문", "웹 접수");
  assert.equal(message.id, "m1");
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/open/user-chats/chat1/messages");
  assert.equal(url.searchParams.get("botName"), "웹 접수");
  assert.deepEqual(JSON.parse(calls[0].body), { plainText: "본문", options: ["private", "silentToUser"] });
});

test("상담 열기는 PUT과 봇 이름", async () => {
  const { client, calls } = api([{ body: { userChat: { id: "chat1", state: "opened" } } }]);
  await client.openUserChat("chat1", "웹 접수");
  assert.equal(calls[0].method, "PUT");
  assert.equal(new URL(calls[0].url).pathname, "/open/user-chats/chat1/open");
});

test("상담 목록 조회는 제공하지 않는다(initial 상담이 목록에 나오지 않아 복구에 쓸 수 없음)", () => {
  const { client } = api([]);
  assert.equal(client.listAllUserChats, undefined);
  assert.equal(client.listUserChatsPage, undefined);
});

test("메시지 목록: 같은 커서가 반복되면 멈춘다", async () => {
  const { client } = api([
    { body: { messages: [{ id: "m1" }], nextCursor: "c1", hasNext: true } },
    { body: { messages: [{ id: "m2" }], nextCursor: "c1", hasNext: true } },
  ]);
  assert.deepEqual((await client.listAllMessages("chat1")).map((m) => m.id), ["m1", "m2"]);
});

test("메시지 목록도 페이지를 따라간다", async () => {
  const { client } = api([
    { body: { messages: [{ id: "m1" }], nextCursor: "x", hasNext: true } },
    { body: { messages: [{ id: "m2" }] } },
  ]);
  assert.deepEqual((await client.listAllMessages("chat1")).map((m) => m.id), ["m1", "m2"]);
});

async function errorOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
}

test("4xx는 확실한 실패, 404는 not_found", async () => {
  const { client } = api([{ status: 400 }, { status: 404 }]);
  const bad = await errorOf(client.createUserChat("u1"));
  assert.ok(bad instanceof ChannelTalkApiError);
  assert.equal(bad.ambiguous, false);
  assert.equal(bad.status, 400);
  const missing = await errorOf(client.patchUser("u1", { profile: {} }));
  assert.equal(missing.code, "not_found");
  assert.equal(missing.ambiguous, false);
});

test("429·5xx·네트워크·시간 초과는 애매한 실패", async () => {
  const abort = new Error("aborted");
  abort.name = "AbortError";
  const { client } = api([
    { status: 429, headers: { "retry-after": "3" } },
    { status: 503 },
    new Error("socket hang up"),
    abort,
  ]);
  const limited = await errorOf(client.createUserChat("u1"));
  assert.equal(limited.code, "rate_limited");
  assert.equal(limited.ambiguous, true);
  assert.equal(limited.retryAfterSeconds, 3);
  assert.equal((await errorOf(client.createUserChat("u1"))).code, "server_error");
  assert.equal((await errorOf(client.createUserChat("u1"))).code, "network_error");
  const timeout = await errorOf(client.createUserChat("u1"));
  assert.equal(timeout.code, "timeout");
  assert.equal(timeout.ambiguous, true);
});

test("오류 메시지에 인증값·응답 본문을 넣지 않는다", async () => {
  const fetch = fakeFetch([{ status: 400, body: { detail: "leak@example.com" } }]);
  const client = createChannelTalkApi({ accessKey: "KEY-123", accessSecret: "TOPSECRET", version: "2026-06-01", fetchImpl: fetch.impl });
  const error = await errorOf(client.patchUser("u1", { profile: { email: "leak@example.com" } }));
  assert.equal(error.message, "PATCH /open/users/u1 400");
  for (const value of ["leak@example.com", "KEY-123", "TOPSECRET"]) assert.ok(!error.message.includes(value), value);
});
