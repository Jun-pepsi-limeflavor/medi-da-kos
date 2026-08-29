import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("CatalogLanding fires catalog-scoped events with catalog_category param naming", async () => {
  const content = await source("../src/components/landing/CatalogLanding.tsx");

  assert.match(content, /trackLandingEvent\("catalog_category_view", "catalog", \{ catalog_category: category \}\)/);
  assert.match(content, /catalog_category: nextCategory/);
  assert.match(content, /catalog_category: product\.category/);
  assert.match(content, /"catalog_product_select"[\s\S]{0,120}cart_size: next\.length/);
  assert.match(content, /"catalog_product_remove"/);
  assert.match(content, /cta_id: "request_consultation"/);
  assert.match(content, /<LandingSignals variant="catalog" \/>/);

  // 폐기된 이벤트가 되살아나지 않는지 회귀 확인
  assert.doesNotMatch(content, /consultation_start/);
  assert.doesNotMatch(content, /product_category:/);
});

test("ConsultationForm fires form_view/form_start/form_abandon/generate_lead", async () => {
  const content = await source("../src/components/landing/ConsultationForm.tsx");

  assert.match(content, /"form_view", variant, \{ form_id: "landing-consultation" \}/);
  assert.match(content, /"form_start", variant/);
  assert.match(content, /"form_abandon", variant[\s\S]{0,200}transport_type: "beacon"/);
  assert.match(content, /"generate_lead", variant[\s\S]{0,80}lead_type: "consultation"/);
  assert.match(content, /addEventListener\("pagehide", onLeave\)/);

  assert.doesNotMatch(content, /"consultation_submit"/);
});

test("CMWizard replaces dashboard_step_view with brief_step_open/complete", async () => {
  const content = await source("../src/components/dashboard/CMWizard.tsx");

  assert.match(content, /"brief_step_open", "dashboard"/);
  assert.match(content, /"brief_step_complete", "dashboard"/);
  assert.match(content, /getBriefStepLabel\(currentStep\)/);
  assert.match(content, /getBriefStepLabel\(completingStep\)/);
  assert.match(content, /<LandingSignals variant="dashboard" \/>/);

  assert.doesNotMatch(content, /dashboard_step_view/);
});

test("LandingDashboardHeader fires cta_click for start_brief and scroll_to_form", async () => {
  const content = await source("../src/components/landing/LandingDashboardHeader.tsx");

  assert.match(content, /cta_id: "start_brief"/);
  assert.match(content, /cta_id: "scroll_to_form"/);
  assert.match(content, /data-cta="start_brief"/);
  assert.match(content, /data-cta="scroll_to_form"/);
});

test("LandingDashboard no longer fires the deprecated consultation_start event", async () => {
  const content = await source("../src/components/landing/LandingDashboard.tsx");

  assert.doesNotMatch(content, /consultation_start/);
  assert.doesNotMatch(content, /lib\/landing\/analytics/);
});

test("korea's own event surface is unchanged by the LandingSignals generalization", async () => {
  const analytics = await source("../src/app/landing/korea/analytics.ts");
  const page = await source("../src/app/landing/korea/page.tsx");
  const koreaSignals = await source("../src/app/landing/korea/KoreaLandingSignals.tsx");

  for (const name of ["section_view", "faq_open", "positioning_arm", "scroll_depth", "cta_view", "engaged_15s", "form_start", "form_abandon"]) {
    assert.ok(analytics.includes(name), `korea/analytics.ts should still reference ${name}`);
  }
  assert.match(page, /<KoreaLandingSignals arm=\{arm\} \/>/);
  assert.match(koreaSignals, /<LandingSignals variant="korea" arm=\{arm\} emit=\{track\} \/>/);
});
