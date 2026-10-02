/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ChannelTalkApiError } = require("../channeltalk/api");
const { emailKey, normalizeEmail } = require("../channeltalk/email");
const { applyIdentityRecord, applyUnifiedRecord } = require("../channeltalk/identity");
const { PreClaimError, handleTriggerEvent, processSubmission, runRetryBatch } = require("../channeltalk/processor");
const { decideClaim, isRetryDue, syncDocId } = require("../channeltalk/sync-state");

const T0 = Date.parse("2026-10-02T01:00:00.000Z");
const CONFIG = {
  enabled: true,
  internalDomains: ["techasset.co.kr", "medidakoslabs.com", "medidakos.com"],
  testDomain: "techasset.co.kr",
  botName: "웹 접수",
  noteMaxLength: 4000,
};

function clock(start = T0) {
  let now = start;
  const fn = () => now;
  fn.advance = (ms) => { now += ms; };
  return fn;
}

/** store.js와 같은 인터페이스의 메모리 구현. 처리권 판정은 실제 decideClaim을 쓴다. */
function fakeStore(sources = {}) {
  const sync = new Map();
  const identities = new Map();
  const calls = [];
  const failures = {};
  const maybeFail = (name) => {
    if (failures[name] && failures[name]() === true) throw new Error(`${name} failed`);
  };
  return {
    sync,
    identities,
    sources,
    calls,
    failures,
    async claim(input) {
      maybeFail("claim");
      const key = syncDocId(input.source, input.docId);
      const existing = sync.get(key) || null;
      const decision = decideClaim({ ...input, existing });
      if (decision.create) sync.set(key, structuredClone(decision.create));
      if (decision.patch) sync.set(key, { ...existing, ...decision.patch });
      return { action: decision.action, doc: structuredClone(sync.get(key) || existing) };
    },
    async getSync(source, docId) {
      return structuredClone(sync.get(syncDocId(source, docId)) || null);
    },
    async updateSync(source, docId, patch, nowMs) {
      if (failures.updateSync && failures.updateSync(patch) === true) throw new Error("updateSync failed");
      const key = syncDocId(source, docId);
      const doc = structuredClone(sync.get(key));
      for (const [field, value] of Object.entries({ ...patch, updatedAt: nowMs })) {
        if (field.startsWith("steps.")) doc.steps[field.slice(6)] = value;
        else doc[field] = value;
      }
      sync.set(key, doc);
    },
    async getSourceDoc(source, docId) {
      return structuredClone((sources[source] || {})[docId] || null);
    },
    async getUserDoc(uid) {
      maybeFail("getUserDoc");
      return structuredClone((sources.users || {})[uid] || null);
    },
    async listOrdersForUid(uid) {
      return Object.entries(sources.orders || {})
        .filter(([, order]) => order.uid === uid)
        .map(([id, order]) => ({ id, isTest: order.isTest === true, createdAt: order.createdAt || null }));
    },
    async getMapping(email) {
      return structuredClone(identities.get(emailKey(email)) || null);
    },
    async recordIdentity({ email, channelUserId, origin, uid = null, missingIds = [], unified = {} }) {
      const key = emailKey(email);
      if (!key || !channelUserId) return null;
      const doc = identities.get(key);
      const fields = applyIdentityRecord(doc ? structuredClone(doc) : null, { channelUserId, origin, uid, missingIds, unified });
      if (!doc) identities.set(key, { email: normalizeEmail(email), ...fields, dupPairs: {}, firstSource: null });
      else Object.assign(doc, fields);
      return structuredClone(identities.get(key));
    },
    async recordUnified({ email, unified = {}, missingIds = [], live = {} }) {
      calls.push("recordUnified");
      const doc = identities.get(emailKey(email));
      if (!doc) return null;
      Object.assign(doc, applyUnifiedRecord(structuredClone(doc), { unified, missingIds, live }));
      return structuredClone(doc);
    },
    async setFirstSource(email, firstSource) {
      const doc = identities.get(emailKey(email));
      if (doc && !doc.firstSource) doc.firstSource = firstSource;
    },
    async setDupPairState(email, key, state, nowMs) {
      identities.get(emailKey(email)).dupPairs[key] = { state, at: nowMs };
    },
    async listRetryDue(nowMs, limit) {
      calls.push("listRetryDue");
      return [...sync.values()]
        .filter((doc) => isRetryDue(doc, nowMs))
        .sort((a, b) => a.nextRetryAt - b.nextRetryAt)
        .slice(0, limit)
        .map((doc) => structuredClone(doc));
    },
  };
}

/** Channel Talk 흉내. 실제 호출은 하지 않는다. failures[method]에 함수를 넣어 실패를 만든다. */
function fakeApi(now) {
  const users = new Map();
  const chats = new Map();
  const calls = [];
  const failures = {};
  let seq = 0;
  const id = (prefix) => `${prefix}${++seq}`;

  async function call(name, args, run) {
    calls.push({ name, args });
    if (failures[name]) {
      const result = failures[name]({ run, args });
      if (result) return result;
    }
    return run();
  }

  function newUser(fields) {
    const user = { id: id("u"), profile: {}, tags: [], ...fields };
    users.set(user.id, user);
    return user;
  }

  return {
    users,
    chats,
    calls,
    failures,
    newUser,
    names: () => calls.map((c) => c.name),
    getUser: (userId) => call("getUser", [userId], async () => structuredClone(users.get(userId) || null)),
    getUserByMemberId: (memberId) => call("getUserByMemberId", [memberId], async () => structuredClone([...users.values()].find((u) => u.memberId === memberId) || null)),
    upsertMember: (memberId, body) => call("upsertMember", [memberId, body], async () => {
      let user = [...users.values()].find((u) => u.memberId === memberId);
      if (!user) user = newUser({ memberId, member: true });
      Object.assign(user.profile, body.profile || {});
      return structuredClone(user);
    }),
    createLead: (profile) => call("createLead", [profile], async () => structuredClone(newUser({ profile: { ...profile }, type: "lead" }))),
    patchUser: (userId, body) => call("patchUser", [userId, body], async () => {
      const user = users.get(userId);
      if (!user) throw new ChannelTalkApiError("PATCH 404", { status: 404, code: "not_found" });
      for (const [key, value] of Object.entries(body.profileOnce || {})) {
        if (user.profile[key] === undefined || user.profile[key] === "") user.profile[key] = value;
      }
      Object.assign(user.profile, body.profile || {});
      if (body.tags) user.tags = [...body.tags];
      return structuredClone(user);
    }),
    createUserChat: (userId) => call("createUserChat", [userId], async () => {
      const chat = { id: id("chat"), userId, state: "initial", createdAt: now(), messages: [] };
      chats.set(chat.id, chat);
      return structuredClone(chat);
    }),
    getUserChat: (chatId) => call("getUserChat", [chatId], async () => structuredClone(chats.get(chatId) || null)),
    listAllMessages: (chatId) => call("listAllMessages", [chatId], async () => structuredClone(chats.get(chatId).messages)),
    sendPrivateNote: (chatId, plainText, botName) => call("sendPrivateNote", [chatId, plainText, botName], async () => {
      const message = { id: id("m"), plainText, options: ["private", "silentToUser"], personType: "bot", botName };
      chats.get(chatId).messages.push(message);
      return structuredClone(message);
    }),
    openUserChat: (chatId, botName) => call("openUserChat", [chatId, botName], async () => {
      const chat = chats.get(chatId);
      chat.state = "opened";
      chat.messages.push({ id: id("log"), log: { action: "open" }, options: ["private", "silentToUser"], botName });
      return structuredClone(chat);
    }),
  };
}

function setup({ sources = {}, config = CONFIG } = {}) {
  const now = clock();
  const store = fakeStore(sources);
  const api = fakeApi(now);
  return { now, store, api, deps: { store, api, config, now } };
}

const contact = {
  companyName: "Acme Beauty",
  email: "buyer@example.com",
  message: "We'd like to develop a serum.",
  businessType: "Existing Beauty Brand",
  referralSource: "Social Media",
  isTest: false,
  status: "submitted",
  createdAt: "2026-10-02T00:59:00.000Z",
};

