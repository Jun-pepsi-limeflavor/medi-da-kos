import assert from "node:assert/strict";
import { test } from "node:test";
import type { CMBrief } from "../src/lib/types.ts";
import {
  LANDING_DASHBOARD_DRAFT_KEY,
  createEmptyLandingDashboardDraft,
  loadLandingDashboardDraft,
  saveLandingDashboardDraft,
  advanceLandingDashboardStep,
  landingDashboardSnapshot,
} from "../src/lib/landing/dashboard-draft.ts";

const storage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    read(key: string) {
      return values.get(key);
    },
  };
};

test("landing dashboard uses the versioned local-storage key and empty default", () => {
  const empty = createEmptyLandingDashboardDraft();

  assert.equal(LANDING_DASHBOARD_DRAFT_KEY, "medidakos:landing-dashboard-brief:v1");
  assert.equal(empty.currentStep, 1);
  assert.equal(empty.status, "draft");
  assert.equal(empty.requestType, "custom");
});

test("valid JSON drafts load and malformed JSON recovers to an empty draft", () => {
  const valid = createEmptyLandingDashboardDraft();
  valid.currentStep = 4;
  const validStore = storage({
    [LANDING_DASHBOARD_DRAFT_KEY]: JSON.stringify(valid),
  });

  assert.deepEqual(loadLandingDashboardDraft(validStore), valid);

  const malformedStore = storage({
    [LANDING_DASHBOARD_DRAFT_KEY]: "{not-json",
  });
  assert.deepEqual(
    loadLandingDashboardDraft(malformedStore),
    createEmptyLandingDashboardDraft(),
  );
});

test("draft persistence writes only to the versioned local-storage key", () => {
  const draft = createEmptyLandingDashboardDraft();
  const store = storage();

  saveLandingDashboardDraft(store, draft);
  assert.equal(store.read(LANDING_DASHBOARD_DRAFT_KEY), JSON.stringify(draft));
});

test("step advance is capped at step six", () => {
  const draft = { ...createEmptyLandingDashboardDraft(), currentStep: 6 };
  assert.equal(advanceLandingDashboardStep(draft).currentStep, 6);
  assert.equal(advanceLandingDashboardStep({ ...draft, currentStep: 5 }).currentStep, 6);
});

test("landing submission snapshots preserve logo filename and remove logo data URL", () => {
  const brief = {
    ...createEmptyLandingDashboardDraft(),
    currentStep: 6,
    step3: {
      logoFileName: "brand.svg",
      logoDataUrl: "data:image/svg+xml;base64,AAA",
    },
  } as CMBrief;
  const snapshot = landingDashboardSnapshot(brief);

  assert.deepEqual(snapshot.step3, { logoFileName: "brand.svg" });
  assert.equal(JSON.stringify(snapshot).includes("logoDataUrl"), false);
});
