// Retired features (2026-11-18 V1.1): landing forms, orders, sample requests, Dashboard briefs, tracking, test.
// Existing documents stay; clients may only read their own legacy records and can never write.
import { test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const OWNER = "retired-owner";
const OTHER = "retired-other";

async function seed(env, path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ...path), data);
  });
}

// The old landing form payload (catalog variant) that the previous rules accepted.
const landingCatalog = {
  landingVariant: "catalog",
  companyName: "Acme Beauty",
  contactName: "Jane Doe",
  email: "jane@acme.example",
  country: "United States",
  expectedVolume: "1,000 units",
  catalogItems: [{ id: "serum-1", name: "Pink Serum", category: "serum" }],
  pageUrl: "https://www.medidakos.com/landing/catalog",
  isTest: true,
  status: "new",
  createdAt: "2026-08-27T00:00:00.000Z",
  serverCreatedAt: serverTimestamp(),
};

test("landingRequests: 비로그인·로그인 모두 새 문서를 만들 수 없다", async () => {
  const env = await getTestEnv();
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "landingRequests", "new-anon"), landingCatalog));
  await assertFails(setDoc(doc(env.authenticatedContext(OWNER).firestore(), "landingRequests", "new-auth"), landingCatalog));
});

test("landingRequests: 기존 문서는 읽기·수정·삭제 모두 불가", async () => {
  const env = await getTestEnv();
  await seed(env, ["landingRequests", "legacy-landing"], { ...landingCatalog, serverCreatedAt: new Date() });
  const db = env.unauthenticatedContext().firestore();
  const ref = doc(db, "landingRequests", "legacy-landing");
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { message: "changed" }));
  await assertFails(deleteDoc(ref));
});

for (const collection of ["orders", "sampleRequests"]) {
  test(`${collection}: 본인 uid로도 새로 만들 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext(OWNER).firestore();
    await assertFails(setDoc(doc(db, collection, `new-${collection}`), { uid: OWNER, status: "submitted" }));
  });

  test(`${collection}: 기존 문서는 본인만 읽고, 수정·삭제는 불가`, async () => {
    const env = await getTestEnv();
    await seed(env, [collection, `legacy-${collection}`], { uid: OWNER, status: "submitted" });
    const own = doc(env.authenticatedContext(OWNER).firestore(), collection, `legacy-${collection}`);
    await assertSucceeds(getDoc(own));
    await assertFails(updateDoc(own, { status: "changed" }));
    await assertFails(deleteDoc(own));
    await assertFails(getDoc(doc(env.authenticatedContext(OTHER).firestore(), collection, `legacy-${collection}`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), collection, `legacy-${collection}`)));
  });
}

test("cmBriefs: 본인 문서 읽기만 허용, 생성·수정·삭제 불가", async () => {
  const env = await getTestEnv();
  await seed(env, ["cmBriefs", OWNER], { step1: { selection: "skincare" } });
  const own = doc(env.authenticatedContext(OWNER).firestore(), "cmBriefs", OWNER);
  await assertSucceeds(getDoc(own));
  await assertFails(setDoc(own, { step1: { selection: "makeup" } }, { merge: true }));
  await assertFails(deleteDoc(own));
  await assertFails(setDoc(doc(env.authenticatedContext(OTHER).firestore(), "cmBriefs", OTHER), { step1: {} }));
  await assertFails(getDoc(doc(env.authenticatedContext(OTHER).firestore(), "cmBriefs", OWNER)));
});

test("tracking/{uid}/entries: 본인 기록 읽기만 허용, 쓰기 불가", async () => {
  const env = await getTestEnv();
  await seed(env, ["tracking", OWNER, "entries", "e1"], { note: "legacy" });
  const db = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(getDoc(doc(db, "tracking", OWNER, "entries", "e1")));
  await assertFails(setDoc(doc(db, "tracking", OWNER, "entries", "e2"), { note: "new" }));
  await assertFails(updateDoc(doc(db, "tracking", OWNER, "entries", "e1"), { note: "changed" }));
  await assertFails(deleteDoc(doc(db, "tracking", OWNER, "entries", "e1")));
  await assertFails(getDoc(doc(env.authenticatedContext(OTHER).firestore(), "tracking", OWNER, "entries", "e1")));
});

test("test: 로그인 사용자도 읽기·쓰기 불가", async () => {
  const env = await getTestEnv();
  await seed(env, ["test", "legacy-test"], { value: 1 });
  const db = env.authenticatedContext(OWNER).firestore();
  await assertFails(getDoc(doc(db, "test", "legacy-test")));
  await assertFails(setDoc(doc(db, "test", "new-test"), { value: 2 }));
  await assertFails(deleteDoc(doc(db, "test", "legacy-test")));
});