const ambiguous = () => new ChannelTalkApiError("timeout", { code: "timeout", ambiguous: true });
const rejected = () => new ChannelTalkApiError("400", { status: 400, code: "rejected" });

function syncOf(store, source, docId) {
  return store.sync.get(syncDocId(source, docId));
}

function customerVisibleMessages(api) {
  return [...api.chats.values()].flatMap((chat) => chat.messages).filter((m) => !(m.options || []).includes("private"));
}

test("Contact 정상: 브라우저 고객 → 프로필 → 상담 → 내부대화 → 열기", async () => {
  const { api, store, deps } = setup({ sources: { contact: {} } });
  const anon = api.newUser({ type: "lead" });
  const data = { ...contact, channelUserId: anon.id };
  store.sources.contact.c1 = structuredClone(data);

  const result = await processSubmission({ source: "contact", docId: "c1", data, deps });
  assert.deepEqual(result, { outcome: "success" });

  const sync = syncOf(store, "contact", "c1");
  assert.equal(sync.status, "success");
  assert.equal(sync.identitySource, "browser");
  assert.equal(sync.channelUserId, anon.id);
  assert.deepEqual(sync.steps, { identity: "done", profile: "done", chat: "done", note: "done", open: "done", dupTag: "skipped" });
  assert.equal(sync.attempts, 1);
  assert.equal(sync.leaseUntil, null);
  assert.equal(sync.nextRetryAt, null);
  assert.equal(sync.noteParts, 1);
  assert.equal(sync.possibleOrphanChat, false);
  assert.equal(api.chats.size, 1);

  assert.equal(api.users.get(anon.id).profile.email, "buyer@example.com");
  assert.equal(api.users.get(anon.id).profile.firstSource, "contact");
  const chat = api.chats.get(sync.userChatId);
  assert.equal(chat.state, "opened");
  assert.equal(chat.messages[0].botName, "웹 접수");
  assert.ok(chat.messages[0].plainText.startsWith("[Contact 문의] Acme Beauty · buyer@example.com"));
  assert.ok(chat.messages[0].plainText.endsWith("기록: contact/c1"));
  assert.deepEqual(customerVisibleMessages(api), []);
  assert.equal(store.identities.get(emailKey("buyer@example.com")).channelUserId, anon.id);
  assert.deepEqual(store.sources.contact.c1, data); // 원본 제출은 바뀌지 않는다
});

test("Contact: 브라우저 id가 없고 매핑도 없으면 서버 리드 + [연동 참고]", async () => {
  const { api, store, deps } = setup();
  await processSubmission({ source: "contact", docId: "c2", data: contact, deps });
  const sync = syncOf(store, "contact", "c2");
  assert.equal(sync.identitySource, "server_lead");
  assert.equal(sync.possibleOrphanLead, false);
  assert.ok(sync.leadCreateStartedAt);
  assert.deepEqual(api.calls.find((c) => c.name === "createLead").args[0], { email: "buyer@example.com" });
  const note = api.chats.get(sync.userChatId).messages[0].plainText;
  assert.equal(note.split("\n")[2], "[연동 참고] 브라우저 고객 식별 없이 접수된 문의입니다.");
});

test("Contact: 매핑이 있으면 그 고객을 쓴다", async () => {
  const { api, store, deps } = setup();
  const known = api.newUser({ type: "lead", profile: { email: "buyer@example.com" } });
  await store.recordIdentity({ email: "buyer@example.com", channelUserId: known.id, origin: "browser" });
  await processSubmission({ source: "contact", docId: "c3", data: contact, deps });
  const sync = syncOf(store, "contact", "c3");
  assert.equal(sync.identitySource, "email_mapping");
  assert.equal(sync.channelUserId, known.id);
  assert.ok(!api.names().includes("createLead"));
});

test("Contact: 브라우저 고객에 다른 이메일이 있으면 덮어쓰지 않는다", async () => {
  const { api, store, deps } = setup();
  const other = api.newUser({ type: "lead", profile: { email: "someone-else@example.com" } });
  await processSubmission({ source: "contact", docId: "c4", data: { ...contact, channelUserId: other.id }, deps });
  assert.equal(api.users.get(other.id).profile.email, "someone-else@example.com");
  assert.ok(!api.calls.some((c) => c.name === "patchUser" && c.args[0] === other.id));
  assert.equal(syncOf(store, "contact", "c4").identitySource, "server_lead");
});

test("매핑의 대표 고객이 사라졌으면 새 리드를 대표로 바꾸고, 다음 같은 이메일 문의는 새 대표를 재사용한다", async () => {
  const { api, store, deps } = setup();
  await store.recordIdentity({ email: "buyer@example.com", channelUserId: "gone", origin: "browser" });
  await processSubmission({ source: "contact", docId: "c5", data: contact, deps });
  const first = syncOf(store, "contact", "c5");
  assert.equal(first.identitySource, "server_lead");
  assert.equal(first.identityNote, "mapping_user_missing");
  const mapping = store.identities.get(emailKey("buyer@example.com"));
  assert.equal(mapping.channelUserId, first.channelUserId);
  assert.equal(mapping.channelUserOrigin, "server_lead");
  assert.deepEqual(mapping.missingChannelUserIds, ["gone"]);
  assert.deepEqual(mapping.otherChannelUserIds, []);

  await processSubmission({ source: "contact", docId: "c5b", data: contact, deps });
  const second = syncOf(store, "contact", "c5b");
  assert.equal(second.identitySource, "email_mapping");
  assert.equal(second.channelUserId, first.channelUserId);
  assert.equal(second.identityNote, null);
  assert.equal(api.calls.filter((c) => c.name === "createLead").length, 1);
  assert.equal(api.chats.size, 2); // 제출 1건 = 상담 1건
});

test("사라진 대표 회원(memberId 매핑)도 같은 방식으로 정정한다", async () => {
  const { store, deps } = setup();
  await store.recordIdentity({ email: "buyer@example.com", channelUserId: "gone-member", origin: "member", uid: "uid-gone" });
  await processSubmission({ source: "contact", docId: "c5m", data: contact, deps });
  const sync = syncOf(store, "contact", "c5m");
  assert.equal(sync.identityNote, "mapping_user_missing");
  assert.deepEqual(store.identities.get(emailKey("buyer@example.com")).missingChannelUserIds, ["gone-member"]);
});

test("identityNote: 브라우저 고객 없음, 이메일 불일치, 정상은 null", async () => {
  const { api, store, deps } = setup();
  await processSubmission({ source: "contact", docId: "n-missing", data: { ...contact, channelUserId: "no-such-user" }, deps });
  assert.equal(syncOf(store, "contact", "n-missing").identityNote, "browser_user_missing");

  const other = api.newUser({ type: "lead", profile: { email: "someone-else@example.com" } });
  await processSubmission({ source: "contact", docId: "n-mismatch", data: { ...contact, email: "x@example.com", channelUserId: other.id }, deps });
  assert.equal(syncOf(store, "contact", "n-mismatch").identityNote, "browser_email_mismatch");

  const anon = api.newUser({ type: "lead" });
  await processSubmission({ source: "contact", docId: "n-ok", data: { ...contact, email: "y@example.com", channelUserId: anon.id }, deps });
  assert.equal(syncOf(store, "contact", "n-ok").identityNote, null);
  for (const id of ["n-missing", "n-mismatch", "n-ok"]) {
    const note = syncOf(store, "contact", id).identityNote;
    assert.ok(note === null || /^[a-z_]+$/.test(note), "사유 코드만");
  }
});

test("이메일 불일치와 매핑 정정이 겹치면 mapping_user_missing을 남긴다", async () => {
  const { api, store, deps } = setup();
  await store.recordIdentity({ email: "buyer@example.com", channelUserId: "gone", origin: "browser" });
  const other = api.newUser({ type: "lead", profile: { email: "someone-else@example.com" } });
  await processSubmission({ source: "contact", docId: "n-both", data: { ...contact, channelUserId: other.id }, deps });
  assert.equal(syncOf(store, "contact", "n-both").identityNote, "mapping_user_missing");
});

