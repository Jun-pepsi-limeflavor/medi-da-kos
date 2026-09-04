import { after, test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { register } from "node:module";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!emulatorHost) {
  test("conversation repository transactions require the Firestore Emulator", { skip: true }, () => {});
} else {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT_B64 = Buffer.from(JSON.stringify({
    project_id: "demo-medidakos",
    client_email: "task2-emulator@example.test",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  })).toString("base64");

  register("./esm-alias-loader.mjs", import.meta.url);
  const { getAdminApp, getAdminDb } = await import("../src/lib/firebase-admin.ts");
  const {
    classifyIdentity,
    ConversationEntityNotFoundError,
    ConversationRelationConflictError,
    ConversationNotFoundError,
    patchConversation,
  } = await import("../src/lib/repo/conversations.ts");
  const {
    markThreadHandled,
    ThreadNotConnectedError,
    ThreadNotFoundError,
  } = await import("../src/lib/repo/threads.ts");
  const { listMessagesForThreads } = await import("../src/lib/repo/messages.ts");

  const db = getAdminDb();
  const actor = { email: "admin@example.test" };
  const now = "2026-08-29T00:00:00.000Z";
  const runId = randomUUID();
  const id = (name) => `task2-${runId}-${name}`;
  const conversation = (identityIds = []) => ({
    identityIds,
    mergedConversationIds: [],
    collaboratorEmails: [],
    workflowState: "active",
    lastActivityAt: now,
    unansweredThreadCount: 0,
    threadCount: 1,
    createdAt: now,
    updatedAt: now,
  });
  const thread = (overrides = {}) => ({
    channel: "gmail_thomas",
    sourceAccount: "thomas@medidakoslabs.com",
    providerThreadId: id("provider-thread"),
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
    ...overrides,
  });

  test("repository transactions persist audited success paths, reject conflicts atomically, and preserve provider messages", async () => {
    const patchedConversationId = id("conversation-patch");
    await db.collection("conversations").doc(patchedConversationId).set(conversation());
    await patchConversation(patchedConversationId, {
      ownerEmail: "owner@example.test",
      workflowState: "waiting_customer",
    }, actor);
    const [patchedConversation, patchEvents] = await Promise.all([
      db.collection("conversations").doc(patchedConversationId).get(),
      db.collection("conversations").doc(patchedConversationId).collection("events").get(),
    ]);
    assert.equal(patchedConversation.data().ownerEmail, "owner@example.test");
    assert.equal(patchedConversation.data().workflowState, "waiting_customer");
    assert.deepEqual(patchEvents.docs.map((event) => event.data()).map(({ action, actorEmail, fields }) => ({ action, actorEmail, fields })), [{
      action: "conversation_patched",
      actorEmail: actor.email,
      fields: ["ownerEmail", "workflowState"],
    }]);

    const classifiedIdentityId = id("identity-classified");
    const classifiedBuyerId = id("buyer-classified");
    const classifiedConversationId = id("conversation-classified");
    const classifiedThreadId = id("thread-classified");
    await Promise.all([
      db.collection("conversationIdentities").doc(classifiedIdentityId).set({
        kind: "email", value: "classified@example.test", classification: "unclassified", createdAt: now, updatedAt: now,
      }),
      db.collection("buyers").doc(classifiedBuyerId).set({ name: "Buyer" }),
      db.collection("conversations").doc(classifiedConversationId).set(conversation()),
      db.collection("threads").doc(classifiedThreadId).set(thread({ identityId: classifiedIdentityId })),
    ]);
    await classifyIdentity(classifiedIdentityId, {
      classification: "buyer", buyerId: classifiedBuyerId, conversationId: classifiedConversationId, reason: "verified buyer",
    }, actor);
    const [classifiedIdentity, classifiedThread, classifiedConversation, classificationEvents] = await Promise.all([
      db.collection("conversationIdentities").doc(classifiedIdentityId).get(),
      db.collection("threads").doc(classifiedThreadId).get(),
      db.collection("conversations").doc(classifiedConversationId).get(),
      db.collection("conversations").doc(classifiedConversationId).collection("events").get(),
    ]);
    assert.deepEqual(
      (({ classification, buyerId, conversationId }) => ({ classification, buyerId, conversationId }))(classifiedIdentity.data()),
      { classification: "buyer", buyerId: classifiedBuyerId, conversationId: classifiedConversationId },
    );
    assert.deepEqual(
      (({ classification, conversationId }) => ({ classification, conversationId }))(classifiedThread.data()),
      { classification: "buyer", conversationId: classifiedConversationId },
    );
    assert.equal(classifiedConversation.data().identityIds.includes(classifiedIdentityId), true);
    assert.deepEqual(
      classificationEvents.docs.map((event) => event.data()).map(({ action, actorEmail, reason, identityId, classification, previousClassification }) =>
        ({ action, actorEmail, reason, identityId, classification, previousClassification })),
      [{
        action: "identity_classified", actorEmail: actor.email, reason: "verified buyer", identityId: classifiedIdentityId,
        classification: "buyer", previousClassification: "unclassified",
      }],
    );

    const reviewIdentityId = id("identity-review");
    const reviewConversationId = id("conversation-review");
    const reviewThreadId = id("thread-review");
    await Promise.all([
      db.collection("conversationIdentities").doc(reviewIdentityId).set({
        kind: "email", value: "review@example.test", classification: "buyer", buyerId: classifiedBuyerId,
        conversationId: reviewConversationId, createdAt: now, updatedAt: now,
      }),
      db.collection("conversations").doc(reviewConversationId).set(conversation([reviewIdentityId])),
      db.collection("threads").doc(reviewThreadId).set(thread({
        identityId: reviewIdentityId, classification: "buyer", conversationId: reviewConversationId,
      })),
    ]);
    await classifyIdentity(reviewIdentityId, { classification: "advertising", reason: "not customer work" }, actor);
    const [reviewIdentity, reviewThread, reviewEvents] = await Promise.all([
      db.collection("conversationIdentities").doc(reviewIdentityId).get(),
      db.collection("threads").doc(reviewThreadId).get(),
      db.collection("conversationIdentities").doc(reviewIdentityId).collection("events").get(),
    ]);
    assert.equal(reviewIdentity.data().classification, "advertising");
    assert.equal(reviewIdentity.data().conversationId, undefined);
    assert.equal(reviewThread.data().conversationId, undefined);
    assert.deepEqual(reviewEvents.docs.map((event) => event.data()).map(({ action, actorEmail, reason, classification, previousClassification }) =>
      ({ action, actorEmail, reason, classification, previousClassification })), [{
      action: "identity_classified", actorEmail: actor.email, reason: "not customer work",
      classification: "advertising", previousClassification: "buyer",
    }]);

    const identityId = id("identity-conflict");
    const buyerId = id("buyer");
    const conversationId = id("conversation-conflict");
    const threadId = id("thread-conflict");
    await Promise.all([
      db.collection("conversationIdentities").doc(identityId).set({
        kind: "email", value: "buyer@example.test", classification: "unclassified", createdAt: now, updatedAt: now,
      }),
      db.collection("buyers").doc(buyerId).set({ name: "Buyer" }),
      db.collection("conversations").doc(conversationId).set(conversation(["email:other@example.test"])),
      db.collection("threads").doc(threadId).set(thread({ identityId, supplierId: id("legacy-supplier") })),
    ]);

    await assert.rejects(
      classifyIdentity(identityId, { classification: "buyer", buyerId, conversationId, reason: "link" }, actor),
      ConversationRelationConflictError,
    );
    const [identityAfter, threadAfter, conversationAfter, eventsAfter] = await Promise.all([
      db.collection("conversationIdentities").doc(identityId).get(),
      db.collection("threads").doc(threadId).get(),
      db.collection("conversations").doc(conversationId).get(),
      db.collection("conversations").doc(conversationId).collection("events").get(),
    ]);
    assert.equal(identityAfter.data().classification, "unclassified");
    assert.equal(identityAfter.data().conversationId, undefined);
    assert.equal(threadAfter.data().conversationId, undefined);
    assert.equal(conversationAfter.data().identityIds.includes(identityId), false);
    assert.equal(eventsAfter.empty, true);

    await assert.rejects(
      patchConversation(id("missing-conversation"), { workflowState: "done" }, actor),
      ConversationNotFoundError,
    );
    const missingEntityIdentityId = id("identity-missing-entity");
    const missingEntityConversationId = id("conversation-missing-entity");
    await Promise.all([
      db.collection("conversationIdentities").doc(missingEntityIdentityId).set({
        kind: "email", value: "missing@example.test", classification: "unclassified", createdAt: now, updatedAt: now,
      }),
      db.collection("conversations").doc(missingEntityConversationId).set(conversation()),
    ]);
    await assert.rejects(
      classifyIdentity(
        missingEntityIdentityId,
        { classification: "buyer", buyerId: id("missing-buyer"), conversationId: missingEntityConversationId, reason: "link" },
        actor,
      ),
      ConversationEntityNotFoundError,
    );
    await assert.rejects(markThreadHandled(id("missing-thread"), actor), ThreadNotFoundError);
    const unconnectedThreadId = id("thread-unconnected");
    await db.collection("threads").doc(unconnectedThreadId).set(thread());
    await assert.rejects(markThreadHandled(unconnectedThreadId, actor), ThreadNotConnectedError);

    const handledConversationId = id("conversation-handled");
    const handledThreadId = id("thread-handled");
    const messageId = id("message-provider-record");
    const providerMessage = {
      channel: "gmail_thomas", side: "unknown", sideSource: "account_rule",
      sourceAccount: "thomas@medidakoslabs.com", externalId: "provider-message", providerThreadId: "provider-thread",
      threadKey: handledThreadId, historyId: "1", direction: "in", from: "buyer@example.test", fromName: "Buyer",
      to: ["thomas@medidakoslabs.com"], subject: "Inquiry", bodyText: "Original provider body", attachments: [],
      sentAt: now, parseStatus: "pending", createdAt: now, sourceUpdatedAt: now,
    };
    await Promise.all([
      db.collection("conversations").doc(handledConversationId).set(conversation()),
      db.collection("threads").doc(handledThreadId).set(thread({ conversationId: handledConversationId })),
      db.collection("messages").doc(messageId).set(providerMessage),
    ]);
    await markThreadHandled(handledThreadId, actor);
    const [handledThread, messageAfter, handledEvents] = await Promise.all([
      db.collection("threads").doc(handledThreadId).get(),
      db.collection("messages").doc(messageId).get(),
      db.collection("conversations").doc(handledConversationId).collection("events").get(),
    ]);
    assert.equal(typeof handledThread.data().handledThroughAt, "string");
    assert.deepEqual(messageAfter.data(), providerMessage);
    assert.equal(handledEvents.docs.some((event) => event.data().action === "thread_handled"), true);

    const routeSources = [
      readFileSync("src/app/api/admin/conversations/[id]/route.ts", "utf8"),
      readFileSync("src/app/api/admin/conversation-identities/[identityId]/classify/route.ts", "utf8"),
      readFileSync("src/app/api/admin/threads/[threadKey]/handled/route.ts", "utf8"),
    ].join("\n");
    assert.match(routeSources, /Conversation(Entity)?NotFoundError[\s\S]{0,400}status: 404/);
    assert.match(routeSources, /ConversationRelationConflictError[\s\S]{0,200}status: 409/);
    assert.match(routeSources, /ThreadNotConnectedError[\s\S]{0,200}status: 409/);
  });

  test("conversation message chunks retain every thread message once in chronological order", async () => {
    const threadKeys = Array.from({ length: 31 }, (_, index) => id(`fanout-thread-${index}`));
    await Promise.all(threadKeys.map((threadKey, index) => db.collection("messages").doc(id(`fanout-message-${index}`)).set({
      threadKey,
      sentAt: `2026-08-29T00:${String(30 - index).padStart(2, "0")}:00.000Z`,
    })));

    const messages = await listMessagesForThreads([...threadKeys, threadKeys[0]]);
    assert.equal(messages.length, 31);
    assert.equal(new Set(messages.map((message) => message.id)).size, 31);
    assert.deepEqual(messages.map((message) => message.sentAt), [...messages.map((message) => message.sentAt)].sort());
  });

  after(async () => {
    await getAdminApp().delete();
  });
}
