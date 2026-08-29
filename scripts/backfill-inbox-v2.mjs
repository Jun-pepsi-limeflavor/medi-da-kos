#!/usr/bin/env node
// scripts/backfill-inbox-v2.mjs
// Idempotent migration backfill for Inbox v2 data model

import process from "node:process";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({ projectId: "medidakos" });
}
const db = getFirestore();

function extractCounterpartyIdentifier(m) {
  if (m.channel === "channeltalk") {
    const fromVal = typeof m.from === "string" ? m.from.trim() : "";
    if (fromVal.includes("@")) {
      const email = fromVal.toLowerCase();
      return { kind: "email", value: email, identityId: `email:${email}` };
    }
    if (m.direction === "out" && Array.isArray(m.to) && m.to[0] && m.to[0].includes("@")) {
      const email = m.to[0].trim().toLowerCase();
      return { kind: "email", value: email, identityId: `email:${email}` };
    }
    const rawId = fromVal.startsWith("channel:user:") ? fromVal.slice("channel:user:".length).trim() : fromVal;
    const account = (m.sourceAccount || "channeltalk").trim();
    const normalized = rawId ? `${account}:${rawId}` : account;
    return { kind: "channeltalk", value: normalized, identityId: `channeltalk:${normalized}` };
  }

  let target = "";
  if (m.direction === "in") {
    target = typeof m.from === "string" ? m.from : "";
  } else {
    target = Array.isArray(m.to) && m.to[0] ? m.to[0] : (typeof m.to === "string" ? m.to : "");
  }
  const email = target.trim().toLowerCase();
  return { kind: "email", value: email, identityId: `email:${email}` };
}

function computeNeedsReply(thread) {
  if (!thread.lastInboundAt) return false;
  const inbound = Date.parse(thread.lastInboundAt);
  if (Number.isNaN(inbound)) return false;
  const outbound = thread.lastOutboundAt ? Date.parse(thread.lastOutboundAt) : Number.NEGATIVE_INFINITY;
  const handled = thread.handledThroughAt ? Date.parse(thread.handledThroughAt) : Number.NEGATIVE_INFINITY;
  return inbound > outbound && inbound > handled;
}

const INTERNAL_DOMAINS = ["techasset.co.kr", "medidakoslabs.com", "medidakos.com"];
function isInternalEmail(email) {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return INTERNAL_DOMAINS.includes(domain);
}