test("로그인 회원의 Contact는 uid로 식별한다", async () => {
  const { store, deps } = setup();
  await processSubmission({ source: "contact", docId: "c6", data: { ...contact, uid: "uid-1" }, deps });
  const sync = syncOf(store, "contact", "c6");
  assert.equal(sync.identitySource, "member");
  assert.equal(store.identities.get(emailKey("buyer@example.com")).memberId, "uid-1");
});

test("일반 isTest 제출은 skipped로 끝나고 Channel Talk을 부르지 않는다", async () => {
  const { api, store, deps } = setup();
  const result = await processSubmission({ source: "contact", docId: "t1", data: { ...contact, isTest: true }, deps });
  assert.equal(result.outcome, "skip");
  assert.equal(syncOf(store, "contact", "t1").skipReason, "is_test");
  assert.deepEqual(api.calls, []);
});

test("허용 테스트 이메일은 isTest여도 연동하고 [TEST]를 붙인다", async () => {
  const { api, store, deps } = setup();
  await processSubmission({ source: "contact", docId: "t2", data: { ...contact, isTest: true, email: "kimbm+chtest-20261002@techasset.co.kr" }, deps });
  const sync = syncOf(store, "contact", "t2");
  assert.equal(sync.status, "success");
  assert.ok(api.chats.get(sync.userChatId).messages[0].plainText.startsWith("[TEST] [Contact 문의]"));
});

test("스위치가 꺼져 있으면 pending(intake_disabled)으로 기록하고, 켜진 뒤 재시도가 처리한다", async () => {
  const off = setup({ config: { ...CONFIG, enabled: false } });
  off.deps.api = null; // 꺼져 있으면 API를 만들지 않는다
  const result = await processSubmission({ source: "contact", docId: "d1", data: contact, deps: off.deps });
  assert.equal(result.outcome, "defer");
  const pending = syncOf(off.store, "contact", "d1");
  assert.equal(pending.status, "pending");
  assert.equal(pending.pendingReason, "intake_disabled");
  assert.equal(pending.attempts, 0);
  assert.equal(pending.nextRetryAt, Date.parse(contact.createdAt));

  const batchOff = await runRetryBatch({ deps: off.deps });
  assert.equal(batchOff.disabled, true);
  assert.deepEqual(off.store.calls, []); // 꺼져 있으면 재시도 대상도 읽지 않는다

  off.store.sources.contact = { d1: contact };
  const on = { ...off.deps, api: fakeApi(off.now), config: CONFIG };
  const batch = await runRetryBatch({ deps: on });
  assert.deepEqual(batch.processed, [{ source: "contact", docId: "d1", outcome: "success" }]);
  const done = syncOf(off.store, "contact", "d1");
  assert.equal(done.pendingReason, null);
  assert.equal(done.attempts, 1);
});

test("재시도는 오래된 순, 한 번에 최대 limit건", async () => {
  const { store, deps, now } = setup({ sources: { contact: {} } });
  const offDeps = { ...deps, config: { ...CONFIG, enabled: false }, api: null };
  for (let i = 0; i < 5; i += 1) {
    const data = { ...contact, createdAt: new Date(T0 - (5 - i) * 60000).toISOString() };
    store.sources.contact[`q${i}`] = data;
    await processSubmission({ source: "contact", docId: `q${i}`, data, deps: offDeps });
  }
  now.advance(1000);
  const batch = await runRetryBatch({ deps, limit: 3 });
  assert.deepEqual(batch.processed.map((p) => p.docId), ["q0", "q1", "q2"]);
  assert.equal(batch.remaining, 0);
  const next = await runRetryBatch({ deps, limit: 3 });
  assert.deepEqual(next.processed.map((p) => p.docId), ["q3", "q4"]);
});

test("상담 생성이 애매하게 실패하면 creating으로 남고, 다음 시도는 목록 조회 없이 새로 만들며 possibleOrphanChat을 남긴다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { c7: contact } } });
  // Channel에서는 상담이 만들어졌지만 응답을 못 받은 경우
  api.failures.createUserChat = ({ run }) => run().then(() => { throw ambiguous(); });
  const first = await processSubmission({ source: "contact", docId: "c7", data: contact, deps });
  assert.equal(first.outcome, "error");
  let sync = syncOf(store, "contact", "c7");
  assert.equal(sync.steps.chat, "creating");
  assert.equal(sync.possibleOrphanChat, false);
  assert.equal(sync.userChatId, null);
  const startedAt = sync.chatCreateStartedAt;
  assert.ok(startedAt);
  const orphanId = [...api.chats.keys()][0];

  delete api.failures.createUserChat;
  now.advance(10 * 60 * 1000);
  const retried = await runRetryBatch({ deps });
  assert.equal(retried.processed[0].outcome, "success");
  sync = syncOf(store, "contact", "c7");
  assert.equal(sync.possibleOrphanChat, true);
  assert.equal(sync.chatCreateStartedAt, startedAt); // 처음 의도 기록 시각을 유지
  assert.notEqual(sync.userChatId, orphanId);
  assert.ok(!api.names().includes("listAllUserChats"));

  // 새 상담에서 내부대화·열기가 정상 진행되고, 남은 상담은 메시지 없는 initial 그대로
  const chat = api.chats.get(sync.userChatId);
  assert.equal(chat.state, "opened");
  assert.ok(chat.messages[0].plainText.endsWith("기록: contact/c7"));
  assert.deepEqual(sync.steps, { identity: "done", profile: "done", chat: "done", note: "done", open: "done", dupTag: "skipped" });
  const orphan = api.chats.get(orphanId);
  assert.equal(orphan.state, "initial");
  assert.deepEqual(orphan.messages, []);
  assert.deepEqual(customerVisibleMessages(api), []);

  // 같은 제출이 다시 실행돼도 상담을 더 만들지 않는다
  const again = await processSubmission({ source: "contact", docId: "c7", data: contact, deps });
  assert.equal(again.outcome, "none");
  now.advance(10 * 60 * 1000);
  assert.deepEqual((await runRetryBatch({ deps })).processed, []);
  assert.equal(api.chats.size, 2);
});

test("상담이 실제로는 안 만들어졌어도 결과를 알 수 없으므로 새로 만들고 possibleOrphanChat을 남긴다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { c8: contact } } });
  api.failures.createUserChat = () => Promise.reject(ambiguous());
  await processSubmission({ source: "contact", docId: "c8", data: contact, deps });
  delete api.failures.createUserChat;
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  const sync = syncOf(store, "contact", "c8");
  assert.equal(api.chats.size, 1);
  assert.equal(sync.status, "success");
  assert.equal(sync.possibleOrphanChat, true);
});

test("상담 생성이 확실히 거부되면(4xx) 단계는 error, 다음 시도에 다시 만들고 possibleOrphanChat은 false", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { c9: contact } } });
  api.failures.createUserChat = () => Promise.reject(rejected());
  await processSubmission({ source: "contact", docId: "c9", data: contact, deps });
  assert.equal(syncOf(store, "contact", "c9").steps.chat, "error");
  delete api.failures.createUserChat;
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  assert.equal(api.chats.size, 1);
  assert.equal(syncOf(store, "contact", "c9").possibleOrphanChat, false);
});

