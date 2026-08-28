import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage } from "../functions-ingest/gmail.js";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");

const raw = {
  id: "18f0abc",
  threadId: "18f0aaa",
  historyId: "99123",
  internalDate: "1755000000000",
  payload: {
    mimeType: "multipart/alternative",
    headers: [
      { name: "From", value: "Charity <candy@example.com>" },
      { name: "To", value: "thomas@medidakoslabs.com" },
      { name: "Subject", value: "Perfume sample request" },
      { name: "Message-ID", value: "<abc@mail.example.com>" },
    ],
    parts: [
      { mimeType: "text/plain", body: { data: b64("본문입니다") } },
      { mimeType: "text/html", body: { data: b64("<p>본문입니다</p>") } },
    ],
  },
};

const ctx = {
  channel: "gmail_thomas",
  side: "brand",
  sideSource: "account_rule",
  account: "thomas@medidakoslabs.com",
};

test("결정적 문서 ID 를 만든다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.docId, "gmail_thomas:18f0abc");
});

test("발신자 이름과 주소를 나눈다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.from, "candy@example.com");
  assert.equal(m.fromName, "Charity");
});

test("text/plain 을 골라 본문으로 쓴다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.bodyText, "본문입니다");
});

test("text/plain 이 없으면 html 에서 태그를 벗긴다", () => {
  const htmlOnly = {
    ...raw,
    payload: { ...raw.payload, parts: [raw.payload.parts[1]] },
  };
  const m = normalizeMessage(htmlOnly, ctx);
  assert.equal(m.bodyText, "본문입니다");
});

test("파트가 없고 body 에 직접 들어 있는 경우도 읽는다", () => {
  const flat = {
    ...raw,
    payload: {
      mimeType: "text/plain",
      headers: raw.payload.headers,
      body: { data: b64("납작한 본문") },
    },
  };
  assert.equal(normalizeMessage(flat, ctx).bodyText, "납작한 본문");
});

test("내가 보낸 메일이면 direction 이 out 이다", () => {
  const sent = {
    ...raw,
    payload: {
      ...raw.payload,
      headers: [
        { name: "From", value: "Thomas <thomas@medidakoslabs.com>" },
        { name: "To", value: "candy@example.com" },
        { name: "Subject", value: "Re: Perfume sample request" },
      ],
    },
  };
  assert.equal(normalizeMessage(sent, ctx).direction, "out");
});

test("side 근거와 namespaced threadKey 를 싣는다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.side, "brand");
  assert.equal(m.sideSource, "account_rule");
  assert.equal(m.sourceAccount, "thomas@medidakoslabs.com");
  assert.equal(m.providerThreadId, "18f0aaa");
  assert.equal(m.threadKey, "gmail_thomas:thomas@medidakoslabs.com:18f0aaa");
});

test("internalDate 를 ISO 로 바꾼다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.sentAt, new Date(1755000000000).toISOString());
});

test("회신에 필요한 RFC 메타데이터를 원문에서만 보존한다", () => {
  const m = normalizeMessage({
    ...raw,
    payload: {
      ...raw.payload,
      headers: [
        ...raw.payload.headers,
        { name: "In-Reply-To", value: "<parent@example.com>" },
        { name: "References", value: "<root@example.com> <parent@example.com>" },
      ],
    },
  }, ctx);
  assert.equal(m.messageId, "<abc@mail.example.com>");
  assert.equal(m.inReplyTo, "<parent@example.com>");
  assert.equal(m.references, "<root@example.com> <parent@example.com>");
});

import { listAllMessageIds } from "../functions-ingest/gmail.js";

test("두 페이지 조회에서 모든 메시지 ID 를 모은다", async () => {
  let requestCount = 0;
  let secondPageTokenSeen = false;
  const mockFetch = async (url) => {
    requestCount++;
    const urlObj = new URL(url);
    if (requestCount === 1) {
      // 첫 번째 요청: pageToken 없음
      assert.strictEqual(urlObj.searchParams.get("pageToken"), null);
      return {
        ok: true,
        json: async () => ({
          messages: [{ id: "msg1" }, { id: "msg2" }],
          nextPageToken: "token123",
        }),
      };
    } else if (requestCount === 2) {
      // 두 번째 요청: pageToken 있음
      const pageToken = urlObj.searchParams.get("pageToken");
      assert.strictEqual(pageToken, "token123", "두 번째 요청에 nextPageToken이 포함되어야 함");
      secondPageTokenSeen = true;
      return {
        ok: true,
        json: async () => ({
          messages: [{ id: "msg3" }, { id: "msg4" }],
          nextPageToken: null,
        }),
      };
    }
    throw new Error(`Unexpected request ${requestCount}`);
  };

  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    const ids = await listAllMessageIds("fake-token", {});
    assert.deepEqual(ids, ["msg1", "msg2", "msg3", "msg4"]);
    assert.ok(secondPageTokenSeen, "두 번째 요청이 실행되어야 함");
  } finally {
    global.fetch = originalFetch;
  }
});
