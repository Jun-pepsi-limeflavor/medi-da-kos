import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

test("규칙 파일이 로드되고 catch-all이 막는다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("someuid").firestore();
  await assertFails(getDoc(doc(db, "nonexistent", "x")));
  assert.ok(true);
});