test("내부대화가 일부만 나간 뒤 실패하면, 다음 시도는 나간 부분을 다시 보내지 않는다", async () => {
  const long = { ...contact, message: Array.from({ length: 60 }, (_, i) => `line ${i} ${"m".repeat(50)}`).join("\n") };
  const { api, store, deps, now } = setup({ sources: { contact: { n1: long } }, config: { ...CONFIG, noteMaxLength: 900 } });
  let sent = 0;
  api.failures.sendPrivateNote = () => {
    sent += 1;
    return sent === 2 ? Promise.reject(ambiguous()) : null;
  };
  await processSubmission({ source: "contact", docId: "n1", data: long, deps });
  let sync = syncOf(store, "contact", "n1");
  assert.equal(sync.steps.note, "error");
  const chat = api.chats.get(sync.userChatId);
  assert.equal(chat.messages.length, 1);

  delete api.failures.sendPrivateNote;
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  sync = syncOf(store, "contact", "n1");
  const notes = chat.messages.filter((m) => m.plainText);
  assert.equal(notes.length, sync.noteParts);
  assert.ok(sync.noteParts >= 3);
  assert.equal(new Set(notes.map((m) => m.plainText.split("\n")[0])).size, notes.length);
  notes.forEach((m, i) => assert.ok(m.plainText.split("\n")[0].endsWith(`(${i + 1}/${notes.length})`)));
  assert.deepEqual(sync.noteMessageIds, notes.map((m) => m.id));
});

test("서버 리드 생성 응답을 못 받으면 다음 시도에 possibleOrphanLead를 표시하고 다시 만든다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { l1: contact } } });
  api.failures.createLead = ({ run }) => run().then(() => { throw ambiguous(); });
  await processSubmission({ source: "contact", docId: "l1", data: contact, deps });
  assert.equal(syncOf(store, "contact", "l1").steps.identity, "creating_lead");
  delete api.failures.createLead;
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  const sync = syncOf(store, "contact", "l1");
  assert.equal(sync.possibleOrphanLead, true);
  assert.equal(sync.status, "success");
  assert.equal([...api.users.values()].filter((u) => u.type === "lead").length, 2);
});

test("12회째 시도가 실패하면 failed + nextRetryAt 비움, 이후 재시도 대상에서 빠진다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { f1: contact } } });
  api.failures.patchUser = () => Promise.reject(rejected());
  await processSubmission({ source: "contact", docId: "f1", data: contact, deps });
  for (let attempt = 2; attempt <= 12; attempt += 1) {
    now.advance(10 * 60 * 1000);
    await runRetryBatch({ deps });
    const sync = syncOf(store, "contact", "f1");
    assert.equal(sync.attempts, attempt);
    assert.equal(sync.status, attempt < 12 ? "error" : "failed", `attempt ${attempt}`);
  }
  const failed = syncOf(store, "contact", "f1");
  assert.equal(failed.nextRetryAt, null);
  assert.equal(failed.leaseUntil, null);
  assert.equal(failed.lastError, "profile: rejected 400");
  now.advance(10 * 60 * 1000);
  const after = await runRetryBatch({ deps });
  assert.deepEqual(after.processed, []);
});

test("함수가 멈춰 processing으로 남은 건은 lease 만료 + 안전망 시각 뒤에 다시 처리되고, 12회면 failed", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { s1: contact } } });
  // 처리권만 잡히고 함수가 멈춘 상태
  await store.claim({ source: "contact", docId: "s1", email: contact.email, classification: { sync: true, skipReason: null, flags: { test: false, internal: false } }, enabled: true, nowMs: now() });
  now.advance(4 * 60 * 1000);
  assert.deepEqual((await runRetryBatch({ deps })).processed, []); // lease 유효, 안전망 전
  now.advance(6 * 60 * 1000);
  const batch = await runRetryBatch({ deps });
  assert.equal(batch.processed[0].outcome, "success");
  assert.equal(syncOf(store, "contact", "s1").attempts, 2);

  const stuck = setup({ sources: { contact: { s2: contact } } });
  stuck.store.sync.set(syncDocId("contact", "s2"), { ...syncOf(store, "contact", "s1"), docId: "s2", status: "processing", attempts: 12, leaseUntil: stuck.now() - 1, nextRetryAt: stuck.now() - 1 });
  const result = await processSubmission({ source: "contact", docId: "s2", data: contact, deps: stuck.deps });
  assert.equal(result.outcome, "fail");
  assert.equal(syncOf(stuck.store, "contact", "s2").status, "failed");
  assert.deepEqual(stuck.api.calls, []);
  void api;
});

test("같은 이벤트가 두 번 와도 처리권을 한 번만 잡는다", async () => {
  const { api, store, deps } = setup();
  await processSubmission({ source: "contact", docId: "x1", data: contact, deps });
  const again = await processSubmission({ source: "contact", docId: "x1", data: contact, deps });
  assert.equal(again.outcome, "none");
  assert.equal(api.chats.size, 1);
  assert.equal(syncOf(store, "contact", "x1").attempts, 1);
});

test("담당자가 이미 닫은 상담은 다시 열지 않는다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { o1: contact } } });
  api.failures.openUserChat = () => Promise.reject(ambiguous());
  await processSubmission({ source: "contact", docId: "o1", data: contact, deps });
  const chatId = syncOf(store, "contact", "o1").userChatId;
  api.chats.get(chatId).state = "closed";
  delete api.failures.openUserChat;
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  assert.equal(api.chats.get(chatId).state, "closed");
  assert.equal(syncOf(store, "contact", "o1").status, "success");
});

test("원본 문서가 사라졌으면 재시도는 failed(source_missing)로 끝낸다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: {} } });
  api.failures.patchUser = () => Promise.reject(rejected());
  await processSubmission({ source: "contact", docId: "g1", data: contact, deps });
  now.advance(10 * 60 * 1000);
  const batch = await runRetryBatch({ deps });
  assert.equal(batch.processed[0].outcome, "source_missing");
  const sync = syncOf(store, "contact", "g1");
  assert.equal(sync.status, "failed");
  assert.equal(sync.lastError, "source: source_missing");
});

const user = { uid: "uid-1", email: "jane@example.com", displayName: "Jane Doe", phone: "+1 555 010 0000", country: "United States", companyName: "Acme Beauty", isTest: false };
const brief = { step1: { selection: "skincare" }, step2: { selections: [{ group: "Bottle", items: [] }] }, step4: { volume: "50", unit: "ml", orderQuantity: "5000" } };

test("회원가입: @uid 회원과 프로필, 상담은 만들지 않는다", async () => {
  const { api, store, deps } = setup();
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  const sync = syncOf(store, "users", "uid-1");
  assert.deepEqual(sync.steps, { identity: "done", profile: "done", dupTag: "skipped" });
  const member = [...api.users.values()].find((u) => u.memberId === "uid-1");
  assert.equal(member.profile.name, "Jane Doe");
  assert.deepEqual(member.profile.marketCountry, ["미국"]);
  assert.equal(member.profile.firebaseUid, "uid-1");
  assert.equal(api.chats.size, 0);
});

test("두 번째 주문: 자동 관리 값 갱신과 3번째 줄 안내", async () => {
  const sources = {
    users: { "uid-1": user },
    orders: {
      o1: { uid: "uid-1", title: "Custom ODM — Skin Care", briefSnapshot: brief, isTest: false, createdAt: "2026-09-01T00:00:00.000Z" },
      t1: { uid: "uid-1", title: "test", briefSnapshot: brief, isTest: true, createdAt: "2026-09-15T00:00:00.000Z" },
      o2: { uid: "uid-1", title: "Custom ODM — Skin Care", briefSnapshot: brief, isTest: false, createdAt: "2026-10-02T00:59:00.000Z" },
    },
  };
  const { api, store, deps } = setup({ sources });
  await processSubmission({ source: "orders", docId: "o2", data: sources.orders.o2, deps });
  const sync = syncOf(store, "orders", "o2");
  assert.equal(sync.status, "success");
  const member = [...api.users.values()].find((u) => u.memberId === "uid-1");
  assert.equal(member.profile.orderCount, 2);
  assert.equal(member.profile.lastOrderId, "o2");
  assert.equal(member.profile.briefStatus, "제출 완료");
  const note = api.chats.get(sync.userChatId).messages[0].plainText;
  assert.ok(note.startsWith("[Brief 제출 · 주문 o2]"));
  assert.ok(note.split("\n")[2].startsWith("[연동 참고] 이 고객의 2번째 주문입니다."));
});

