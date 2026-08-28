import assert from "node:assert/strict";
import test from "node:test";
import { buildReplyMime, sendMessage } from "../functions-ingest/gmail.js";

test("reply MIME carries server-derived threading headers and plain text body", () => {
  const raw = buildReplyMime({
    from: "thomas@medidakoslabs.com",
    to: "buyer@example.com",
    subject: "Re: Sample request",
    bodyText: "Hello\n안녕하세요",
    inReplyTo: "<original@example.com>",
    references: "<root@example.com> <original@example.com>",
    messageId: "<reply@medidakos.com>",
  });

  assert.match(raw, /From: thomas@medidakoslabs\.com\r\n/);
  assert.match(raw, /To: buyer@example\.com\r\n/);
  assert.match(raw, /Subject: Re: Sample request\r\n/);
  assert.match(raw, /In-Reply-To: <original@example\.com>\r\n/);
  assert.match(raw, /References: <root@example\.com> <original@example\.com>\r\n/);
  assert.doesNotMatch(raw, /Hello\n안녕하세요/);
  assert.match(raw, /Content-Transfer-Encoding: base64/);
});

test("sendMessage posts only Gmail's raw message and stored thread ID", async () => {
  const previousFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: "sent-1", threadId: "thread-1", historyId: "h-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await sendMessage("token-not-logged", {
      raw: "From: a@example.com\r\n\r\nbody",
      threadId: "thread-1",
    });
    assert.deepEqual(result, { id: "sent-1", threadId: "thread-1", historyId: "h-1" });
    assert.equal(request.url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(request.init.headers.Authorization, "Bearer token-not-logged");
    const payload = JSON.parse(request.init.body);
    assert.equal(payload.threadId, "thread-1");
    assert.equal(Buffer.from(payload.raw, "base64url").toString("utf8"), "From: a@example.com\r\n\r\nbody");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

