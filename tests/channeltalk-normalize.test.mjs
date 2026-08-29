import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocksToText,
  messageDirection,
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

test("Channel Talk inbound message uses user identity and deterministic conversation ID", () => {
  const message = normalizeMessage(raw, { account: "desk-main", user });
  assert.equal(message.docId, "channeltalk:desk-main:ct-message-1");
  assert.equal(message.threadKey, "channeltalk:desk-main:chat-key-1");
  assert.equal(message.direction, "in");
  assert.equal(message.from, "buyer@example.test");
  assert.equal(message.fromName, "Buyer");
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
  });
  assert.equal(message.direction, "out");
  assert.equal(message.from, "desk-main");
  assert.deepEqual(message.to, ["channel:user:visitor-1"]);
});

test("visitor ID remains namespaced when the optional user enrichment is absent", () => {
  const message = normalizeMessage(raw, { account: "desk-main" });
  assert.equal(message.from, "channel:user:visitor-1");
  assert.deepEqual(message.to, ["desk-main"]);
});

test("unknown person types fail closed and nested blocks have a text fallback", () => {
  assert.throws(() => messageDirection({ personType: "system" }), /unsupported personType/);
  assert.equal(blocksToText([{ type: "text", value: "A" }, { type: "bullets", blocks: [{ value: "B" }] }]), "A\nB");
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
