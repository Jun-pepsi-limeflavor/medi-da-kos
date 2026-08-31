import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({ projectId: "medidakos" });
}
const db = getFirestore();

const INTERNAL_DOMAINS = ["techasset.co.kr", "medidakoslabs.com", "medidakos.com"];

function isInternalEmail(email) {
  if (!email || typeof email !== "string") return false;
  const clean = email.toLowerCase().trim();
  return INTERNAL_DOMAINS.some((d) => clean.endsWith(`@${d}`));
}

async function repair() {
  console.log("Starting thread identity repair...");
  const [threadsSnap, messagesSnap] = await Promise.all([
    db.collection("threads").get(),
    db.collection("messages").get(),
  ]);

  const messagesByThread = new Map();
  for (const doc of messagesSnap.docs) {
    const data = doc.data();
    const key = data.threadKey;
    if (!messagesByThread.has(key)) messagesByThread.set(key, []);
    messagesByThread.get(key).push({ id: doc.id, ...data });
  }

  let updatedCount = 0;
  const batch = db.batch();

  for (const doc of threadsSnap.docs) {
    const thread = doc.data();
    const tKey = doc.id;
    const msgs = messagesByThread.get(tKey) || [];
    msgs.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));

    // Find best external counterparty
    let externalEmail = null;
    for (const m of msgs) {
      if (m.direction === "in" && m.from && m.from.includes("@") && !isInternalEmail(m.from)) {
        externalEmail = m.from.trim().toLowerCase();
        break;
      }
    }
    if (!externalEmail) {
      for (const m of msgs) {
        if (m.direction === "out" && Array.isArray(m.to)) {
          const ext = m.to.find((addr) => addr && addr.includes("@") && !isInternalEmail(addr));
          if (ext) {
            externalEmail = ext.trim().toLowerCase();
            break;
          }
        }
      }
    }

    if (externalEmail) {
      const correctIdentityId = `email:${externalEmail}`;
      const currentIdentityId = thread.identityId;

      const isCurrentInternal = currentIdentityId && (
        currentIdentityId.includes("@techasset.co.kr") ||
        currentIdentityId.includes("@medidakoslabs.com") ||
        currentIdentityId.includes("@medidakos.com")
      );

      if (isCurrentInternal || currentIdentityId !== correctIdentityId) {
        console.log(`[Updating Thread] ${tKey}`);
        console.log(`  Old Identity: ${currentIdentityId} (${thread.classification})`);
        console.log(`  New Identity: ${correctIdentityId}`);

        const newClassification = (thread.classification === "internal") ? "unclassified" : thread.classification;
        
        batch.update(doc.ref, {
          identityId: correctIdentityId,
          classification: newClassification,
          updatedAt: new Date().toISOString(),
        });

        // Ensure target identity doc exists
        const identityRef = db.collection("conversationIdentities").doc(correctIdentityId);
        batch.set(
          identityRef,
          {
            kind: "email",
            value: externalEmail,
            classification: newClassification,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        updatedCount++;
      }
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`Successfully repaired ${updatedCount} threads!`);
  } else {
    console.log("All threads already have correct identities.");
  }
}

repair().catch(console.error);
