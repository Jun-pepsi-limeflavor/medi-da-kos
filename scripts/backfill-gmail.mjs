#!/usr/bin/env node
// scripts/backfill-gmail.mjs
// Thomas 및 Hally 계정의 2026-08-01 이후 전체 메일을 Firestore로 백필하는 스크립트

import process from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getGmailToken, DEFAULT_GMAIL_MAILBOXES } from "../functions-ingest/google-auth.js";
import { getMessage, listAllMessageIds, normalizeMessage } from "../functions-ingest/gmail.js";
import { saveMessage, getIngestState, setIngestState } from "../functions-ingest/store.js";
import { gmailContext } from "../functions-ingest/index.js";

// 2026-08-01 00:00:00 KST = 2026-07-31 15:00:00 UTC
const AUGUST_1_EPOCH = Math.floor(Date.parse("2026-08-01T00:00:00+09:00") / 1000);

function getDb() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
    const sa = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

async function backfillAccount(db, account, afterEpoch) {
  console.log(`\n========================================`);
  console.log(`[백필 시작] 계정: ${account}, 기준 시각: ${new Date(afterEpoch * 1000).toISOString()}`);
  console.log(`========================================`);

  const token = await getGmailToken(account, { purpose: "read" });
  console.log(`[1/4] Gmail OAuth 토큰 발급 성공 (${account})`);

  const ids = await listAllMessageIds(token, { after: afterEpoch });
  console.log(`[2/4] 조회된 메시지 ID 목록: 총 ${ids.length}건`);

  if (ids.length === 0) {
    console.log(`[완료] 수집할 메시지가 없습니다.`);
    return { count: 0, newest: afterEpoch };
  }

  const context = gmailContext(account);
  let processed = 0;
  let newest = afterEpoch;
  const startTime = Date.now();

  // 순차 처리로 안전하게 트랜잭션 충돌 없이 적재
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const raw = await getMessage(token, id);
      const normalized = normalizeMessage(raw, context);
      await saveMessage(db, normalized);
      newest = Math.max(newest, Math.floor(Number(raw.internalDate) / 1000));
      processed++;

      if (processed % 25 === 0 || processed === ids.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  진행 상황: ${processed}/${ids.length} 완료 (${elapsed}초 경과)`);
      }
    } catch (err) {
      console.error(`  [경고] 메시지 ${id} 저장 실패:`, err.message);
    }
  }

  // ingestState 갱신
  const now = new Date().toISOString();
  await setIngestState(db, account, {
    lastEpochSeconds: newest,
    initialEpochSeconds: afterEpoch,
    lastAttemptAt: now,
    lastSuccessAt: now,
    lastError: null,
    processedCount: processed,
  });

  console.log(`[3/4] Firestore ingestState 갱신 완료 (lastEpoch: ${newest})`);
  console.log(`[4/4] ${account} 백필 완료! 총 ${processed}건 처리 완료.\n`);
  return { count: processed, newest };
}

async function main() {
  const db = getDb();
  const accounts = process.argv.slice(2).filter((a) => a.includes("@"));
  if (accounts.length === 0) throw new Error("백필할 계정을 인자로 지정하세요");

  console.log(`Gmail 백필 시작 (대상: ${accounts.join(", ")})`);
  console.log(`수집 기준일: 2026-08-01 00:00:00 KST (epoch: ${AUGUST_1_EPOCH})`);

  const results = {};
  for (const acc of accounts) {
    results[acc] = await backfillAccount(db, acc, AUGUST_1_EPOCH);
  }

  console.log(`\n========================================`);
  console.log(`[최종 백필 완료 결과]`);
  for (const [acc, res] of Object.entries(results)) {
    console.log(`- ${acc}: ${res.count}건 처리 완료 (최신 시각: ${new Date(res.newest * 1000).toISOString()})`);
  }
  console.log(`========================================`);
}

main().catch((err) => {
  console.error("FATAL ERROR in backfill:", err);
  process.exit(1);
});
