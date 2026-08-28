import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);
const {
  identityClassificationEvent,
  projectConversation,
  projectConversationIdentity,
  projectConversationMessage,
  projectConversationRollup,
  projectConversationThread,
} = await import("../src/lib/repo/conversations.ts");

const now = "2026-08-29T00:00:00.000Z";

const conversation = {
  identityIds: ["email:buyer@example.test"],
  mergedConversationIds: [],
  collaboratorEmails: [],
  workflowState: "active",
  lastActivityAt: now,
  unansweredThreadCount: 0,
  threadCount: 1,
  createdAt: now,
  updatedAt: now,
  grossMargin: 0.4,
  supplierPrice: 12,
};

const thread = {
  channel: "gmail_thomas",
  sourceAccount: "thomas@medidakoslabs.com",
  providerThreadId: "thread-1",
  readState: "unread",
  triageState: "open",
  linkState: "unlinked",
  side: "unknown",
  sideSource: "account_rule",
  sideHistory: [],
  lastMessageAt: now,
  lastDirection: "in",
  createdAt: now,
  updatedAt: now,
  grossMargin: 0.4,
};

const message = {
  channel: "gmail_thomas",
  side: "unknown",
  sideSource: "account_rule",
  sourceAccount: "thomas@medidakoslabs.com",
  externalId: "message-1",
  providerThreadId: "thread-1",
  threadKey: "gmail_thomas:thomas@medidakoslabs.com:thread-1",
  historyId: "1",
  direction: "in",
  from: "buyer@example.test",
  fromName: "Buyer",
  to: ["thomas@medidakoslabs.com"],
  subject: "Inquiry",
  bodyText: "Cost is $12",
  attachments: [{ filename: "price.xlsx", mimeType: "application/vnd.ms-excel", size: 1, attachmentId: "a-1" }],
  sentAt: now,
  parseStatus: "pending",
  createdAt: now,
  sourceUpdatedAt: now,
  extraction: { supplierPrice: 12 },
  grossMargin: 0.4,
};

test("conversation responses are explicit safe DTOs, not Firestore document spreads", () => {
  const payload = {
    detail: projectConversation("conversation-1", conversation),
    rollup: projectConversationRollup("conversation-1", conversation),
    identity: projectConversationIdentity("email:buyer@example.test", {
      kind: "email",
      value: "buyer@example.test",
      classification: "unclassified",
      createdAt: now,
      updatedAt: now,
      supplierPrice: 12,
    }),
    thread: projectConversationThread("thread-1", thread),
    message: projectConversationMessage("message-1", message),
  };
  const serialized = JSON.stringify(payload);

  assert.equal(serialized.includes("grossMargin"), false);
  assert.equal(serialized.includes("supplierPrice"), false);
  assert.equal(serialized.includes("bodyText"), false);
  assert.equal(serialized.includes("attachments"), false);
  assert.equal(serialized.includes("extraction"), false);
  assert.equal(payload.message.subject, "Inquiry");
});

test("every review classification produces an actor/reason/action audit payload", () => {
  for (const classification of ["unclassified", "internal", "advertising"] as const) {
    assert.deepEqual(identityClassificationEvent({
      actorEmail: "admin@example.test",
      reason: "reviewed",
      at: now,
      identityId: "email:buyer@example.test",
      classification,
      previousClassification: "buyer",
    }), {
      action: "identity_classified",
      actorEmail: "admin@example.test",
      reason: "reviewed",
      at: now,
      identityId: "email:buyer@example.test",
      classification,
      previousClassification: "buyer",
    });
  }

  assert.match(
    readFileSync("src/lib/repo/conversations.ts", "utf8"),
    /tx\.set\(identityRef\.collection\("events"\)\.doc\(\), identityClassificationEvent\(/,
  );
});

test("Task 2 dynamic routes are directly guarded, await params, and safely parse mutation JSON", () => {
  const routes = [
    "src/app/api/admin/conversations/[id]/route.ts",
    "src/app/api/admin/conversation-identities/[identityId]/classify/route.ts",
    "src/app/api/admin/threads/[threadKey]/handled/route.ts",
  ];
  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /return withAdmin\(/);
    assert.match(source, /await context\.params/);
    assert.doesNotMatch(source, /nextUrl\.pathname/);
  }

  for (const route of routes.slice(0, 2)) {
    assert.match(readFileSync(route, "utf8"), /\.json\(\)\.catch\(\(\) => null\)/);
  }
});