test("같은 이메일의 리드와 회원이 따로 있으면 양쪽에 dup-candidate, 담당자가 지우면 다시 붙이지 않는다", async () => {
  const sources = { users: { "uid-1": user }, orders: {} };
  const { api, store, deps, now } = setup({ sources });
  const lead = api.newUser({ type: "lead", tags: ["vip"], profile: { email: user.email } });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "server_lead" });

  // 회원가입 직후에는 판정을 미루고, 다음 재시도에서 L이 여전히 별개(다른 기기)면 기존 정책대로 붙인다.
  assert.equal((await processSubmission({ source: "users", docId: "uid-1", data: user, deps })).outcome, "deferred");
  assert.deepEqual(api.users.get(lead.id).tags, ["vip"]);
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  assert.equal(syncOf(store, "users", "uid-1").status, "success");
  const member = [...api.users.values()].find((u) => u.memberId === "uid-1");
  assert.deepEqual(api.users.get(lead.id).tags, ["vip", "dup-candidate"]);
  assert.deepEqual(member.tags, ["dup-candidate"]);
  const mapping = store.identities.get(emailKey(user.email));
  const pairKey = [lead.id, member.id].sort().join("_");
  assert.equal(mapping.dupPairs[pairKey].state, "tagged");

  api.users.get(lead.id).tags = ["vip"]; // 담당자가 확인 후 지움
  sources.orders.o9 = { uid: "uid-1", title: "T", briefSnapshot: brief, isTest: false, createdAt: "2026-10-02T00:59:00.000Z" };
  await processSubmission({ source: "orders", docId: "o9", data: sources.orders.o9, deps });
  assert.equal(store.identities.get(emailKey(user.email)).dupPairs[pairKey].state, "dismissed");
  assert.deepEqual(api.users.get(lead.id).tags, ["vip"]);
});

test("태그가 20개인 고객에게는 dup-candidate를 붙이지 않고 tag_limit으로 남긴다", async () => {
  const { api, store, deps, now } = setup({ sources: { users: { "uid-1": user } } });
  const full = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const lead = api.newUser({ type: "lead", tags: [...full] });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "server_lead" });
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  assert.deepEqual(api.users.get(lead.id).tags, full);
  const mapping = store.identities.get(emailKey(user.email));
  assert.equal(Object.values(mapping.dupPairs)[0].state, "tag_limit");
});

const quiet = { log: () => {}, error: () => {} };
const once = () => {
  let fired = false;
  return () => {
    if (fired) return false;
    fired = true;
    return true;
  };
};

test("처리권을 잡기 전에 실패하면 PreClaimError를 던지고 기록을 남기지 않는다. Firebase 재실행 때 한 번만 처리", async () => {
  const { api, store, deps } = setup();
  store.failures.claim = once();
  await assert.rejects(handleTriggerEvent({ source: "contact", docId: "p1", data: contact, deps, log: quiet }), PreClaimError);
  assert.equal(syncOf(store, "contact", "p1"), undefined);
  assert.deepEqual(api.calls, []);

  const retried = await handleTriggerEvent({ source: "contact", docId: "p1", data: contact, deps, log: quiet });
  assert.equal(retried.outcome, "success");
  assert.equal(api.chats.size, 1);
  assert.equal(syncOf(store, "contact", "p1").attempts, 1);
});

test("주문의 회원 문서를 읽다 실패해도(처리권 잡기 전) PreClaimError로 Firebase 재실행에 맡긴다", async () => {
  const sources = { users: { "uid-1": user }, orders: { po: { uid: "uid-1", title: "T", briefSnapshot: brief, isTest: false, createdAt: "2026-10-02T00:59:00.000Z" } } };
  const { api, store, deps } = setup({ sources });
  store.failures.getUserDoc = once();
  await assert.rejects(handleTriggerEvent({ source: "orders", docId: "po", data: sources.orders.po, deps, log: quiet }), PreClaimError);
  assert.equal(syncOf(store, "orders", "po"), undefined);
  const retried = await handleTriggerEvent({ source: "orders", docId: "po", data: sources.orders.po, deps, log: quiet });
  assert.equal(retried.outcome, "success");
  assert.equal(api.chats.size, 1);
});

test("처리권을 잡은 뒤의 실패는 던지지 않는다(Firebase 재실행 없음), 기록과 channelTalkRetry가 맡는다", async () => {
  const { api, store, deps } = setup();
  api.failures.patchUser = () => Promise.reject(rejected());
  const result = await handleTriggerEvent({ source: "contact", docId: "p2", data: contact, deps, log: quiet });
  assert.equal(result.outcome, "error");
  const sync = syncOf(store, "contact", "p2");
  assert.equal(sync.status, "error");
  assert.ok(sync.nextRetryAt);
});

test("처리권을 이미 잡은 실행이 있는 동안 같은 이벤트가 다시 와도 처리하지 않는다", async () => {
  const { api, store, deps, now } = setup();
  await store.claim({ source: "contact", docId: "p3", email: contact.email, classification: { sync: true, skipReason: null, flags: { test: false, internal: false } }, enabled: true, nowMs: now() });
  const duplicate = await handleTriggerEvent({ source: "contact", docId: "p3", data: contact, deps, log: quiet });
  assert.equal(duplicate.outcome, "none");
  assert.deepEqual(api.calls, []);
  assert.equal(syncOf(store, "contact", "p3").attempts, 1);
});

test("성공한 뒤 같은 이벤트가 다시 와도(Firebase 재전달) 처리하지 않는다", async () => {
  const { api, deps } = setup();
  await handleTriggerEvent({ source: "contact", docId: "p4", data: contact, deps, log: quiet });
  const callsAfterFirst = api.calls.length;
  const again = await handleTriggerEvent({ source: "contact", docId: "p4", data: contact, deps, log: quiet });
  assert.equal(again.outcome, "none");
  assert.equal(api.calls.length, callsAfterFirst);
  assert.equal(api.chats.size, 1);
});

test("마지막 success 기록만 실패하면 던지지 않고, 재시도가 API 호출 없이 success로 마무리한다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { p5: contact } } });
  store.failures.updateSync = (patch) => patch.status === "success" && !store.failures.done && (store.failures.done = true);
  const first = await handleTriggerEvent({ source: "contact", docId: "p5", data: contact, deps, log: quiet });
  assert.equal(first.outcome, "success_unrecorded");
  assert.equal(syncOf(store, "contact", "p5").status, "processing");
  const callsAfterFirst = api.calls.length;

  now.advance(10 * 60 * 1000);
  const batch = await runRetryBatch({ deps });
  assert.equal(batch.processed[0].outcome, "success");
  assert.equal(api.calls.length, callsAfterFirst);
  assert.equal(api.chats.size, 1);
  assert.equal(syncOf(store, "contact", "p5").status, "success");
});

test("재시도 묶음에서 한 건이 처리권 잡기 전에 실패해도 다음 건은 계속 처리한다", async () => {
  const { store, deps, now } = setup({ sources: { contact: { r1: contact, r2: contact } } });
  const offDeps = { ...deps, config: { ...CONFIG, enabled: false }, api: null };
  await processSubmission({ source: "contact", docId: "r1", data: contact, deps: offDeps });
  await processSubmission({ source: "contact", docId: "r2", data: { ...contact, createdAt: "2026-10-02T00:59:30.000Z" }, deps: offDeps });
  store.failures.claim = once();
  now.advance(1000);
  const batch = await runRetryBatch({ deps });
  assert.deepEqual(batch.processed.map((p) => p.outcome), ["pre_claim_error", "success"]);
  assert.equal(syncOf(store, "contact", "r1").status, "pending"); // 다음 실행이 다시 집는다
  const next = await runRetryBatch({ deps });
  assert.deepEqual(next.processed.map((p) => [p.docId, p.outcome]), [["r1", "success"]]);
});

