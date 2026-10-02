/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ChannelTalkApiError } = require("../channeltalk/api");
const { emailKey, normalizeEmail } = require("../channeltalk/email");
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
    async recordIdentity({ email, channelUserId, origin, uid = null, missingIds = [] }) {
      const key = emailKey(email);
      if (!key) return null;
      const missing = missingIds.filter((id) => id && id !== channelUserId);
      const doc = identities.get(key);
      if (!doc) {
        identities.set(key, { email: normalizeEmail(email), channelUserId, channelUserOrigin: origin, uid, memberId: uid, otherChannelUserIds: [], missingChannelUserIds: missing, dupPairs: {}, firstSource: null });
      } else {
        if (!doc.channelUserId || missing.includes(doc.channelUserId)) Object.assign(doc, { channelUserId, channelUserOrigin: origin });
        const others = new Set(doc.otherChannelUserIds);
        if (channelUserId !== doc.channelUserId) others.add(channelUserId);
        others.delete(doc.channelUserId);
        missing.forEach((id) => others.delete(id));
        doc.otherChannelUserIds = [...others];
        doc.missingChannelUserIds = [...new Set([...(doc.missingChannelUserIds || []), ...missing])];
        if (uid && !doc.uid) Object.assign(doc, { uid, memberId: uid });
      }
      return structuredClone(identities.get(key));
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
  const { api, store, deps } = setup({ sources });
  const lead = api.newUser({ type: "lead", tags: ["vip"], profile: { email: user.email } });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "server_lead" });

  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
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
  const { api, store, deps } = setup({ sources: { users: { "uid-1": user } } });
  const full = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const lead = api.newUser({ type: "lead", tags: [...full] });
  await store.recordIdentity({ email: user.email, channelUserId: lead.id, origin: "server_lead" });
  await processSubmission({ source: "users", docId: "uid-1", data: user, deps });
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
