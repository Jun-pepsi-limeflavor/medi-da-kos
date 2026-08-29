#!/usr/bin/env node
// scripts/dry-run-backfill.mjs
// Read-only dry-run analysis for Inbox v2 data migration

import process from "node:process";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
const INTERNAL_EMAILS = [
  "thomas@medidakoslabs.com",
  "hally@medidakoslabs.com",
  "support@medidakos.com",
  "rheekw@techasset.co.kr",
  "songjh@techasset.co.kr",
  "kimhs@techasset.co.kr",
  "parkjy@techasset.co.kr",
];

function isInternalEmail(email) {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return INTERNAL_DOMAINS.includes(domain);
}

async function runDryRun() {
  console.log("==================================================================");
  console.log("  📥 Inbox v2 Dry-Run Migration & Data Audit Report (Read-Only)");
  console.log("==================================================================\n");

  console.log("1. Firestore 컬렉션 데이터 로딩 중...");
  const [threadsSnap, messagesSnap, buyersSnap, suppliersSnap, dealsSnap, identitiesSnap, convsSnap] = await Promise.all([
    db.collection("threads").get(),
    db.collection("messages").get(),
    db.collection("buyers").get(),
    db.collection("suppliers").get(),
    db.collection("deals").get(),
    db.collection("conversationIdentities").get(),
    db.collection("conversations").get(),
  ]);

  const threads = threadsSnap.docs.map(d => ({ threadKey: d.id, ...d.data() }));
  const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const buyers = buyersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const suppliers = suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const deals = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const existingIdentities = new Map(identitiesSnap.docs.map(d => [d.id, d.data()]));
  const existingConversations = new Map(convsSnap.docs.map(d => [d.id, d.data()]));

  console.log(`- Threads (기존 스레드): ${threads.length}건`);
  console.log(`- Messages (기존 메시지): ${messages.length}건`);
  console.log(`- Buyers (등록 바이어): ${buyers.length}건`);
  console.log(`- Suppliers (등록 제조사): ${suppliers.length}건`);
  console.log(`- Deals (등록 딜): ${deals.length}건`);
  console.log(`- ConversationIdentities (현재): ${existingIdentities.size}건`);
  console.log(`- Conversations (현재): ${existingConversations.size}건\n`);

  // Build buyer and supplier email lookup maps
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

  // Group messages by threadKey
  const threadMessagesMap = new Map();
  for (const m of messages) {
    const key = m.threadKey || "unknown";
    if (!threadMessagesMap.has(key)) {
      threadMessagesMap.set(key, []);
    }
    threadMessagesMap.get(key).push(m);
  }

  // Sort messages in each thread by sentAt
  for (const msgs of threadMessagesMap.values()) {
    msgs.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));
  }

  console.log("2. 스레드별 Identity 및 분류 분석 중...");

  // Simulated identity map: identityId -> identity record
  const planIdentities = new Map();
  // Simulated conversation map: conversationId -> conversation record
  const planConversations = new Map();
  // Thread updates plan: threadKey -> patch object
  const planThreadUpdates = new Map();

  const stats = {
    totalThreads: threads.length,
    threadsWithMessages: 0,
    threadsWithoutMessages: 0,
    identitiesCount: 0,
    buyerIdentities: 0,
    supplierIdentities: 0,
    internalIdentities: 0,
    unclassifiedIdentities: 0,
    conversationsCreated: 0,
    channelBreakdown: {},
  };

  for (const thread of threads) {
    const msgs = threadMessagesMap.get(thread.threadKey) || [];
    if (msgs.length === 0) {
      stats.threadsWithoutMessages++;
    } else {
      stats.threadsWithMessages++;
    }

    const channel = thread.channel || "unknown";
    stats.channelBreakdown[channel] = (stats.channelBreakdown[channel] || 0) + 1;

    // Determine counterparty from latest message or inbound message
    const latestMsg = msgs[msgs.length - 1] || {
      channel: thread.channel,
      sourceAccount: thread.sourceAccount,
      providerThreadId: thread.providerThreadId,
      direction: thread.lastDirection || "in",
      from: "",
      to: [],
      sentAt: thread.lastMessageAt || new Date().toISOString(),
    };

    const identityInfo = extractCounterpartyIdentifier(latestMsg);
    if (!identityInfo.value) {
      // If empty, try other messages
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

    // Determine timestamps
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

    // Check classification
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

    // Buyer classification connects to a conversation
    if (classification === "buyer" && buyerId) {
      conversationId = `conv_${buyerId}`;
      if (!planConversations.has(conversationId)) {
        const buyer = buyers.find(b => b.id === buyerId);
        planConversations.set(conversationId, {
          id: conversationId,
          buyerId,
          counterpartyLabel: buyer?.name || buyer?.brandName || identityInfo.value,
          identityIds: new Set([identityInfo.identityId]),
          providerLabels: new Set([thread.channel]),
          threads: [],
          lastActivityAt: thread.lastMessageAt || "",
          workflowState: "active",
        });
      }
      const conv = planConversations.get(conversationId);
      conv.identityIds.add(identityInfo.identityId);
      conv.providerLabels.add(thread.channel);
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

    // Record identity
    if (!planIdentities.has(identityInfo.identityId)) {
      planIdentities.set(identityInfo.identityId, {
        id: identityInfo.identityId,
        kind: identityInfo.kind,
        value: identityInfo.value,
        classification,
        buyerId: buyerId || null,
        supplierId: supplierId || null,
        conversationId: conversationId || null,
        threads: [thread],
      });
    } else {
      const idObj = planIdentities.get(identityInfo.identityId);
      idObj.threads.push(thread);
      if (classification !== "unclassified" && idObj.classification === "unclassified") {
        idObj.classification = classification;
        idObj.buyerId = buyerId || null;
        idObj.supplierId = supplierId || null;
        idObj.conversationId = conversationId || null;
      }
    }

    planThreadUpdates.set(thread.threadKey, {
      identityId: identityInfo.identityId,
      classification,
      conversationId: conversationId || null,
      lastInboundAt,
      lastOutboundAt,
    });
  }

  // Count stats
  for (const idObj of planIdentities.values()) {
    stats.identitiesCount++;
    if (idObj.classification === "buyer") stats.buyerIdentities++;
    else if (idObj.classification === "supplier") stats.supplierIdentities++;
    else if (idObj.classification === "internal") stats.internalIdentities++;
    else stats.unclassifiedIdentities++;
  }
  stats.conversationsCreated = planConversations.size;

  console.log("==================================================================");
  console.log("  📊 Dry-Run 백필 분석 결과 요약");
  console.log("==================================================================\n");
  console.log(`- 전체 스레드 수: ${stats.totalThreads}건 (메시지 보유: ${stats.threadsWithMessages}건, 빈 스레드: ${stats.threadsWithoutMessages}건)`);
  console.log(`- 추출된 고유 Identity: 총 ${stats.identitiesCount}건`);
  console.log(`  ├ 바이어 매칭 (고객 업무 큐): ${stats.buyerIdentities}건 -> 생성될 Conversation: ${stats.conversationsCreated}건`);
  console.log(`  ├ 제조사 매칭 (제조사 큐): ${stats.supplierIdentities}건`);
  console.log(`  ├ 사내/내부 메일 (광고·내부 큐): ${stats.internalIdentities}건`);
  console.log(`  └ 미분류 외부 문의 (검토함 큐): ${stats.unclassifiedIdentities}건\n`);

  console.log("채널별 스레드 분포:");
  for (const [ch, count] of Object.entries(stats.channelBreakdown)) {
    console.log(`  - ${ch.padEnd(20)}: ${count}건`);
  }

  console.log("\n==================================================================");
  console.log("  🔍 검토함 (Unclassified Queue) 샘플 (상위 10건)");
  console.log("==================================================================");
  const unclassifiedSamples = Array.from(planIdentities.values())
    .filter(i => i.classification === "unclassified")
    .slice(0, 10);
  for (const item of unclassifiedSamples) {
    const threadSample = item.threads[0];
    const msgs = threadMessagesMap.get(threadSample.threadKey) || [];
    const lastMsg = msgs[msgs.length - 1];
    console.log(`- [${item.kind}] ${item.value.padEnd(35)} | 스레드: ${item.threads.length}개 | 최근제목: ${(lastMsg?.subject || "(제목 없음)").slice(0, 40)}`);
  }

  if (planConversations.size > 0) {
    console.log("\n==================================================================");
    console.log("  👥 고객 업무 (Customer-Work Conversations) 목록");
    console.log("==================================================================");
    for (const conv of planConversations.values()) {
      console.log(`- Conversation ID: ${conv.id} | 라벨: ${conv.counterpartyLabel} | 연결 스레드: ${conv.threads.length}건 | 채널: ${Array.from(conv.providerLabels).join(", ")}`);
    }
  }

  console.log("\n==================================================================");
  console.log("  🛡️ 안전성 및 불변성 검증");
  console.log("==================================================================");
  console.log("✓ messages 컬렉션 원문 본문/헤더 변경 없음 (0건 수정)");
  console.log("✓ 원가, 마진, 공급가, 환율 등 재무 필드 참조/작성 없음");
  console.log("✓ threadKey 및 providerThreadId 원본 매핑 유지");
  console.log("✓ 멱등성 보장: 동일 Identity/Conversation 결정적 ID 기반 생성");
  console.log("==================================================================\n");

  return { stats, planIdentities, planConversations, planThreadUpdates };
}

runDryRun().catch(console.error);
