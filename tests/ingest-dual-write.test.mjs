import { after, test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { register } from "node:module";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!emulatorHost) {
  test("ingestion dual-write tests require the Firestore Emulator", { skip: true }, () => {});
} else {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT_B64 = Buffer.from(JSON.stringify({
    project_id: "demo-medidakos",
    client_email: "task3-emulator@example.test",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  })).toString("base64");

  register("./esm-alias-loader.mjs", import.meta.url);
  const { getAdminApp, getAdminDb } = await import("../src/lib/firebase-admin.ts");
  const { saveMessage } = await import("../functions-ingest/store.js");
  const { listReviewIdentities } = await import("../src/lib/repo/conversations.ts");
  const { ingestHealthSummary } = await import("../src/lib/repo/ingest-state.ts");
  const { needsReply } = await import("../src/lib/schemas/thread.ts");

  const db = getAdminDb();
  const runId = randomUUID();
  const id = (name) => `task3-${runId}-${name}`;

  test("saveMessage dual-writes deterministic identity, thread timestamps, and conversation rollups idempotently", async () => {
    // Scenario 1: New unclassified message creates identity, thread with lastInboundAt, no conversationId
    const threadKey1 = id("thread-unclassified");
    const email1 = `buyer-${runId}@example.test`;
    const msg1 = {
      docId: id("msg-1"),
      channel: "gmail_thomas",
      side: "brand",
      sideSource: "account_rule",
      sourceAccount: "thomas@medidakoslabs.com",
      externalId: "ext-1",
      providerThreadId: "prov-1",
      threadKey: threadKey1,
      historyId: "h1",
      direction: "in",
      from: email1,
      fromName: "New Buyer",
      to: ["thomas@medidakoslabs.com"],
      subject: "Sample inquiry",
      bodyText: "Hello, I would like to inquire about ODM products.",
      attachments: [],
      sentAt: "2026-08-29T10:00:00.000Z",
    };

    await saveMessage(db, msg1);

    const identityDoc1 = await db.collection("conversationIdentities").doc(`email:${email1}`).get();
    const threadDoc1 = await db.collection("threads").doc(threadKey1).get();
    const messageDoc1 = await db.collection("messages").doc(msg1.docId).get();

    assert.equal(identityDoc1.exists, true);
    assert.equal(identityDoc1.data().classification, "unclassified");
    assert.equal(identityDoc1.data().conversationId, undefined);

    assert.equal(threadDoc1.exists, true);
    assert.equal(threadDoc1.data().identityId, `email:${email1}`);
    assert.equal(threadDoc1.data().classification, "unclassified");
    assert.equal(threadDoc1.data().lastInboundAt, "2026-08-29T10:00:00.000Z");
    assert.equal(needsReply(threadDoc1.data()), true);

    assert.equal(messageDoc1.exists, true);
    assert.equal(messageDoc1.data().parseStatus, "pending");

    // Duplicate poll idempotency: save same message again should not duplicate or change parseStatus
    await db.collection("messages").doc(msg1.docId).update({ parseStatus: "done" });
    await saveMessage(db, msg1);
    const messageDocAfterDuplicate = await db.collection("messages").doc(msg1.docId).get();
    assert.equal(messageDocAfterDuplicate.data().parseStatus, "done");

    // Scenario 2: Known existing buyer with unambiguous conversation attaches automatically
    const buyerId = id("known-buyer");
    const buyerEmail = `known-${runId}@example.test`;
    const convId = id("known-conv");
    await db.collection("buyers").doc(buyerId).set({
      name: "Known Buyer Corp",
      emails: [buyerEmail],
      createdAt: "2026-08-29T00:00:00.000Z",
    });
    await db.collection("conversations").doc(convId).set({
      buyerId,
      identityIds: [],
      mergedConversationIds: [],
      workflowState: "active",
      unansweredThreadCount: 0,
      threadCount: 0,
      lastActivityAt: "2026-08-29T00:00:00.000Z",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    });

    const threadKey2 = id("thread-known-1");
    const msg2 = {
      docId: id("msg-2"),
      channel: "gmail_thomas",
      side: "brand",
      sideSource: "account_rule",
      sourceAccount: "thomas@medidakoslabs.com",
      externalId: "ext-2",
      providerThreadId: "prov-2",
      threadKey: threadKey2,
      historyId: "h2",
      direction: "in",
      from: buyerEmail,
      fromName: "Known Buyer",
      to: ["thomas@medidakoslabs.com"],
      subject: "Known order update",
      bodyText: "Looking forward to sample delivery.",
      attachments: [],
      sentAt: "2026-08-29T11:00:00.000Z",
    };

    await saveMessage(db, msg2);

    const identityDoc2 = await db.collection("conversationIdentities").doc(`email:${buyerEmail}`).get();
    const threadDoc2 = await db.collection("threads").doc(threadKey2).get();
    const convDoc2 = await db.collection("conversations").doc(convId).get();

    assert.equal(identityDoc2.exists, true);
    assert.equal(identityDoc2.data().classification, "buyer");
    assert.equal(identityDoc2.data().buyerId, buyerId);
    assert.equal(identityDoc2.data().conversationId, convId);

    assert.equal(threadDoc2.data().conversationId, convId);
    assert.equal(threadDoc2.data().lastInboundAt, "2026-08-29T11:00:00.000Z");
    assert.equal(needsReply(threadDoc2.data()), true);

    assert.equal(convDoc2.data().unansweredThreadCount, 1);
    assert.equal(convDoc2.data().threadCount, 1);
    assert.equal(convDoc2.data().oldestUnansweredAt, "2026-08-29T11:00:00.000Z");
    assert.equal(convDoc2.data().lastSubject, "Known order update");

    // Scenario 3: Outbound message on threadKey2 satisfies reply, but another thread stays unanswered
    const threadKey3 = id("thread-known-2");
    const msg3 = {
      docId: id("msg-3"),
      channel: "outlook_support",
      side: "brand",
      sideSource: "account_rule",
      sourceAccount: "support@medidakoslabs.com",
      externalId: "ext-3",
      providerThreadId: "prov-3",
      threadKey: threadKey3,
      historyId: "h3",
      direction: "in",
      from: buyerEmail,
      fromName: "Known Buyer",
      to: ["support@medidakoslabs.com"],
      subject: "Support ticket",
      bodyText: "Need urgent tracking info.",
      attachments: [],
      sentAt: "2026-08-29T11:30:00.000Z",
    };
    await saveMessage(db, msg3);

    const convDocWithTwoThreads = await db.collection("conversations").doc(convId).get();
    assert.equal(convDocWithTwoThreads.data().unansweredThreadCount, 2);
    assert.equal(convDocWithTwoThreads.data().threadCount, 2);

    // Now reply to threadKey2 (outbound)
    const replyMsg = {
      docId: id("msg-reply"),
      channel: "gmail_thomas",
      side: "brand",
      sideSource: "account_rule",
      sourceAccount: "thomas@medidakoslabs.com",
      externalId: "ext-reply",
      providerThreadId: "prov-2",
      threadKey: threadKey2,
      historyId: "h4",
      direction: "out",
      from: "thomas@medidakoslabs.com",
      fromName: "Thomas",
      to: [buyerEmail],
      subject: "Re: Known order update",
      bodyText: "Sent sample tracking link.",
      attachments: [],
      sentAt: "2026-08-29T12:00:00.000Z",
    };
    await saveMessage(db, replyMsg);

    const thread2AfterReply = await db.collection("threads").doc(threadKey2).get();
    const thread3StillPending = await db.collection("threads").doc(threadKey3).get();
    const convAfterPartialReply = await db.collection("conversations").doc(convId).get();

    assert.equal(needsReply(thread2AfterReply.data()), false);
    assert.equal(needsReply(thread3StillPending.data()), true);
    assert.equal(convAfterPartialReply.data().unansweredThreadCount, 1);
    assert.equal(convAfterPartialReply.data().oldestUnansweredAt, "2026-08-29T11:30:00.000Z");

    // Scenario 4: Manual handled followed by new inbound reopens thread
    await db.collection("threads").doc(threadKey3).update({
      handledThroughAt: "2026-08-29T13:00:00.000Z",
    });
    const thread3Handled = await db.collection("threads").doc(threadKey3).get();
    assert.equal(needsReply(thread3Handled.data()), false);

    // New inbound at 14:00 on threadKey3
    const newInbound = {
      docId: id("msg-new-inbound"),
      channel: "outlook_support",
      side: "brand",
      sideSource: "account_rule",
      sourceAccount: "support@medidakoslabs.com",
      externalId: "ext-new-inbound",
      providerThreadId: "prov-3",
      threadKey: threadKey3,
      historyId: "h5",
      direction: "in",
      from: buyerEmail,
      fromName: "Known Buyer",
      to: ["support@medidakoslabs.com"],
      subject: "Re: Support ticket",
      bodyText: "Follow-up question after resolution.",
      attachments: [],
      sentAt: "2026-08-29T14:00:00.000Z",
    };
    await saveMessage(db, newInbound);

    const thread3Reopened = await db.collection("threads").doc(threadKey3).get();
    const convAfterReopen = await db.collection("conversations").doc(convId).get();

    assert.equal(needsReply(thread3Reopened.data()), true);
    assert.equal(convAfterReopen.data().unansweredThreadCount, 1);
    assert.equal(convAfterReopen.data().oldestUnansweredAt, "2026-08-29T14:00:00.000Z");
  });

  test("Channel Talk automation stays on its customer thread and never creates a main identity", async () => {
    const automationThreadKey = id("channel-automation-only");
    await saveMessage(db, {
      docId: id("channel-automation"),
      channel: "channeltalk",
      side: "unknown",
      sideSource: "account_rule",
      sourceAccount: "main",
      externalId: "channel-automation",
      providerThreadId: "chat-automation-only",
      threadKey: automationThreadKey,
      historyId: "channel-automation",
      direction: "out",
      authorRole: "automation",
      from: "main",
      fromName: "",
      to: ["channel:user:visitor-automation"],
      channelTalkUserId: "visitor-automation",
      subject: "",
      bodyText: "방문해주셔서 감사합니다.",
      attachments: [],
      sentAt: "2026-08-29T15:00:00.000Z",
    });

    const mainIdentity = await db.collection("conversationIdentities").doc("channeltalk:main:main").get();
    const automationIdentity = await db.collection("conversationIdentities").doc("channeltalk:main:visitor-automation").get();
    assert.equal(mainIdentity.exists, false);
    assert.equal(automationIdentity.exists, true);
    assert.equal(automationIdentity.data().classification, "unclassified");

    const reviewBeforeCustomer = await listReviewIdentities("unclassified");
    assert.equal(reviewBeforeCustomer.some((item) => item.identity.id === automationIdentity.id), false);

    await saveMessage(db, {
      docId: id("channel-customer"),
      channel: "channeltalk",
      side: "unknown",
      sideSource: "account_rule",
      sourceAccount: "main",
      externalId: "channel-customer",
      providerThreadId: "chat-automation-only",
      threadKey: automationThreadKey,
      historyId: "channel-customer",
      direction: "in",
      authorRole: "customer",
      from: "channel:user:visitor-automation",
      fromName: "Automation Visitor",
      to: ["main"],
      channelTalkUserId: "visitor-automation",
      subject: "",
      bodyText: "제품 문의드립니다.",
      attachments: [],
      sentAt: "2026-08-29T15:01:00.000Z",
    });

    const thread = await db.collection("threads").doc(automationThreadKey).get();
    assert.equal(thread.data().hasCustomerInbound, true);
    const reviewAfterCustomer = await listReviewIdentities("unclassified");
    assert.equal(reviewAfterCustomer.some((item) => item.identity.id === automationIdentity.id), true);
  });

  test("ingestHealthSummary flags degraded and errored accounts accurately", async () => {
    const accOk = id("acc-ok");
    const accOld = id("acc-old");
    const accErr = id("acc-err");

    await Promise.all([
      db.collection("ingestState").doc(accOk).set({
        account: accOk,
        lastSuccessAt: "2026-08-29T12:00:00.000Z",
        lastError: null,
        processedCount: 10,
        updatedAt: "2026-08-29T12:00:00.000Z",
      }),
      db.collection("ingestState").doc(accOld).set({
        account: accOld,
        lastSuccessAt: "2026-08-29T11:00:00.000Z", // 1 hour old (> 15 mins)
        lastError: null,
        processedCount: 5,
        updatedAt: "2026-08-29T11:00:00.000Z",
      }),
      db.collection("ingestState").doc(accErr).set({
        account: accErr,
        lastSuccessAt: "2026-08-29T12:00:00.000Z",
        lastError: "Invalid credentials",
        processedCount: 0,
        updatedAt: "2026-08-29T12:00:00.000Z",
      }),
    ]);

    const summary = await ingestHealthSummary("2026-08-29T12:05:00.000Z");
    assert.equal(summary.healthy, false);
    const oldWarn = summary.warnings.find((w) => w.account === accOld);
    const errWarn = summary.warnings.find((w) => w.account === accErr);
    const okWarn = summary.warnings.find((w) => w.account === accOk);

    assert.ok(oldWarn);
    assert.match(oldWarn.reason, /15분/);
    assert.ok(errWarn);
    assert.match(errWarn.reason, /Invalid credentials/);
    assert.equal(okWarn, undefined);
  });

  after(async () => {
    await getAdminApp().delete();
  });
}