// T3 실제 검증: 회원 upsert(PUT /open/users/@{memberId})는 profileOnce를 지키지 않고 기존 값을 덮어쓴다.
// 그래서 upsert에는 항상 관리하는 firebaseUid만 보내고, 처음 한 번만 넣는 값은 PATCH profileOnce로만 보낸다.
const ONCE_FIELDS = ["name", "email", "brandCompanyName", "mobileNumber", "marketCountry", "product", "moq", "businessType", "referralSource", "firstSource"];

function assertSafeUpserts(api, uid) {
  const upserts = api.calls.filter((c) => c.name === "upsertMember");
  assert.ok(upserts.length >= 1, "upsert가 호출돼야 한다");
  for (const { args: [memberId, body] } of upserts) {
    assert.equal(memberId, uid);
    assert.deepEqual(Object.keys(body), ["profile"], "upsert 본문에는 profile만");
    assert.ok(!("profileOnce" in body), "upsert에 profileOnce 금지");
    assert.ok(!("tags" in body), "upsert에 tags 금지");
    assert.deepEqual(body.profile, { firebaseUid: uid });
    for (const field of ONCE_FIELDS) assert.ok(!(field in body.profile), `upsert profile에 ${field} 금지`);
  }
  const patches = api.calls.filter((c) => c.name === "patchUser" && c.args[1].profileOnce);
  assert.ok(patches.length >= 1, "처음 한 번만 넣는 값은 PATCH profileOnce로 보낸다");
  for (const { args: [, body] } of patches) {
    for (const field of Object.keys(body.profile || {})) assert.ok(!ONCE_FIELDS.includes(field), `PATCH profile에 ${field} 금지`);
  }
}

test("보호: 회원가입의 upsert에는 firebaseUid만, 처음 한 번만 값은 PATCH profileOnce로", async () => {
  const { api, deps } = setup();
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  assertSafeUpserts(api, "uid-1");
});

test("보호: 주문의 upsert에는 firebaseUid만, 처음 한 번만 값은 PATCH profileOnce로", async () => {
  const sources = { users: { "uid-1": user }, orders: { o1: { uid: "uid-1", title: "T", briefSnapshot: brief, isTest: false, createdAt: "2026-10-02T00:59:00.000Z" } } };
  const { api, deps } = setup({ sources });
  await processSubmission({ source: "orders", docId: "o1", data: sources.orders.o1, deps });
  assertSafeUpserts(api, "uid-1");
});

test("보호: 로그인 회원의 Contact도 upsert에는 firebaseUid만", async () => {
  const { api, deps } = setup();
  await processSubmission({ source: "contact", docId: "cu", data: { ...contact, uid: "uid-7" }, deps });
  assertSafeUpserts(api, "uid-7");
});

// ---- Channel 자동 통합(type: unified) — T4·X12 실제 관찰을 흉내 낸다 ----
// 같은 브라우저 리드가 회원 boot 때 회원에 합쳐진다. 회원 프로필의 빈 칸만 리드 값으로 채워지고,
// 태그는 회원 태그 + 리드 태그로 합쳐지며, 리드는 profile {}·tags null인 unified로 남는다.
function unify(api, fromId, toId) {
  const from = api.users.get(fromId);
  const to = api.users.get(toId);
  for (const [key, value] of Object.entries(from.profile || {})) {
    if (to.profile[key] === undefined || to.profile[key] === "") to.profile[key] = value;
  }
  to.tags = [...new Set([...(to.tags || []), ...(from.tags || [])])];
  Object.assign(from, { type: "unified", unifiedId: toId, memberId: null, profile: {}, tags: null });
}

const tagPatches = (api) => api.calls.filter((c) => c.name === "patchUser" && c.args[1].tags);
const callsFor = (api, name, id) => api.calls.filter((c) => c.name === name && c.args[0] === id);
const mappingOf = (store, email) => store.identities.get(emailKey(email));
const buyer = contact.email;

test("통합: 매핑 대표 L이 M으로 통합됐고 M 이메일이 비었거나 같으면 M을 쓰고 대표를 M으로 바꾼다", async () => {
  for (const memberEmail of [undefined, buyer.toUpperCase()]) {
    const { api, store, deps } = setup();
    const lead = api.newUser({ type: "lead", profile: { email: buyer } });
    const member = api.newUser({ type: "member", member: true, memberId: "uid-m", profile: memberEmail ? { email: memberEmail } : {} });
    await store.recordIdentity({ email: buyer, channelUserId: lead.id, origin: "browser" });
    unify(api, lead.id, member.id);

    await processSubmission({ source: "contact", docId: "u7", data: contact, deps });
    const sync = syncOf(store, "contact", "u7");
    assert.equal(sync.status, "success");
    assert.equal(sync.identitySource, "email_mapping");
    assert.equal(sync.channelUserId, member.id);
    assert.equal(sync.identityNote, "mapping_user_unified");
    assert.equal(api.chats.get(sync.userChatId).userId, member.id);
    assert.equal(callsFor(api, "patchUser", lead.id).length, 0);
    assert.ok(!api.names().includes("createLead"));
    const mapping = mappingOf(store, buyer);
    assert.equal(mapping.channelUserId, member.id);
    assert.deepEqual(mapping.unifiedChannelUserIds, { [lead.id]: member.id });
    assert.deepEqual(mapping.otherChannelUserIds, []);
    assert.deepEqual(mapping.missingChannelUserIds, []);
  }
});

test("통합 + 이메일 안전장치: L이 다른 이메일(B)의 M에 통합됐으면 M에 쓰지 않고 새 리드를 대표로", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: { email: buyer } });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-b", tags: ["vip"], profile: { email: "someone-else@example.com" } });
  await store.recordIdentity({ email: buyer, channelUserId: lead.id, origin: "browser" });
  unify(api, lead.id, member.id);

  await processSubmission({ source: "contact", docId: "u8", data: contact, deps });
  const sync = syncOf(store, "contact", "u8");
  assert.equal(sync.status, "success");
  assert.equal(sync.identitySource, "server_lead");
  assert.equal(sync.identityNote, "mapping_user_unified_other_email");
  assert.notEqual(sync.channelUserId, member.id);
  assert.equal(callsFor(api, "patchUser", member.id).length, 0);
  assert.equal(callsFor(api, "createUserChat", member.id).length, 0);
  assert.equal(api.chats.get(sync.userChatId).userId, sync.channelUserId);
  assert.deepEqual(api.users.get(member.id).tags, ["vip"]);
  assert.equal(api.users.get(member.id).profile.email, "someone-else@example.com");
  const mapping = mappingOf(store, buyer);
  assert.equal(mapping.channelUserId, sync.channelUserId);
  assert.equal(mapping.channelUserOrigin, "server_lead");
  assert.deepEqual(mapping.unifiedChannelUserIds, { [lead.id]: member.id });
  assert.ok(!mapping.otherChannelUserIds.includes(member.id));
  assert.equal(sync.steps.dupTag, "skipped");

  // 다음 같은 이메일 문의는 새 리드를 그대로 쓴다.
  await processSubmission({ source: "contact", docId: "u8b", data: contact, deps });
  assert.equal(syncOf(store, "contact", "u8b").channelUserId, sync.channelUserId);
  assert.equal(api.calls.filter((c) => c.name === "createLead").length, 1);
});

test("통합: 매핑 대표의 unifiedId를 알 수 없으면 리드·상담을 만들지 않고 실패, 12회째 failed", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: { u9: contact } } });
  const lead = api.newUser({ type: "unified", profile: {} });
  await store.recordIdentity({ email: buyer, channelUserId: lead.id, origin: "browser" });
  await processSubmission({ source: "contact", docId: "u9", data: contact, deps });
  assert.equal(syncOf(store, "contact", "u9").lastError, "identity: unified_unresolved");
  for (let attempt = 2; attempt <= 12; attempt += 1) {
    now.advance(10 * 60 * 1000);
    await runRetryBatch({ deps });
  }
  assert.equal(syncOf(store, "contact", "u9").status, "failed");
  assert.ok(!api.names().includes("createLead"));
  assert.equal(api.chats.size, 0);
});

