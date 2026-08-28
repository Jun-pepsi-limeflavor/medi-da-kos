import { test } from "node:test";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const COLLECTIONS = [
  "buyers", "suppliers", "deals", "messages", "threads", "intakeReviews", "ingestState",
];

for (const col of COLLECTIONS) {
  test(`로그인 사용자가 ${col} 를 읽을 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("anyone").firestore();
    await assertFails(getDoc(doc(db, col, "x")));
  });

  test(`로그인 사용자가 ${col} 에 쓸 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("anyone").firestore();
    await assertFails(setDoc(doc(db, col, "x"), { a: 1 }));
  });

  test(`비로그인도 ${col} 를 읽을 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, col, "x")));
  });
}

for (const sub of [
  "items", "supplierEngagements", "private", "sampleRounds", "shipments", "tasks", "events",
]) {
  test(`deals 하위 ${sub} 서브컬렉션도 막힌다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("anyone").firestore();
    await assertFails(getDoc(doc(db, "deals", "d1", sub, "x")));
  });
}
