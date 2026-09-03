/**
 * scripts/reclassify-internal-threads.mjs
 *
 * 사내 도메인 서명 또는 사내 직원 발신/포워딩 메일이 포함된 스레드 및 식별자를
 * '광고·내부(internal)'로 일괄 재분류(백필)하는 스크립트.
 *
 * 사용법:
 *   node scripts/reclassify-internal-threads.mjs --dry-run
 *   node scripts/reclassify-internal-threads.mjs --commit
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { hasInternalSignature, isInternalAddress } from "../src/lib/internal-staff.ts";

const isDryRun = process.argv.includes("--dry-run") || !process.argv.includes("--commit");

function initAdmin() {
  if (getApps().length === 0) {
    const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (saB64) {
      const sa = JSON.parse(Buffer.from(saB64, "base64").toString("utf8"));
      initializeApp({ credential: cert(sa), projectId: "medidakos" });
    } else {
      initializeApp({ projectId: "medidakos" });
    }
  }
  return getFirestore();
}

async function run() {
  console.log(`=== 사내 포워딩/서명 포함 메일 재분류 (${isDryRun ? "DRY-RUN 모드" : "COMMIT 모드"}) ===\n`);
  const db = initAdmin();

  // 1. 전체 messages 탐색
  const messagesSnap = await db.collection("messages").get();
  console.log(`총 ${messagesSnap.size}개 메시지 검사 중...`);

  const internalMessageThreadKeys = new Set();
  const internalIdentityIds = new Set();

  for (const doc of messagesSnap.docs) {
    const m = doc.data();
    const hasSignature = hasInternalSignature(m.bodyText);
    const isSenderStaff = isInternalAddress(m.from) || isInternalAddress(m.fromName);

    if (hasSignature || isSenderStaff) {
      if (m.threadKey) internalMessageThreadKeys.add(m.threadKey);
      if (m.from && m.from.includes("@")) {
        internalIdentityIds.add(`email:${m.from.trim().toLowerCase()}`);
      }
    }
  }

  console.log(`사내 서명/직원 발신 감지된 스레드 수: ${internalMessageThreadKeys.size}개`);
  console.log(`사내 서명/직원 발신 감지된 식별자 수: ${internalIdentityIds.size}개\n`);

  // 2. 식별자(conversationIdentities) 업데이트
  const updatedIdentities = [];
  for (const identityId of internalIdentityIds) {
    const identityRef = db.collection("conversationIdentities").doc(identityId);
    const snap = await identityRef.get();
    if (!snap.exists) continue;

    const data = snap.data();
    if (data.classification !== "internal") {
      updatedIdentities.push({ id: identityId, oldClassification: data.classification, conversationId: data.conversationId });
      if (!isDryRun) {
        await identityRef.update({
          classification: "internal",
          conversationId: null,
          buyerId: null,
          supplierId: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  console.log(`[식별자 재분류 대상] ${updatedIdentities.length}건:`);
  for (const item of updatedIdentities) {
    console.log(`  - ${item.id}: ${item.oldClassification} -> internal (기존 대화: ${item.conversationId || "없음"})`);
  }

  // 3. 스레드(threads) 업데이트
  const updatedThreads = [];
  for (const threadKey of internalMessageThreadKeys) {
    const threadRef = db.collection("threads").doc(threadKey);
    const snap = await threadRef.get();
    if (!snap.exists) continue;

    const data = snap.data();
    if (data.classification !== "internal" || data.side !== "internal") {
      updatedThreads.push({ threadKey, oldClassification: data.classification, oldSide: data.side });
      if (!isDryRun) {
        await threadRef.update({
          classification: "internal",
          side: "internal",
          sideSource: "account_rule",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  console.log(`\n[스레드 재분류 대상] ${updatedThreads.length}건:`);
  for (const item of updatedThreads) {
    console.log(`  - ${item.threadKey}: classification=${item.oldClassification}->internal, side=${item.oldSide}->internal`);
  }

  console.log(`\n=== 완료: ${isDryRun ? "DRY-RUN 완료 (실제 쓰기 미수행)" : "COMMIT 완료"} ===`);
}

run().catch((err) => {
  console.error("실행 중 오류 발생:", err);
  process.exit(1);
});