test("통합: 브라우저 id L이 이메일 빈 M에 통합됐으면 M을 브라우저 고객으로 쓰고 이메일을 채운다", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: {} });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-m", profile: {} });
  unify(api, lead.id, member.id);
  await processSubmission({ source: "contact", docId: "u10", data: { ...contact, channelUserId: lead.id }, deps });
  const sync = syncOf(store, "contact", "u10");
  assert.equal(sync.identitySource, "browser");
  assert.equal(sync.channelUserId, member.id);
  assert.equal(sync.identityNote, "browser_user_unified");
  assert.equal(api.users.get(member.id).profile.email, buyer);
  assert.equal(callsFor(api, "patchUser", lead.id).length, 0);
});

test("통합 + 이메일 안전장치: 브라우저 id L이 다른 이메일의 M에 통합됐으면 M을 쓰지 않는다", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: {} });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-b", profile: { email: "someone-else@example.com" } });
  unify(api, lead.id, member.id);
  await processSubmission({ source: "contact", docId: "u11", data: { ...contact, channelUserId: lead.id }, deps });
  const sync = syncOf(store, "contact", "u11");
  assert.equal(sync.identitySource, "server_lead");
  assert.equal(sync.identityNote, "browser_user_unified_other_email");
  assert.equal(callsFor(api, "patchUser", member.id).length, 0);
  assert.equal(callsFor(api, "createUserChat", member.id).length, 0);
});

test("실제 404 대표는 missingChannelUserIds에만 기록하고 unifiedChannelUserIds는 비운다", async () => {
  const { store, deps } = setup();
  await store.recordIdentity({ email: buyer, channelUserId: "gone", origin: "browser" });
  await processSubmission({ source: "contact", docId: "u12", data: contact, deps });
  const mapping = mappingOf(store, buyer);
  assert.deepEqual(mapping.missingChannelUserIds, ["gone"]);
  assert.deepEqual(mapping.unifiedChannelUserIds, {});
});

test("가입 + 같은 브라우저 통합(T4·X12): 판정을 미뤘다가 unified로 기록, 태그 없음, 대표를 M으로 바로 정리", async () => {
  const sources = { users: { "uid-1": user }, contact: {} };
  const { api, store, deps, now } = setup({ sources });
  const lead = api.newUser({ type: "lead", tags: ["zz-l"], profile: { email: user.email } });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "browser" });

  const first = await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  assert.equal(first.outcome, "deferred");
  let sync = syncOf(store, "users", "uid-1");
  assert.equal(sync.status, "pending");
  assert.equal(sync.pendingReason, "dup_check_delayed");
  assert.equal(sync.steps.dupTag, "deferred");
  assert.equal(sync.nextRetryAt, now() + 10 * 60 * 1000);
  assert.equal(sync.leaseUntil, null);
  assert.equal(tagPatches(api).length, 0);
  const member = [...api.users.values()].find((u) => u.memberId === "uid-1");
  assert.equal(mappingOf(store, user.email).channelUserId, lead.id);

  unify(api, lead.id, member.id); // 브라우저가 회원으로 boot
  now.advance(9 * 60 * 1000);
  assert.deepEqual((await runRetryBatch({ deps })).processed, []); // 시각 전에는 집지 않는다
  now.advance(60 * 1000);
  const batch = await runRetryBatch({ deps });
  assert.deepEqual(batch.processed, [{ source: "users", docId: "uid-1", outcome: "success" }]);
  sync = syncOf(store, "users", "uid-1");
  assert.equal(sync.status, "success");
  assert.equal(sync.pendingReason, null);
  assert.equal(sync.steps.dupTag, "done");
  assert.equal(sync.attempts, 2);
  assert.equal(tagPatches(api).length, 0);
  assert.ok(!(api.users.get(member.id).tags || []).includes("dup-candidate"));
  const mapping = mappingOf(store, user.email);
  assert.equal(mapping.dupPairs[[lead.id, member.id].sort().join("_")].state, "unified");
  assert.equal(mapping.channelUserId, member.id);
  assert.equal(mapping.channelUserOrigin, "member");
  assert.deepEqual(mapping.otherChannelUserIds, []);
  assert.deepEqual(mapping.unifiedChannelUserIds, { [lead.id]: member.id });

  // 이어지는 같은 이메일의 비회원 Contact는 memberId 경로로 M을 쓰고 매핑을 바꾸지 않는다.
  const before = structuredClone(mapping);
  const data = { ...contact, email: user.email };
  await processSubmission({ source: "contact", docId: "u30", data, deps });
  const next = syncOf(store, "contact", "u30");
  assert.equal(next.channelUserId, member.id);
  assert.equal(next.steps.dupTag, "skipped");
  const after = mappingOf(store, user.email);
  for (const field of ["channelUserId", "otherChannelUserIds", "unifiedChannelUserIds", "missingChannelUserIds", "dupPairs"]) {
    assert.deepEqual(after[field], before[field], field);
  }
});

test("가입 판정 지연 중 같은 가입 이벤트가 다시 와도 처리하지 않는다", async () => {
  const { api, store, deps } = setup({ sources: { users: { "uid-1": user } } });
  const lead = api.newUser({ type: "lead", profile: { email: user.email } });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "browser" });
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  const callsBefore = api.calls.length;
  const again = await handleTriggerEvent({ source: "users", docId: "uid-1", data: user, deps, log: quiet });
  assert.equal(again.outcome, "none");
  assert.equal(api.calls.length, callsBefore);
  assert.equal(syncOf(store, "users", "uid-1").attempts, 1);
});

test("가입 판정 지연 중 같은 이메일 Contact가 먼저 판정하면, 미뤄 둔 판정은 태그를 더 붙이지 않는다", async () => {
  const sources = { users: { "uid-1": user }, contact: {} };
  const { api, store, deps, now } = setup({ sources });
  const lead = api.newUser({ type: "lead", profile: { email: user.email } }); // 다른 기기 리드
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "browser" });
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  const member = [...api.users.values()].find((u) => u.memberId === "uid-1");

  const data = { ...contact, email: user.email };
  sources.contact.u16 = data;
  await processSubmission({ source: "contact", docId: "u16", data, deps });
  const key = [lead.id, member.id].sort().join("_");
  assert.equal(mappingOf(store, user.email).dupPairs[key].state, "tagged");
  const patched = tagPatches(api).length;
  assert.equal(patched, 2);

  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  assert.equal(syncOf(store, "users", "uid-1").status, "success");
  assert.equal(tagPatches(api).length, patched);
});

test("서로 다른 살아 있는 고객 쌍의 dismissed·tag_limit은 그대로 지킨다", async () => {
  for (const state of ["dismissed", "tag_limit"]) {
    const { api, store, deps } = setup();
    const lead = api.newUser({ type: "lead", profile: { email: buyer } });
    const other = api.newUser({ type: "lead", profile: { email: buyer } });
    await store.recordIdentity({ email: buyer, channelUserId: lead.id, origin: "browser" });
    await store.recordIdentity({ email: buyer, channelUserId: other.id, origin: "browser" });
    const key = [lead.id, other.id].sort().join("_");
    await store.setDupPairState(buyer, key, state, 0);
    await processSubmission({ source: "contact", docId: `u17-${state}`, data: { ...contact, channelUserId: other.id }, deps });
    assert.equal(tagPatches(api).length, 0, state);
    assert.equal(mappingOf(store, buyer).dupPairs[key].state, state);
  }
});

test("tagged였던 쌍이 나중에 같은 고객으로 통합되면 unified로 바꾸고 붙은 태그는 지우지 않는다", async () => {
  const sources = { users: { "uid-1": user }, orders: { o18: { uid: "uid-1", title: "T", briefSnapshot: brief, isTest: false, createdAt: "2026-10-02T00:59:00.000Z" } } };
  const { api, store, deps, now } = setup({ sources });
  const lead = api.newUser({ type: "lead", profile: { email: user.email } });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "browser" });
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  const member = [...api.users.values()].find((u) => u.memberId === "uid-1");
  const key = [lead.id, member.id].sort().join("_");
  assert.equal(mappingOf(store, user.email).dupPairs[key].state, "tagged");
  const patched = tagPatches(api).length;

  unify(api, lead.id, member.id); // 늦은 통합
  await processSubmission({ source: "orders", docId: "o18", data: sources.orders.o18, deps });
  assert.equal(mappingOf(store, user.email).dupPairs[key].state, "unified");
  assert.equal(tagPatches(api).length, patched);
  assert.ok(api.users.get(member.id).tags.includes("dup-candidate"));
});

