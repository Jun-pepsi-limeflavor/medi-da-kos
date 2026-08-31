import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GMAIL_MAILBOXES,
  ingestChannelTalkAccount,
  ingestGmailAccount,
  initialEpochSeconds,
  parseMailboxList,
  runAllIngestions,
} from "../functions-ingest/index.js";

const fixedNow = Date.parse("2026-08-28T00:00:00.000Z");

test("scheduler mailbox contract maps exactly the six known accounts and rejects unsafe input", () => {
  const value = DEFAULT_GMAIL_MAILBOXES.map((mailbox) => mailbox.account).join(",");
  assert.deepEqual(
    parseMailboxList(value).map((mailbox) => mailbox.channel),
    DEFAULT_GMAIL_MAILBOXES.map((mailbox) => mailbox.channel),
  );
  assert.throws(() => parseMailboxList("thomas@medidakoslabs.com,,hally@medidakoslabs.com"), /blank/);
  assert.throws(() => parseMailboxList("thomas@medidakoslabs.com,THOMAS@MEDIDAKOSLABS.COM"), /Duplicate/);
  assert.throws(() => parseMailboxList("thomas@medidakoslabs.com,secret-value"), /invalid|not approved/);
});

test("initial Gmail lower bound is explicit and defaults to a bounded 30 days", () => {
  assert.equal(initialEpochSeconds("", fixedNow), Math.floor(fixedNow / 1000) - 30 * 24 * 60 * 60);
  assert.equal(initialEpochSeconds("2026-08-01T00:00:00.000Z", fixedNow), Date.parse("2026-08-01T00:00:00.000Z") / 1000);
  assert.throws(() => initialEpochSeconds("not-an-iso-date", fixedNow), /ISO/);
});

test("Gmail advances its cursor only after every fetched message was saved", async () => {
  const stateWrites = [];
  const saved = [];
  const initial = "2026-08-01T00:00:00.000Z";
  const deps = {
    getGmailToken: async () => "token",
    getIngestState: async () => ({ lastEpochSeconds: null }),
    listAllMessageIds: async (_token, { after }) => {
      assert.equal(after, Date.parse(initial) / 1000 - 5);
      return ["m-1", "m-2"];
    },
    getMessage: async (_token, id) => ({ id, internalDate: id === "m-1" ? "1786000000000" : "1786000001000" }),
    normalizeGmailMessage: (raw) => ({ docId: raw.id }),
    saveMessage: async (_db, message) => { saved.push(message.docId); },
    setIngestState: async (_db, key, value) => { stateWrites.push({ key, value }); },
  };

  const count = await ingestGmailAccount({}, "thomas@medidakoslabs.com", {
    initialAfter: initial,
    now: fixedNow,
    deps,
  });
  assert.equal(count, 2);
  assert.deepEqual(saved, ["m-1", "m-2"]);
  assert.equal(stateWrites.length, 1);
  assert.equal(stateWrites[0].key, "thomas@medidakoslabs.com");
  assert.equal(stateWrites[0].value.lastEpochSeconds, 1786000001);

  const failingDeps = {
    ...deps,
    saveMessage: async (_db, message) => {
      if (message.docId === "m-2") throw new Error("write failed");
    },
    setIngestState: async () => { throw new Error("cursor must not advance"); },
  };
  await assert.rejects(
    () => ingestGmailAccount({}, "thomas@medidakoslabs.com", { initialAfter: initial, now: fixedNow, deps: failingDeps }),
    /write failed/,
  );
});

test("a failed mailbox records an error while the next mailbox still runs", async () => {
  const calls = [];
  const failures = [];
  await runAllIngestions({
    db: {},
    gmailMailboxes: [
      { account: "thomas@medidakoslabs.com" },
      { account: "hally@medidakoslabs.com" },
    ],
    outlook: null,
    channelTalk: null,
    initialAfter: "",
    logger: { log() {}, error() {} },
    deps: {
      ingestGmailAccount: async (_db, account) => {
        calls.push(account);
        if (account.startsWith("thomas")) throw new Error("delegation denied");
        return 0;
      },
      recordFailure: async (_db, stateKey, error) => failures.push({ stateKey, message: error.message }),
    },
  });
  assert.deepEqual(calls, ["thomas@medidakoslabs.com", "hally@medidakoslabs.com"]);
  assert.deepEqual(failures, [{ stateKey: "thomas@medidakoslabs.com", message: "delegation denied" }]);
});

test("Channel Talk ingestion keeps same-chatKey user chats in separate threads and caches profiles", async () => {
  const saved = [];
  const stateWrites = [];
  const userFetches = [];
  const chats = [
    { id: "chat-1", userId: "visitor-1" },
    { id: "chat-2", userId: "visitor-1" },
  ];
  const deps = {
    listAllUserChats: async () => ({ userChats: chats }),
    getChannelTalkUser: async (userId) => {
      userFetches.push(userId);
      return { id: userId, name: "Buyer", profile: { email: "buyer@example.test" } };
    },
    listAllChatMessages: async (chatId) => ({ messages: [
      { id: `message-${chatId}`, chatKey: "main", personType: "user", personId: "visitor-1", createdAt: 1656032152433, plainText: `hello ${chatId}` },
      { id: `empty-${chatId}`, chatKey: "main", personType: "user", personId: "visitor-1", createdAt: 1656032152433, plainText: "" },
      { id: `bot-${chatId}`, chatKey: "main", personType: "bot", personId: "bot-1", createdAt: 1656032152433, plainText: "bot" },
    ] }),
    normalizeChannelTalkMessage: (raw, options) => {
      if (raw.personType === "bot" || !raw.plainText) return null;
      return { threadKey: `channeltalk:main:${options.userChatId}`, channelTalkUserId: options.userId, docId: raw.id };
    },
    saveMessage: async (_db, message) => saved.push(message),
    setIngestState: async (_db, key, value) => stateWrites.push({ key, value }),
  };

  const count = await ingestChannelTalkAccount({}, {
    account: "main",
    credentials: { accessKey: "key", accessSecret: "secret", channelVersion: "2024-01-01" },
  }, { deps, now: Date.parse("2026-08-31T00:00:00.000Z") });

  assert.equal(count, 2);
  assert.deepEqual(saved.map((message) => message.threadKey), [
    "channeltalk:main:chat-1",
    "channeltalk:main:chat-2",
  ]);
  assert.deepEqual(userFetches, ["visitor-1"]);
  assert.equal(stateWrites[0].value.filteredCount, 4);
});
