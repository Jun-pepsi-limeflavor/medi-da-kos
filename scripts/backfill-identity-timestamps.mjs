import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({ projectId: "medidakos" });
}
const db = getFirestore();

async function backfillTimestamps() {
  const snap = await db.collection("conversationIdentities").get();
  const batch = db.batch();
  let count = 0;
  const now = new Date().toISOString();

  for (const doc of snap.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const patch = {};

    if (!data.createdAt) {
      patch.createdAt = data.updatedAt || now;
      needsUpdate = true;
    }
    if (!data.updatedAt) {
      patch.updatedAt = data.createdAt || now;
      needsUpdate = true;
    }

    if (needsUpdate) {
      batch.update(doc.ref, patch);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Backfilled timestamps for ${count} identity documents.`);
  } else {
    console.log("All identity documents already have timestamps.");
  }
}

backfillTimestamps().catch(console.error);