test("이번 제출의 고객이 다른 이메일의 회원에 합쳐졌으면(공용 브라우저) 중복 판정을 건너뛰고 관계만 기록", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: { email: buyer } });
  const older = api.newUser({ type: "lead", profile: { email: buyer } });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-b", profile: { email: "someone-else@example.com" } });
  await store.recordIdentity({ email: buyer, channelUserId: older.id, origin: "browser" });
  api.failures.openUserChat = ({ run }) => {
    unify(api, lead.id, member.id); // 처리 도중 다른 사람이 같은 브라우저로 로그인
    return run();
  };
  await processSubmission({ source: "contact", docId: "u19", data: { ...contact, channelUserId: lead.id }, deps });
  const sync = syncOf(store, "contact", "u19");
  assert.equal(sync.status, "success");
  assert.equal(sync.steps.dupTag, "skipped");
  assert.equal(tagPatches(api).length, 0);
  const mapping = mappingOf(store, buyer);
  assert.deepEqual(mapping.unifiedChannelUserIds, { [lead.id]: member.id });
  assert.ok(!mapping.otherChannelUserIds.includes(member.id));
  assert.equal(mapping.channelUserId, older.id);
});

test("프로필 단계에서 통합을 발견하면 PATCH 전에 다시 식별하고 M에만 PATCH (attempts 그대로)", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: {} });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-m", profile: {} });
  let leadReads = 0;
  api.failures.getUser = ({ args, run }) => {
    if (args[0] === lead.id && ++leadReads === 2) unify(api, lead.id, member.id); // 식별 직후 통합
    return run();
  };
  await processSubmission({ source: "contact", docId: "u20", data: { ...contact, channelUserId: lead.id }, deps });
  const sync = syncOf(store, "contact", "u20");
  assert.equal(sync.status, "success");
  assert.equal(sync.channelUserId, member.id);
  assert.equal(sync.reidentified, true);
  assert.equal(sync.possibleOrphanLead, false);
  assert.equal(sync.identityNote, "browser_user_unified");
  assert.equal(sync.attempts, 1);
  assert.equal(callsFor(api, "patchUser", lead.id).length, 0);
  assert.ok(callsFor(api, "patchUser", member.id).length >= 1);
  assert.equal(api.chats.get(sync.userChatId).userId, member.id);
});

test("다시 식별은 한 실행에 한 번만: 또 통합되면 user_unified_again으로 실패, attempts 그대로", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: {} });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-m", profile: {} });
  const third = api.newUser({ type: "member", member: true, memberId: "uid-n", profile: {} });
  const reads = {};
  api.failures.getUser = ({ args, run }) => {
    reads[args[0]] = (reads[args[0]] || 0) + 1;
    if (args[0] === lead.id && reads[lead.id] === 2) unify(api, lead.id, member.id);
    if (args[0] === member.id && reads[member.id] === 2) unify(api, member.id, third.id);
    return run();
  };
  const result = await processSubmission({ source: "contact", docId: "u31", data: { ...contact, channelUserId: lead.id }, deps });
  assert.equal(result.outcome, "error");
  const sync = syncOf(store, "contact", "u31");
  assert.equal(sync.lastError, "profile: user_unified_again");
  assert.equal(sync.attempts, 1);
  assert.equal(api.calls.filter((c) => c.name === "patchUser").length, 0);
  assert.equal(api.chats.size, 0);
});

test("상담 재시도에서 통합을 발견하면 다시 식별한 뒤 M에 상담을 만든다", async () => {
  const { api, store, deps, now } = setup({ sources: { contact: {} } });
  const lead = api.newUser({ type: "lead", profile: {} });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-m", profile: {} });
  const data = { ...contact, channelUserId: lead.id };
  store.sources.contact.u21 = data;
  api.failures.createUserChat = () => Promise.reject(rejected());
  await processSubmission({ source: "contact", docId: "u21", data, deps });
  assert.equal(syncOf(store, "contact", "u21").steps.chat, "error");

  delete api.failures.createUserChat;
  unify(api, lead.id, member.id);
  now.advance(10 * 60 * 1000);
  await runRetryBatch({ deps });
  const sync = syncOf(store, "contact", "u21");
  assert.equal(sync.status, "success");
  assert.equal(sync.channelUserId, member.id);
  assert.equal(sync.reidentified, true);
  assert.equal(sync.possibleOrphanChat, false);
  assert.equal(api.chats.get(sync.userChatId).userId, member.id);
  assert.equal(callsFor(api, "createUserChat", member.id).length, 1);
});

test("회원 upsert 결과가 unified면 member_unified로 실패하고 상담을 만들지 않는다", async () => {
  const { api, store, deps } = setup();
  api.newUser({ type: "unified", memberId: "uid-u", unifiedId: "elsewhere", profile: {} });
  await processSubmission({ source: "contact", docId: "u22", data: { ...contact, uid: "uid-u" }, deps });
  assert.equal(syncOf(store, "contact", "u22").lastError, "identity: member_unified");
  assert.equal(api.chats.size, 0);
});

test("unified_missing: 통합 대상 M이 실제 404이고 매핑에 있으면 M을 missing으로, 새 리드를 대표로", async () => {
  const { api, store, deps } = setup();
  const lead = api.newUser({ type: "lead", profile: { email: buyer } });
  const member = api.newUser({ type: "member", member: true, memberId: "uid-m", profile: { email: buyer } });
  await store.recordIdentity({ email: buyer, channelUserId: lead.id, origin: "browser" });
  await store.recordIdentity({ email: buyer, channelUserId: member.id, origin: "member", uid: "uid-m" });
  unify(api, lead.id, member.id);
  api.users.delete(member.id); // 이후 M이 삭제됨
  // memberId 매핑이 있으면 memberId로 찾으므로, 이 경로는 memberId 없는 매핑에서 확인한다.
  mappingOf(store, buyer).memberId = null;
  mappingOf(store, buyer).uid = null;

  await processSubmission({ source: "contact", docId: "u28", data: contact, deps });
  const sync = syncOf(store, "contact", "u28");
  assert.equal(sync.identitySource, "server_lead");
  assert.equal(sync.identityNote, "mapping_user_missing");
  const mapping = mappingOf(store, buyer);
  assert.equal(mapping.channelUserId, sync.channelUserId);
  assert.deepEqual(mapping.unifiedChannelUserIds, { [lead.id]: member.id });
  assert.deepEqual(mapping.missingChannelUserIds, [member.id]);
  assert.deepEqual(mapping.otherChannelUserIds, []);
});

test("통합 기록이 있던 id가 다시 살아 있는 고객으로 식별되면 기록을 지우고 후보에 다시 넣는다", async () => {
  const { api, store, deps } = setup();
  const primary = api.newUser({ type: "lead", profile: { email: buyer } });
  const revived = api.newUser({ type: "lead", profile: { email: buyer } });
  await store.recordIdentity({ email: buyer, channelUserId: primary.id, origin: "browser" });
  mappingOf(store, buyer).unifiedChannelUserIds = { [revived.id]: "somewhere" };

  await processSubmission({ source: "contact", docId: "u29", data: { ...contact, channelUserId: revived.id }, deps });
  const mapping = mappingOf(store, buyer);
  assert.deepEqual(mapping.unifiedChannelUserIds, {});
  assert.deepEqual(mapping.otherChannelUserIds, [revived.id]);
  assert.equal(mapping.dupPairs[[primary.id, revived.id].sort().join("_")].state, "tagged");
});
