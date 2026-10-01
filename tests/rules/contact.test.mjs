import { test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const valid = {
  companyName: "Acme Beauty",
  email: "jane@acme.example",
  message: "We'd like to develop a serum.",
  status: "submitted",
  createdAt: "2026-10-01T00:00:00.000Z",
};

function anon(env) {
  return collection(env.unauthenticatedContext().firestore(), "contact");
}

function signedIn(env, uid) {
  return collection(env.authenticatedContext(uid).firestore(), "contact");
}

test("비로그인 문의를 uid 없이 생성할 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), valid));
});

test("비로그인 문의에 uid를 넣을 수 없다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...valid, uid: "buyer-1" }));
});

test("로그인 사용자는 본인 uid로 문의할 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(signedIn(env, "buyer-1"), { ...valid, uid: "buyer-1" }));
});

test("로그인 사용자도 남의 uid로 문의할 수 없다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(signedIn(env, "buyer-1"), { ...valid, uid: "buyer-2" }));
});

test("로그인 사용자는 uid 없이도 문의할 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(signedIn(env, "buyer-1"), valid));
});

test("channelUserId는 64자 이하 문자열이면 허용한다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), { ...valid, channelUserId: "6abe09fe96c07cc647f8" }));
  await assertSucceeds(addDoc(anon(env), { ...valid, channelUserId: "x".repeat(64) }));
  await assertSucceeds(addDoc(anon(env), { ...valid, channelUserId: "" }));
});

test("channelUserId가 64자를 넘거나 문자열이 아니면 거부한다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...valid, channelUserId: "x".repeat(65) }));
  await assertFails(addDoc(anon(env), { ...valid, channelUserId: 12345 }));
});

test("기존 필수 필드 검증은 그대로다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...valid, email: "not-an-email" }));
  await assertFails(addDoc(anon(env), { ...valid, status: "new" }));
});

test("문의는 읽을 수 없다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("buyer-1").firestore();
  await assertFails(getDoc(doc(db, "contact", "any")));
});