export async function executeBackfill() {
  console.log("==================================================================");
  console.log("  🚀 Executing Inbox v2 Idempotent Backfill Migration");
  console.log("==================================================================\n");

  const [threadsSnap, messagesSnap, buyersSnap, suppliersSnap] = await Promise.all([
    db.collection("threads").get(),
    db.collection("messages").get(),
    db.collection("buyers").get(),
    db.collection("suppliers").get(),
  ]);

  const threads = threadsSnap.docs.map(d => ({ threadKey: d.id, ...d.data() }));
  const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const buyers = buyersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const suppliers = suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`- Threads: ${threads.length}건, Messages: ${messages.length}건`);
  console.log(`- Buyers: ${buyers.length}건, Suppliers: ${suppliers.length}건\n`);

  const buyerEmailMap = new Map();
  for (const b of buyers) {
    if (Array.isArray(b.emails)) {
      for (const email of b.emails) {
        if (email) buyerEmailMap.set(email.trim().toLowerCase(), b);
      }
    }
  }

  const supplierEmailMap = new Map();
  for (const s of suppliers) {
    if (Array.isArray(s.contacts)) {
      for (const contact of s.contacts) {
        if (contact && contact.email) {
          supplierEmailMap.set(contact.email.trim().toLowerCase(), s);
        }
      }
    }
  }

  const threadMessagesMap = new Map();
  for (const m of messages) {
    const key = m.threadKey || "unknown";
    if (!threadMessagesMap.has(key)) {
      threadMessagesMap.set(key, []);
    }
    threadMessagesMap.get(key).push(m);
  }

  for (const msgs of threadMessagesMap.values()) {
    msgs.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));
  }

  const now = new Date().toISOString();
  const identitiesMap = new Map();
  const conversationsMap = new Map();
  const threadUpdates = [];

  for (const thread of threads) {
    const msgs = threadMessagesMap.get(thread.threadKey) || [];
    const latestMsg = msgs[msgs.length - 1] || {
      channel: thread.channel,
      sourceAccount: thread.sourceAccount,
      providerThreadId: thread.providerThreadId,
      direction: thread.lastDirection || "in",
      from: "",
      to: [],
      sentAt: thread.lastMessageAt || now,
    };

    const identityInfo = extractCounterpartyIdentifier(latestMsg);
    if (!identityInfo.value) {
      for (const m of msgs) {
        const alt = extractCounterpartyIdentifier(m);
        if (alt.value) {
          identityInfo.kind = alt.kind;
          identityInfo.value = alt.value;
          identityInfo.identityId = alt.identityId;
          break;
        }
      }
    }

    let lastInboundAt = thread.lastInboundAt || null;
    let lastOutboundAt = thread.lastOutboundAt || null;
    for (const m of msgs) {
      if (m.direction === "in" && (!lastInboundAt || m.sentAt > lastInboundAt)) {
        lastInboundAt = m.sentAt;
      }
      if (m.direction === "out" && (!lastOutboundAt || m.sentAt > lastOutboundAt)) {
        lastOutboundAt = m.sentAt;
      }
    }

    let classification = thread.classification;
    let buyerId = thread.buyerId;
    let supplierId = thread.supplierId;
    let conversationId = thread.conversationId;

    if (!classification || classification === "unclassified") {
      if (identityInfo.kind === "email") {
        const val = identityInfo.value;
        if (buyerEmailMap.has(val)) {
          const b = buyerEmailMap.get(val);
          classification = "buyer";
          buyerId = b.id;
        } else if (supplierEmailMap.has(val)) {
          const s = supplierEmailMap.get(val);
          classification = "supplier";
          supplierId = s.id;
        } else if (isInternalEmail(val)) {
          classification = "internal";
        } else if (thread.side === "brand" && thread.buyerId) {
          classification = "buyer";
          buyerId = thread.buyerId;
        } else if (thread.side === "factory" && thread.supplierId) {
          classification = "supplier";
          supplierId = thread.supplierId;
        } else {
          classification = "unclassified";
        }
      } else {
        classification = "unclassified";
      }
    }

    if (classification === "buyer" && buyerId) {
      conversationId = `conv_${buyerId}`;
      if (!conversationsMap.has(conversationId)) {
        const buyer = buyers.find(b => b.id === buyerId);
        conversationsMap.set(conversationId, {
          buyerId,
          counterpartyLabel: buyer?.name || buyer?.brandName || identityInfo.value,
          identityIds: [identityInfo.identityId],
          providerLabels: [thread.channel],
          workflowState: "active",
          lastActivityAt: thread.lastMessageAt || now,
          lastSubject: latestMsg.subject || "",
          lastSnippet: (latestMsg.bodyText || "").replace(/\s+/g, " ").trim().slice(0, 150),
          threads: [],
          createdAt: now,
          updatedAt: now,
        });
      }
      const conv = conversationsMap.get(conversationId);
      if (!conv.identityIds.includes(identityInfo.identityId)) {
        conv.identityIds.push(identityInfo.identityId);
      }
      if (!conv.providerLabels.includes(thread.channel)) {
        conv.providerLabels.push(thread.channel);
      }
      conv.threads.push({
        ...thread,
        lastInboundAt,
        lastOutboundAt,
      });
      if ((thread.lastMessageAt || "") > conv.lastActivityAt) {
        conv.lastActivityAt = thread.lastMessageAt || "";
        conv.lastSubject = latestMsg.subject || "";
        conv.lastSnippet = (latestMsg.bodyText || "").replace(/\s+/g, " ").trim().slice(0, 150);
      }
    }

    if (!identitiesMap.has(identityInfo.identityId)) {
      identitiesMap.set(identityInfo.identityId, {
        kind: identityInfo.kind,
        value: identityInfo.value,
        classification,
        ...(buyerId ? { buyerId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(conversationId ? { conversationId } : {}),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const existing = identitiesMap.get(identityInfo.identityId);
      if (classification !== "unclassified" && existing.classification === "unclassified") {
        existing.classification = classification;
        if (buyerId) existing.buyerId = buyerId;
        if (supplierId) existing.supplierId = supplierId;
        if (conversationId) existing.conversationId = conversationId;
      }
    }

    threadUpdates.push({
      threadKey: thread.threadKey,
      data: {
        identityId: identityInfo.identityId,
        classification,
        ...(conversationId ? { conversationId } : {}),
        ...(lastInboundAt ? { lastInboundAt } : {}),
        ...(lastOutboundAt ? { lastOutboundAt } : {}),
        updatedAt: now,
      },
    });
  }

  // Calculate final rollups for conversations
  for (const [id, conv] of conversationsMap.entries()) {
    let unansweredCount = 0;
    let oldestUnanswered = null;
    for (const t of conv.threads) {
      if (computeNeedsReply(t)) {
        unansweredCount++;
        if (!oldestUnanswered || (t.lastInboundAt && t.lastInboundAt < oldestUnanswered)) {
          oldestUnanswered = t.lastInboundAt;
        }
      }
    }
    conv.unansweredThreadCount = unansweredCount;
    conv.threadCount = conv.threads.length;
    if (oldestUnanswered) {
      conv.oldestUnansweredAt = oldestUnanswered;
    }
    delete conv.threads;
  }

  console.log(`적재 대상: Identities: ${identitiesMap.size}건, Conversations: ${conversationsMap.size}건, Threads 업데이트: ${threadUpdates.length}건`);

  // Batch writes in chunks of 400 (Firestore limit is 500)
  const BATCH_SIZE = 400;

  console.log("\n1/3. conversationIdentities 일괄 저장 중...");
  const identityEntries = Array.from(identitiesMap.entries());
  for (let i = 0; i < identityEntries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = identityEntries.slice(i, i + BATCH_SIZE);
    for (const [id, data] of chunk) {
      batch.set(db.collection("conversationIdentities").doc(id), data, { merge: true });
    }
    await batch.commit();
    console.log(`  - ${Math.min(i + BATCH_SIZE, identityEntries.length)}/${identityEntries.length} 완료`);
  }

  console.log("\n2/3. conversations 일괄 저장 중...");
  const convEntries = Array.from(conversationsMap.entries());
  if (convEntries.length > 0) {
    const batch = db.batch();
    for (const [id, data] of convEntries) {
      batch.set(db.collection("conversations").doc(id), data, { merge: true });
    }
    await batch.commit();
    console.log(`  - ${convEntries.length}건 저장 완료`);
  } else {
    console.log("  - 생성할 Conversation 없음");
  }

  console.log("\n3/3. threads 메타데이터 일괄 갱신 중...");
  for (let i = 0; i < threadUpdates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = threadUpdates.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      batch.set(db.collection("threads").doc(item.threadKey), item.data, { merge: true });
    }
    await batch.commit();
    console.log(`  - ${Math.min(i + BATCH_SIZE, threadUpdates.length)}/${threadUpdates.length} 완료`);
  }

  console.log("\n==================================================================");
  console.log("  ✅ Inbox v2 백필 마이그레이션이 성공적으로 완료되었습니다.");
  console.log("==================================================================");
}

if (process.argv[1]?.endsWith("backfill-inbox-v2.mjs")) {
  executeBackfill().catch(console.error);
}
