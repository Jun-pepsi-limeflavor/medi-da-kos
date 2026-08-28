import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conversationIdentityId,
  conversationIdentitySchema,
  normalizeEmailIdentity,
} from "../src/lib/schemas/conversation-identity.ts";
import { conversationPatchSchema, conversationSchema } from "../src/lib/schemas/conversation.ts";
import { threadNeedsReply, threadSchema } from "../src/lib/schemas/thread.ts";

const now = "2026-08-29T00:00:00.000Z";

const baseIdentity = {
  kind: "email" as const,
  value: "buyer@example.test",
  classification: "unclassified" as const,
  createdAt: now,
  updatedAt: now,
};

const baseThread = {
  channel: "gmail_thomas" as const,
  sourceAccount: "thomas@medidakoslabs.com",
  providerThreadId: "thread-1",
  readState: "unread" as const,
  triageState: "open" as const,
  linkState: "unlinked" as const,
  side: "unknown" as const,
  sideSource: "account_rule" as const,
  sideHistory: [],
  lastMessageAt: now,
  lastDirection: "in" as const,
  createdAt: now,
  updatedAt: now,
};

test("email identity normalizes with trim and lowercase only", () => {
  assert.equal(normalizeEmailIdentity("  Buyer+Sales@Example.TEST  "), "buyer+sales@example.test");
});

test("identity IDs are deterministic and namespaced", () => {
  assert.equal(conversationIdentityId("email", " Buyer@Example.TEST "), "email:buyer@example.test");
  assert.equal(conversationIdentityId("email", "buyer@example.test"), "email:buyer@example.test");
});

test("Channel Talk identity IDs retain the account and user ID", () => {
  assert.equal(
    conversationIdentityId("channeltalk", "desk-main", "visitor-1"),
    "channeltalk:desk-main:visitor-1",
  );
});

test("an identity is placed in exactly one of review or a conversation", () => {
  assert.doesNotThrow(() => conversationIdentitySchema.parse(baseIdentity));
  assert.doesNotThrow(() => conversationIdentitySchema.parse({
    ...baseIdentity,
    classification: "buyer",
    buyerId: "buyer-1",
    conversationId: "conversation-1",
  }));
  assert.throws(() => conversationIdentitySchema.parse({
    ...baseIdentity,
    classification: "buyer",
    buyerId: "buyer-1",
  }));
  assert.throws(() => conversationIdentitySchema.parse({ ...baseIdentity, conversationId: "conversation-1" }));
  assert.throws(() => conversationIdentitySchema.parse({ ...baseIdentity, unexpected: true }));
});

test("a new conversation link cannot conflict with a legacy buyer or supplier link", () => {
  assert.throws(() => threadSchema.parse({
    ...baseThread,
    buyerId: "buyer-1",
    identityId: "email:buyer@example.test",
    classification: "supplier",
    conversationId: "conversation-1",
  }));
  assert.throws(() => threadSchema.parse({
    ...baseThread,
    supplierId: "supplier-1",
    identityId: "email:supplier@example.test",
    classification: "buyer",
    conversationId: "conversation-1",
  }));
});

test("reply state compares inbound, outbound, and manual completion timestamps", () => {
  assert.equal(threadNeedsReply({}), false);
  assert.equal(threadNeedsReply({ lastInboundAt: "2026-08-29T00:00:00.000Z" }), true);
  assert.equal(threadNeedsReply({
    lastInboundAt: "2026-08-29T00:00:00.000Z",
    lastOutboundAt: "2026-08-29T00:01:00.000Z",
  }), false);
  assert.equal(threadNeedsReply({
    lastInboundAt: "2026-08-29T00:02:00.000Z",
    lastOutboundAt: "2026-08-29T00:01:00.000Z",
    handledThroughAt: "2026-08-29T00:03:00.000Z",
  }), false);
  assert.equal(threadNeedsReply({
    lastInboundAt: "2026-08-29T00:04:00.000Z",
    lastOutboundAt: "2026-08-29T00:01:00.000Z",
    handledThroughAt: "2026-08-29T00:03:00.000Z",
  }), true);
});

test("a new inbound timestamp reopens a manually handled thread", () => {
  assert.equal(threadNeedsReply({
    lastInboundAt: "2026-08-29T00:05:00.000Z",
    handledThroughAt: "2026-08-29T00:04:00.000Z",
  }), true);
});

test("conversation documents and mutation patches keep an explicit safe allowlist", () => {
  const conversation = {
    identityIds: ["email:buyer@example.test"],
    mergedConversationIds: [],
    collaboratorEmails: [],
    workflowState: "active" as const,
    lastActivityAt: now,
    unansweredThreadCount: 0,
    threadCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  assert.doesNotThrow(() => conversationSchema.parse(conversation));
  assert.throws(() => conversationSchema.parse({ ...conversation, grossMargin: 0.4 }));
  assert.doesNotThrow(() => conversationPatchSchema.parse({ workflowState: "done" }));
  assert.doesNotThrow(() => conversationPatchSchema.parse({ ownerEmail: "owner@example.test" }));
  assert.throws(() => conversationPatchSchema.parse({ grossMargin: 0.4 }));
  assert.throws(() => conversationPatchSchema.parse({ unknownField: true }));
});
