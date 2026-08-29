import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listAllChatMessages,
  listAllUserChats,
  listChatMessagesPage,
  listUserChatsPage,
  sendChatMessage,
} from "../functions-ingest/channeltalk.js";

const credentials = { accessKey: "key", accessSecret: "secret", channelVersion: "2024-01-01" };
const response = (json, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });

test("user-chat pagination passes the opaque next cursor as since", async () => {
  const urls = [];
  const result = await listAllUserChats(credentials, {
    baseUrl: "https://channel.test/open/v5",
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) return response({ userChats: [{ id: "chat-1" }], next: "cursor-2" });
      return response({ userChats: [{ id: "chat-2" }], next: null });
    },
  });
  assert.deepEqual(result.userChats.map((chat) => chat.id), ["chat-1", "chat-2"]);
  assert.equal(result.complete, true);
  assert.equal(result.nextCursor, null);
  assert.equal(new URL(urls[0]).searchParams.get("since"), null);
  assert.equal(new URL(urls[0]).searchParams.get("state"), "opened");
  assert.equal(new URL(urls[1]).searchParams.get("since"), "cursor-2");
  assert.equal(new URL(urls[1]).searchParams.get("state"), "opened");
});

test("chat messages pagination is isolated per user chat and empty pages are valid", async () => {
  const urls = [];
  const result = await listAllChatMessages("chat/1", credentials, {
    baseUrl: "https://channel.test/open/v5",
    fetchImpl: async (url) => {
      urls.push(url);
      return response({ messages: [], next: null });
    },
  });
  assert.deepEqual(result.messages, []);
  assert.match(urls[0], /user-chats\/chat%2F1\/messages/);
  const one = await listChatMessagesPage("chat-1", credentials, {
    baseUrl: "https://channel.test/open/v5",
    fetchImpl: async () => response({ messages: [{ id: "m1" }], next: null }),
  });
  assert.deepEqual(one.messages, [{ id: "m1" }]);
});

test("user-chat page keeps related messages without requiring their shape", async () => {
  const page = await listUserChatsPage(credentials, {
    baseUrl: "https://channel.test/open/v5",
    fetchImpl: async () => response({ userChats: [], messages: [{ id: "m1" }], next: null }),
  });
  assert.deepEqual(page.messages, [{ id: "m1" }]);
});

test("sendChatMessage sends formatted payload to user-chat message endpoint", async () => {
  let requestedUrl = "";
  let requestedBody = null;
  let requestedHeaders = null;

  const result = await sendChatMessage(
    "chat-123",
    { plainText: "안녕하세요. 문의주셔서 감사합니다." },
    credentials,
    {
      baseUrl: "https://channel.test/open/v5",
      fetchImpl: async (url, init) => {
        requestedUrl = url;
        requestedBody = JSON.parse(init.body);
        requestedHeaders = init.headers;
        return response({ message: { id: "msg-out-1", chatId: "chat-123" } });
      },
    },
  );

  assert.equal(requestedUrl, "https://channel.test/open/v5/user-chats/chat-123/messages");
  assert.equal(requestedHeaders["x-access-key"], "key");
  assert.equal(requestedHeaders["x-access-secret"], "secret");
  assert.equal(requestedBody.plainText, "안녕하세요. 문의주셔서 감사합니다.");
  assert.deepEqual(requestedBody.blocks, [{ type: "text", value: "안녕하세요. 문의주셔서 감사합니다." }]);
  assert.equal(result.id, "msg-out-1");
});
