import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage, stripHtml } from "../functions-ingest/outlook.js";

const base = {
  id: "AAMk-message-1",
  conversationId: "conversation-1",
  internetMessageId: "<message-1@example.test>",
  sentDateTime: "2026-08-28T01:02:03Z",
  sender: { emailAddress: { name: "Buyer", address: "buyer@example.test" } },
  toRecipients: [{ emailAddress: { name: "Support", address: "support@example.test" } }],
  subject: "Sample request",
  body: { contentType: "html", content: "<p>Hello&nbsp;<b>there</b></p>" },
  attachments: [{ id: "file-1", name: "brief.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 42 }],
};

test("Outlook HTML body is reduced to plain text and attachment metadata is preserved", () => {
  const message = normalizeMessage(base, { account: "support@example.test" });
  assert.equal(message.bodyText, "Hello there");
  assert.deepEqual(message.attachments, [{
    filename: "brief.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 42,
    attachmentId: "file-1",
  }]);
});

test("Outlook text body and inbound direction use documented sender/recipient fields", () => {
  const message = normalizeMessage({
    ...base,
    body: { contentType: "text", content: "plain body" },
  }, { account: "support@example.test" });
  assert.equal(message.bodyText, "plain body");
  assert.equal(message.direction, "in");
  assert.equal(message.from, "buyer@example.test");
  assert.deepEqual(message.to, ["support@example.test"]);
});

test("our mailbox sender is outbound and conversation keys are namespaced", () => {
  const message = normalizeMessage({
    ...base,
    sender: { emailAddress: { name: "Support", address: "SUPPORT@example.test" } },
    toRecipients: [{ emailAddress: { address: "buyer@example.test" } }],
  }, { account: "support@example.test", side: "unknown" });
  assert.equal(message.direction, "out");
  assert.equal(message.docId, "outlook_support:AAMk-message-1");
  assert.equal(message.threadKey, "outlook_support:support@example.test:conversation-1");
  assert.equal(message.historyId, "<message-1@example.test>");
});

test("HTML stripping does not retain script/style contents", () => {
  assert.equal(stripHtml("<style>.x{}</style><p>A</p><script>secret()</script><p>B</p>"), "A\nB");
});
