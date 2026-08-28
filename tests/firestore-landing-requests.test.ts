import { readFile } from "node:fs/promises";
import { test, before, after } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const base = {
  companyName: "Acme Beauty",
  contactName: "Jane Doe",
  email: "jane@acme.example",
  country: "United States",
  expectedVolume: "1,000 units",
  pageUrl: "https://www.medidakos.com/landing/catalog",
  isTest: true,
  status: "new",
  createdAt: "2026-08-27T00:00:00.000Z",
  serverCreatedAt: serverTimestamp(),
};

function catalogRequest(overrides: Record<string, unknown> = {}) {
  return {
    ...base,
    landingVariant: "catalog",
    catalogItems: [
      { id: "serum-1", name: "Pink Serum", category: "serum" },
    ],
    ...overrides,
  };
}

function dashboardRequest(overrides: Record<string, unknown> = {}) {
  return {
    ...base,
    landingVariant: "dashboard",
    dashboardBrief: { currentStep: 6, step1: { selection: "skincare" } },
    ...overrides,
  };
}

function koreaRequest(overrides: Record<string, unknown> = {}) {
  return {
    ...base,
    landingVariant: "korea",
    referralSource: "cold email",
    businessType: "Indie Brand",
    positioningArm: "arm-a",
    ...overrides,
  };
}

async function unauthenticatedDoc(id: string) {
  return doc(testEnv.unauthenticatedContext().firestore(), "landingRequests", id);
}

before(async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-medidakos-landing-ab",
    firestore: { rules },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test("unauthenticated buyers can create valid catalog, dashboard, and korea requests", async () => {
  await assertSucceeds(setDoc(await unauthenticatedDoc("valid-catalog"), catalogRequest()));
  const fiveItems = Array.from({ length: 5 }, (_, index) => ({
    id: `serum-${index + 1}`,
    name: `Serum ${index + 1}`,
    category: "serum",
  }));
  await assertSucceeds(
    setDoc(
      await unauthenticatedDoc("valid-catalog-five-items"),
      catalogRequest({ catalogItems: fiveItems }),
    ),
  );
  await assertSucceeds(
    setDoc(await unauthenticatedDoc("valid-dashboard"), dashboardRequest()),
  );
  await assertSucceeds(
    setDoc(await unauthenticatedDoc("valid-korea"), koreaRequest()),
  );
});

test("public clients cannot read, update, or delete landing requests", async () => {
  const ref = await unauthenticatedDoc("create-only");
  await assertSucceeds(setDoc(ref, catalogRequest()));
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, { message: "changed" }));
  await assertFails(deleteDoc(ref));
});

test("rules reject malformed emails and missing required fields", async () => {
  await assertFails(
    setDoc(await unauthenticatedDoc("bad-email"), catalogRequest({ email: "not-an-email" })),
  );
  await assertFails(
    setDoc(await unauthenticatedDoc("missing-company"), catalogRequest({ companyName: "" })),
  );
  await assertFails(
    setDoc(await unauthenticatedDoc("missing-volume"), catalogRequest({ expectedVolume: "" })),
  );
});

test("rules reject unknown keys, oversized messages, and more than five catalog items", async () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    id: `serum-${index}`,
    name: `Serum ${index}`,
    category: "serum",
  }));
  await assertFails(
    setDoc(await unauthenticatedDoc("extra-key"), catalogRequest({ unexpected: true })),
  );
  await assertFails(
    setDoc(await unauthenticatedDoc("oversized-message"), catalogRequest({ message: "x".repeat(5001) })),
  );
  await assertFails(
    setDoc(await unauthenticatedDoc("too-many-items"), catalogRequest({ catalogItems: items })),
  );
});

test("rules require the variant payload to match landingVariant", async () => {
  await assertFails(
    setDoc(
      await unauthenticatedDoc("catalog-with-dashboard"),
      catalogRequest({ dashboardBrief: { currentStep: 6 } }),
    ),
  );
  await assertFails(
    setDoc(
      await unauthenticatedDoc("dashboard-with-catalog"),
      dashboardRequest({ catalogItems: [{ id: "serum-1", name: "Pink Serum", category: "serum" }] }),
    ),
  );
  await assertFails(
    setDoc(
      await unauthenticatedDoc("dashboard-without-brief"),
      {
        ...base,
        landingVariant: "dashboard",
      },
    ),
  );
});

test("rules reject spoofed non-timestamp server values", async () => {
  await assertFails(
    setDoc(
      await unauthenticatedDoc("spoofed-server-timestamp"),
      catalogRequest({ serverCreatedAt: "2026-08-27T00:00:00.000Z" }),
    ),
  );
});
