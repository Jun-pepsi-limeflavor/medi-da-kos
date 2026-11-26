// cookieConsentLogs: 서버(Admin SDK)만 쓴다. 브라우저(익명·로그인)는 읽기·쓰기·수정·삭제 모두 불가.
// 규칙 변경 없이 기존 마지막 전체 거부 규칙(match /{document=**})으로 막히는지 확인한다.
import { test } from "node:test";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const PATH = ["cookieConsentLogs", "6f1c1f52-6a7b-4c1e-8f3a-2d9b8c7e6a51"];
const record = {
  consentId: "0b6f2d64-3f1a-4c5e-9d2b-7a1e5c3b9f00",
  action: "consent",
  analytics: true,
  marketing: true,
  policyVersion: 2,
  noticeHash: "0".repeat(64),
  source: "banner",
};

test("cookieConsentLogs: anonymous and signed-in clients cannot create, read, list, update or delete", async () => {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ...PATH), record);
  });
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext("user-1")]) {
    const db = ctx.firestore();
    await assertFails(setDoc(doc(db, "cookieConsentLogs", "f2a4c6e8-1b3d-4f5a-9c7e-0d2b4f6a8c1e"), record));
    await assertFails(getDoc(doc(db, ...PATH)));
    await assertFails(getDocs(collection(db, "cookieConsentLogs")));
    await assertFails(updateDoc(doc(db, ...PATH), { analytics: false }));
    await assertFails(deleteDoc(doc(db, ...PATH)));
  }
});
