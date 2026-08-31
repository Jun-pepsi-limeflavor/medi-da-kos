import { test } from "node:test";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const PATHS = [
  ["conversationIdentities", "identity-1"],
  ["conversations", "conversation-1"],
  ["conversations", "conversation-1", "brief", "current"],
  ["conversations", "conversation-1", "events", "event-1"],
];

for (const path of PATHS) {
  const label = path.join("/");
  for (const [actor, createContext] of [
    ["anonymous", (env) => env.unauthenticatedContext()],
    ["authenticated", (env) => env.authenticatedContext("anyone")],
  ]) {
    test(`${actor} browser client cannot read ${label}`, async () => {
      const env = await getTestEnv();
      const db = createContext(env).firestore();
      await assertFails(getDoc(doc(db, ...path)));
    });

    test(`${actor} browser client cannot write ${label}`, async () => {
      const env = await getTestEnv();
      const db = createContext(env).firestore();
      await assertFails(setDoc(doc(db, ...path), { value: "blocked" }));
    });
  }
}
