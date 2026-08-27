const MESSAGES = "messages";
const THREADS = "threads";
const STATE = "ingestState";

async function saveMessage(db, m) {
  const { docId, ...data } = m;
  const messageRef = db.collection(MESSAGES).doc(docId);
  const threadRef = db.collection(THREADS).doc(m.threadKey);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const [messageSnap, threadSnap] = await Promise.all([
      tx.get(messageRef), tx.get(threadRef),
    ]);

    const isNewMessage = !messageSnap.exists;
    if (!isNewMessage) {
      // source 필드만 갱신한다. parseStatus·extraction·accepted는 건드리지 않는다.
      tx.update(messageRef, { ...data, sourceUpdatedAt: now });
    } else {
      tx.create(messageRef, {
        ...data,
        parseStatus: "pending",
        createdAt: now,
        sourceUpdatedAt: now,
      });
    }

    const latest = !threadSnap.exists || m.sentAt >= (threadSnap.data().lastMessageAt ?? "");
    if (!threadSnap.exists) {
      tx.create(threadRef, {
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
        createdAt: now,
        updatedAt: now,
      });
    } else if (latest) {
      const update = {
        lastMessageAt: m.sentAt,
        lastDirection: m.direction,
        updatedAt: now,
      };
      if (isNewMessage && m.direction === "in") {
        update.readState = "unread";
        if (threadSnap.data().triageState === "archived") {
          update.triageState = "open";
        }
      }
      if (threadSnap.data().sideSource !== "manual") {
        update.side = m.side;
        update.sideSource = m.sideSource;
      }
      tx.update(threadRef, update);
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

module.exports = { saveMessage, getIngestState, setIngestState };
