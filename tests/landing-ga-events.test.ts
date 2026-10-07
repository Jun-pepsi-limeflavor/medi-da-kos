import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { trackLandingEvent } from "../src/lib/landing/analytics.ts";
import { consultationLeadParams } from "../src/lib/landing/lead-event.ts";
import { parseLandingAttribution } from "../src/components/landing/useLandingAttribution.ts";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

function captureGtag(href: string, run: () => void) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  const url = new URL(href);
  globalScope.window = {
    location: { hostname: url.hostname, search: url.search },
    gtag: (_command: string, name: string, params: Record<string, unknown>) => calls.push({ name, params }),
  };
  try {
    run();
  } finally {
    globalScope.window = previous;
  }
  return calls;
}

const coldmailUrl = (path: string) =>
  `https://www.medidakos.com${path}?utm_source=cold-outreach&utm_medium=email&utm_campaign=2026q4-test&utm_content=arm-a&utm_term=acme-beauty`;

for (const variant of ["catalog", "dashboard"] as const) {
  test(`${variant} generate_lead carries the route variant and the UTM values unchanged`, () => {
    const href = coldmailUrl(`/landing/${variant}`);
    const attribution = parseLandingAttribution(href);
    const calls = captureGtag(href, () => {
      trackLandingEvent("generate_lead", variant, consultationLeadParams("1,000–5,000", attribution));
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "generate_lead");
    assert.deepEqual(calls[0].params, {
      form_id: "landing-consultation",
      lead_type: "consultation",
      expected_volume: "1,000–5,000",
      utm_source: "cold-outreach",
      utm_medium: "email",
      utm_campaign: "2026q4-test",
      utm_content: "arm-a",
      landing_variant: variant,
      is_test: false,
    });
  });
}

test("utm_content arm values never change the landing variant, and utm_term stays out of GA", () => {
  for (const arm of ["arm-a", "arm-b", "followup-1"]) {
    const href = `https://www.medidakos.com/landing/dashboard?utm_content=${arm}&utm_term=acme-beauty`;
    const attribution = parseLandingAttribution(href);
    assert.equal(attribution.utmContent, arm);
    assert.equal(attribution.utmTerm, "acme-beauty");
    const params = consultationLeadParams("Not sure yet", attribution);
    assert.equal(params.utm_content, arm);
    assert.equal("utm_term" in params, false);
    const [call] = captureGtag(href, () => trackLandingEvent("generate_lead", "dashboard", params));
    assert.equal(call.params.landing_variant, "dashboard");
  }
});

test("landing events are marked as test outside the production host", () => {
  const [local] = captureGtag("http://localhost:3000/landing/catalog", () => trackLandingEvent("form_view", "catalog"));
  const [qa] = captureGtag("https://www.medidakos.com/landing/catalog?qa=1", () => trackLandingEvent("form_view", "catalog"));
  assert.equal(local.params.is_test, true);
  assert.equal(qa.params.is_test, true);
});

test("korea keeps every existing event and positioning_arm, and adds landing_variant korea", async () => {
  const [analytics, leadForm, page, signals] = await Promise.all([
    source("../src/app/landing/korea/analytics.ts"),
    source("../src/app/landing/korea/KoreaLeadForm.tsx"),
    source("../src/app/landing/korea/page.tsx"),
    source("../src/app/landing/korea/KoreaPageSignals.tsx"),
  ]);

  assert.match(
    analytics,
    /trackConversionEvent\(event, \{ \.\.\.params, positioning_arm: armForSession, landing_variant: "korea" \}\)/,
  );
  for (const name of ["scroll_depth", "section_view", "faq_open", "cta_click", "form_start", "form_abandon", "cta_view", "engaged_15s"]) {
    assert.ok(analytics.includes(`"${name}"`), `korea analytics should still send ${name}`);
  }
  assert.match(analytics, /form_id: "coldmail-landing"/);

  assert.match(
    leadForm,
    /trackConversionEvent\("generate_lead", \{\s*form_id: "coldmail-landing",\s*lead_type: "quote",\s*positioning_arm: positioningArm,\s*landing_variant: "korea",/,
  );
  assert.match(leadForm, /landingVariant: "korea"/);
  assert.match(leadForm, /channelUserIdField\(getChannelTalkUserId\(\)\)/);

  assert.match(page, /return value === "arm-a" \? "arm-a" : "arm-b";/);
  assert.match(page, /<KoreaPageSignals arm=\{arm\} \/>/);
  assert.match(signals, /setKoreaArm\(arm\)/);
});

test("catalog and dashboard keep their existing events and add the shared funnel", async () => {
  const [form, catalog, dashboard, header, wizard, catalogPage, dashboardPage] = await Promise.all([
    source("../src/components/landing/ConsultationForm.tsx"),
    source("../src/components/landing/CatalogLanding.tsx"),
    source("../src/components/landing/LandingDashboard.tsx"),
    source("../src/components/landing/LandingDashboardHeader.tsx"),
    source("../src/components/dashboard/CMWizard.tsx"),
    source("../src/app/landing/catalog/page.tsx"),
    source("../src/app/landing/dashboard/page.tsx"),
  ]);

  // 제출: 기존 consultation_submit 뒤에 공통 generate_lead. Channel Talk 식별 필드는 그대로.
  assert.match(form, /submitLandingRequest\(input, \{ \.\.\.attribution, \.\.\.channelUserIdField\(getChannelTalkUserId\(\)\) \}\)/);
  assert.match(form, /trackLandingEvent\("consultation_submit", variant,[\s\S]*trackLandingEvent\("generate_lead", variant, consultationLeadParams\(/);
  for (const name of ["form_view", "form_start", "form_abandon"]) {
    assert.match(form, new RegExp(`trackLandingEvent\\("${name}", variant, \\{\\s*form_id: LANDING_CONSULTATION_FORM_ID`));
  }

  for (const name of ["consultation_start", "catalog_category_view", "catalog_product_view", "catalog_product_select"]) {
    assert.ok(catalog.includes(`"${name}"`), `catalog should still send ${name}`);
  }
  assert.match(catalog, /cta_id: "request_consultation"/);
  assert.match(catalog, /data-cta="request_consultation"/);
  assert.match(catalog, /cta_id: "discuss_product"/);

  assert.match(dashboard, /trackLandingEvent\("consultation_start", "dashboard"\)/);
  assert.match(wizard, /trackLandingEvent\("dashboard_step_view", "dashboard"/);
  assert.match(header, /cta_id: "start_brief"/);
  assert.match(header, /data-cta="start_brief"/);
  assert.match(header, /cta_id: "scroll_to_form"/);

  assert.match(catalogPage, /<LandingSignals variant="catalog" \/>/);
  assert.match(dashboardPage, /<LandingSignals variant="dashboard" \/>/);
});

test("GA code does not encode the sender-to-landing policy", async () => {
  const files = await Promise.all([
    source("../src/components/landing/LandingSignals.tsx"),
    source("../src/lib/landing/lead-event.ts"),
    source("../src/lib/landing/analytics.ts"),
    source("../src/app/landing/korea/analytics.ts"),
  ]);
  for (const content of files) assert.doesNotMatch(content, /hally|thomas/i);
});
