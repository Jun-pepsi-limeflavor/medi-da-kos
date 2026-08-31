import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocksToText,
  messageDirection,
  messageDisposition,
  normalizeMessage,
} from "../functions-ingest/channeltalk.js";

const credentials = {
  accessKey: "access-key",
  accessSecret: "access-secret",
  channelVersion: "2024-01-01",
};

const user = { id: "visitor-1", name: "Buyer", profile: { email: "buyer@example.test" } };
const raw = {
  id: "ct-message-1",
  chatKey: "chat-key-1",
  chatId: "chat-id-1",
  personType: "user",
  personId: "visitor-1",
  createdAt: 1656032152433,
  version: 4,
  plainText: "안녕하세요",
  files: [{ id: "file-1", name: "brief.pdf", type: "application/pdf", size: 12 }],
};

test("Channel Talk inbound message uses user identity and UserChat ID for its thread", () => {
  const message = normalizeMessage(raw, { account: "desk-main", user, userId: "visitor-1", userChatId: "user-chat-1" });
  assert.equal(message.docId, "channeltalk:desk-main:ct-message-1");
  assert.equal(message.threadKey, "channeltalk:desk-main:user-chat-1");
  assert.equal(message.providerThreadId, "user-chat-1");
  assert.equal(message.direction, "in");
  assert.equal(message.from, "buyer@example.test");
  assert.equal(message.fromName, "Buyer");
  assert.equal(message.channelTalkUserId, "visitor-1");
  assert.deepEqual(message.to, ["desk-main"]);
  assert.equal(message.side, "unknown");
  assert.equal(message.bodyText, "안녕하세요");
  assert.equal(message.sentAt, new Date(raw.createdAt).toISOString());
  assert.deepEqual(message.attachments, [{
    filename: "brief.pdf", mimeType: "application/pdf", size: 12, attachmentId: "file-1",
  }]);
});

test("Channel Talk manager message is outbound and does not assume visitor email", () => {
  const message = normalizeMessage({ ...raw, id: "ct-message-2", personType: "manager", personId: "manager-1" }, {
    account: "desk-main",
    user: { id: "visitor-1", name: "Buyer" },
    userId: "visitor-1",
    userChatId: "user-chat-1",
  });
  assert.equal(message.direction, "out");
  assert.equal(message.authorRole, "agent");
  assert.equal(message.from, "desk-main");
  assert.deepEqual(message.to, ["channel:user:visitor-1"]);
});

test("visitor ID remains namespaced when the user enrichment has no email", () => {
  const message = normalizeMessage(raw, { account: "desk-main", userId: "visitor-1", userChatId: "user-chat-1" });
  assert.equal(message.from, "channel:user:visitor-1");
  assert.deepEqual(message.to, ["desk-main"]);
});

test("empty events are filtered while meaningful bot messages stay in the customer thread", () => {
  assert.equal(messageDisposition({ ...raw, plainText: "", files: [] }), "skip_empty");
  assert.equal(normalizeMessage({ ...raw, plainText: "", files: [] }, { account: "desk-main", userId: "visitor-1", userChatId: "user-chat-1" }), null);
  assert.equal(messageDisposition({ ...raw, personType: "bot" }), "accepted");
  const bot = normalizeMessage({ ...raw, personType: "bot" }, { account: "desk-main", userId: "visitor-1", userChatId: "user-chat-1" });
  assert.equal(bot.authorRole, "automation");
  assert.equal(bot.threadKey, "channeltalk:desk-main:user-chat-1");
  const automation = normalizeMessage({ ...raw, id: "ct-message-automation", personType: "automation" }, {
    account: "desk-main", userId: "visitor-1", userChatId: "user-chat-1",
  });
  assert.equal(automation.authorRole, "automation");
  assert.ok(normalizeMessage({ ...raw, plainText: "", files: [{ id: "file-only" }] }, { account: "desk-main", userId: "visitor-1", userChatId: "user-chat-1" }));
});

test("enriched profile with company, phone, and memberId extracts clean fromName and email", () => {
  const enrichedUser = {
    id: "visitor-2",
    profile: {
      name: "Janavi Ramakrishnan",
      company: "Glow Lab",
      email: "janaviramakrishnan2000@gmail.com",
      mobileNumber: "+821012345678",
    },
  };
  const message = normalizeMessage(raw, {
    account: "desk-main",
    user: enrichedUser,
    userId: "visitor-2",
    userChatId: "user-chat-2",
  });
  assert.equal(message.from, "janaviramakrishnan2000@gmail.com");
  assert.equal(message.fromName, "Janavi Ramakrishnan (Glow Lab)");
  assert.equal(message.channelTalkUserId, "visitor-2");
});

test("expanded personTypes (lead, member, staff, app, system) map correctly", () => {
  assert.equal(messageDirection({ personType: "lead" }), "in");
  assert.equal(messageDirection({ personType: "member" }), "in");
  assert.equal(messageDirection({ personType: "staff" }), "out");
  assert.equal(messageDirection({ personType: "app" }), "out");
  assert.equal(messageDirection({ personType: "system" }), "out");
});

test("unknown person types fail closed and nested blocks have a text fallback", () => {
  assert.throws(() => messageDirection({ personType: "unknown_person_type" }), /unsupported personType/);
  assert.equal(blocksToText([{ type: "text", value: "A" }, { type: "bullets", blocks: [{ value: "B" }] }]), "A\nB");
});

test("customer identity never falls back to a raw message person ID", () => {
  assert.throws(
    () => normalizeMessage(raw, { account: "desk-main", userChatId: "user-chat-1" }),
    /customer userId is required/,
  );
});

test("Channel Talk credentials are required and are only used as request headers", async () => {
  const { listUserChatsPage } = await import("../functions-ingest/channeltalk.js");
  await assert.rejects(() => listUserChatsPage({ accessKey: "only-one" }), /required/);
  let seen;
  await listUserChatsPage(credentials, {
    baseUrl: "https://channel.test/open/v5",
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return { ok: true, status: 200, json: async () => ({ userChats: [], next: null }) };
    },
  });
  assert.match(seen.url, /state=opened/);
  assert.equal(seen.options.headers["x-access-key"], "access-key");
  assert.equal(seen.options.headers["x-access-secret"], "access-secret");
  assert.equal(seen.options.headers["Channel-Version"], "2024-01-01");
});
