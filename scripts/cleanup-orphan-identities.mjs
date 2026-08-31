#!/usr/bin/env node
// 잘린 이메일로 만들어진 고아 conversationIdentities 정리.
// parseAddress 버그(꺾쇠 없는 맨 주소의 앞글자를 이름으로 먹음)로 "support@x" 가
// "t@x" 로 저장되면서 잘못된 신원이 대량 생성됐다. 메시지를 재수집해 신원을
// 바로잡은 뒤, 어떤 스레드도 참조하지 않게 된 잔재만 지운다.
//
//   BACKUP_PATH=/tmp/orphans.json node --env-file=.env.local scripts/cleanup-orphan-identities.mjs
//   APPLY=1 BACKUP_PATH=... node --env-file=.env.local scripts/cleanup-orphan-identities.mjs
//
// 기본은 드라이런이며, 어느 쪽이든 대상 전체를 BACKUP_PATH 에 먼저 덤프한다.
import { writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: cert(JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64,"base64").toString("utf8"))) });
const db = getFirestore();
const trunc = (a) => typeof a === "string" && /^[^@\s]@[^@\s]+$/.test(a);
const [ids, threads] = await Promise.all([
  db.collection("conversationIdentities").get(), db.collection("threads").get(),
]);
const refByThread = new Set(threads.docs.map(d=>d.data().identityId).filter(Boolean));
const targets = ids.docs.filter(d => trunc(d.data().value) && !refByThread.has(d.id));
writeFileSync(process.env.BACKUP_PATH, JSON.stringify(targets.map(d=>({id:d.id, data:d.data()})), null, 2));
console.log("백업:", targets.length, "건 →", process.env.BACKUP_PATH);
if (process.env.APPLY !== "1") { console.log("드라이런. 삭제 안 함."); process.exit(0); }
let n = 0;
for (let i = 0; i < targets.length; i += 400) {
  const batch = db.batch();
  for (const d of targets.slice(i, i + 400)) { batch.delete(d.ref); n++; }
  await batch.commit();
}
console.log("삭제 완료:", n);
