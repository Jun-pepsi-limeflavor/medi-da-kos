import { test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const UID = "buyer-1";
const safeProfile = {
  uid: UID, email: "b@example.com", displayName: "B",
  companyName: "", phone: "", country: "", provider: "google",
  createdAt: "2026-01-01T00:00:00.000Z", isTest: false,
};
const existing = { ...safeProfile, role: "user" };

async function seed(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", UID), existing);
  });
}

test("본인 문서를 읽을 수 있다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertSucceeds(getDoc(doc(db, "users", UID)));
});

test("가입 시 권한 필드 없이 안전 프로필을 생성할 수 있다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("new-uid").firestore();
  await assertSucceeds(
    setDoc(doc(db, "users", "new-uid"), { ...safeProfile, uid: "new-uid" }),
  );
});

test("안전 필드만 merge 수정할 수 있다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertSucceeds(
    setDoc(doc(db, "users", UID), { phone: "010-0000-0000" }, { merge: true }),
  );
});

test("role 을 admin 으로 바꿀 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertFails(
    setDoc(doc(db, "users", UID), { role: "admin" }, { merge: true }),
  );
});

test("가입 시 role: user 도 클라이언트가 쓰지 못한다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("evil-uid").firestore();
  await assertFails(
    setDoc(doc(db, "users", "evil-uid"), { ...safeProfile, uid: "evil-uid", role: "user" }),
  );
});

test("permissions 필드를 추가할 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertFails(
    setDoc(doc(db, "users", UID), { permissions: ["admin"] }, { merge: true }),
  );
});

test("문서를 삭제할 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertFails(deleteDoc(doc(db, "users", UID)));
});

test("남의 문서는 읽을 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext("other").firestore();
  await assertFails(getDoc(doc(db, "users", UID)));
});
