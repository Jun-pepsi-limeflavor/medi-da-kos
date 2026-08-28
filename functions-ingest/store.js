const { FieldValue } = require("firebase-admin/firestore");

const MESSAGES = "messages";
const THREADS = "threads";
const IDENTITIES = "conversationIdentities";
const CONVERSATIONS = "conversations";
const STATE = "ingestState";

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

async function saveMessage(db, m) {
  const { docId, ...data } = m;
  const messageRef = db.collection(MESSAGES).doc(docId);
  const threadRef = db.collection(THREADS).doc(m.threadKey);
  const now = new Date().toISOString();
  const identityInfo = extractCounterpartyIdentifier(m);
  const identityRef = db.collection(IDENTITIES).doc(identityInfo.identityId);

  await db.runTransaction(async (tx) => {
    // --- STEP 1: ALL READS MUST HAPPEN FIRST ---
    const [messageSnap, threadSnap, identitySnap] = await Promise.all([
      tx.get(messageRef),
      tx.get(threadRef),
      tx.get(identityRef),
    ]);

    let isNewIdentity = !identitySnap.exists;
    let identityData = identitySnap.exists ? identitySnap.data() : null;
    let classification = identityData?.classification;
    let conversationId = identityData?.conversationId;
    let buyerId = identityData?.buyerId;
    let supplierId = identityData?.supplierId;

    if (!identitySnap.exists) {
      if (identityInfo.kind === "email" && identityInfo.value) {
        const buyerQuery = db.collection("buyers").where("emails", "array-contains", identityInfo.value).limit(2);
        const buyerSnap = await tx.get(buyerQuery);
        if (buyerSnap.docs.length === 1) {
          const singleBuyerId = buyerSnap.docs[0].id;
          const convQuery = db.collection(CONVERSATIONS).where("buyerId", "==", singleBuyerId).limit(2);
          const convSnap = await tx.get(convQuery);
          if (convSnap.docs.length === 1) {
            classification = "buyer";
            buyerId = singleBuyerId;
            conversationId = convSnap.docs[0].id;
          }
        }
      }

      if (!classification) {
        classification = "unclassified";
      }

      identityData = {
        kind: identityInfo.kind,
        value: identityInfo.value,
        classification,
        ...(buyerId ? { buyerId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(conversationId ? { conversationId } : {}),
        createdAt: now,
        updatedAt: now,
      };
    }

    let convSnap = null;
    let convThreadsSnap = null;
    if (conversationId) {
      const convRef = db.collection(CONVERSATIONS).doc(conversationId);
      const threadsQuery = db.collection(THREADS).where("conversationId", "==", conversationId);
      [convSnap, convThreadsSnap] = await Promise.all([
        tx.get(convRef),
        tx.get(threadsQuery),
      ]);
    }

    // --- STEP 2: ALL WRITES AFTER READS ---

    // 1. Identity write
    if (isNewIdentity) {
      tx.create(identityRef, identityData);
    }

    // 2. Message write
    const isNewMessage = !messageSnap.exists;
    if (!isNewMessage) {
      tx.update(messageRef, { ...data, sourceUpdatedAt: now });
    } else {
      tx.create(messageRef, {
        ...data,
        parseStatus: "pending",
        createdAt: now,
        sourceUpdatedAt: now,
      });
    }

    // 3. Thread write
    const prevThread = threadSnap.exists ? threadSnap.data() : null;
    const prevInbound = prevThread?.lastInboundAt;
    const prevOutbound = prevThread?.lastOutboundAt;

    let nextInbound = prevInbound;
    let nextOutbound = prevOutbound;
    if (m.direction === "in") {
      nextInbound = prevInbound && prevInbound > m.sentAt ? prevInbound : m.sentAt;
    } else if (m.direction === "out") {
      nextOutbound = prevOutbound && prevOutbound > m.sentAt ? prevOutbound : m.sentAt;
    }

    const latest = !threadSnap.exists || m.sentAt >= (prevThread?.lastMessageAt ?? "");
    let updatedThreadData = null;

    if (!threadSnap.exists) {
      updatedThreadData = {
        channel: m.channel,
        sourceAccount: m.sourceAccount,
        providerThreadId: m.providerThreadId,
        readState: m.direction === "in" ? "unread" : "read",
        triageState: "open",
        linkState: "unlinked",
        side: m.side,
        sideSource: m.sideSource,
        sideHistory: [],
        lastMessageAt: m.sentAt,
        lastDirection: m.direction,
        identityId: identityInfo.identityId,
        classification,
        ...(conversationId ? { conversationId } : {}),
        ...(nextInbound ? { lastInboundAt: nextInbound } : {}),
        ...(nextOutbound ? { lastOutboundAt: nextOutbound } : {}),
        createdAt: now,
        updatedAt: now,
      };
      tx.create(threadRef, updatedThreadData);
    } else {
      const threadUpdate = {
        updatedAt: now,
        identityId: identityInfo.identityId,
        classification,
        ...(conversationId ? { conversationId } : {}),
        ...(nextInbound ? { lastInboundAt: nextInbound } : {}),
        ...(nextOutbound ? { lastOutboundAt: nextOutbound } : {}),
      };
      if (latest) {
        threadUpdate.lastMessageAt = m.sentAt;
        threadUpdate.lastDirection = m.direction;
      }
      if (isNewMessage && m.direction === "in") {
        threadUpdate.readState = "unread";
        if (prevThread?.triageState === "archived") {
          threadUpdate.triageState = "open";
        }
      }
      if (prevThread?.sideSource !== "manual") {
        threadUpdate.side = m.side;
        threadUpdate.sideSource = m.sideSource;
      }
      tx.update(threadRef, threadUpdate);
      updatedThreadData = { ...prevThread, ...threadUpdate };
    }

    // 4. Conversation write
    if (conversationId && convSnap && convSnap.exists) {
      const convRef = db.collection(CONVERSATIONS).doc(conversationId);
      const convData = convSnap.data();
      const allThreadsMap = new Map();
      if (convThreadsSnap) {
        for (const d of convThreadsSnap.docs) {
          allThreadsMap.set(d.id, { threadKey: d.id, ...d.data() });
        }
      }
      allThreadsMap.set(m.threadKey, { threadKey: m.threadKey, ...updatedThreadData });

      const allThreads = Array.from(allThreadsMap.values());
      let unansweredCount = 0;
      let oldestUnanswered = null;
      const providerLabelsSet = new Set(convData.providerLabels || []);

      for (const t of allThreads) {
        if (t.channel) providerLabelsSet.add(t.channel);
        if (computeNeedsReply(t)) {
          unansweredCount += 1;
          if (!oldestUnanswered || (t.lastInboundAt && t.lastInboundAt < oldestUnanswered)) {
            oldestUnanswered = t.lastInboundAt;
          }
        }
      }

      const cleanSnippet = typeof m.bodyText === "string" ? m.bodyText.replace(/\s+/g, " ").trim().slice(0, 150) : "";
      const maxActivityAt = convData.lastActivityAt && convData.lastActivityAt > m.sentAt ? convData.lastActivityAt : m.sentAt;

      const convUpdate = {
        unansweredThreadCount: unansweredCount,
        threadCount: allThreads.length,
        lastActivityAt: maxActivityAt,
        updatedAt: now,
        identityIds: Array.from(new Set([...(convData.identityIds || []), identityInfo.identityId])),
        providerLabels: Array.from(providerLabelsSet),
      };

      if (oldestUnanswered) {
        convUpdate.oldestUnansweredAt = oldestUnanswered;
      } else {
        convUpdate.oldestUnansweredAt = FieldValue.delete();
      }

      if (m.subject && latest) {
        convUpdate.lastSubject = m.subject;
      }
      if (cleanSnippet && latest) {
        convUpdate.lastSnippet = cleanSnippet;
      }
      if (!convData.counterpartyLabel && (m.fromName || identityInfo.value)) {
        convUpdate.counterpartyLabel = m.fromName || identityInfo.value;
      }

      tx.update(convRef, convUpdate);
    }
  });
}

async function getIngestState(db, account) {
  const snap = await db.collection(STATE).doc(account).get();
  return snap.exists ? snap.data() : {
    lastEpochSeconds: null,
    lastSuccessAt: null,
    lastError: null,
    processedCount: 0,
  };
}

async function setIngestState(db, account, state) {
  await db.collection(STATE).doc(account).set(
    { ...state, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

module.exports = {
  saveMessage,
  getIngestState,
  setIngestState,
  extractCounterpartyIdentifier,
  computeNeedsReply,
};
