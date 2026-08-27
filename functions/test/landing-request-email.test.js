/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildLandingRequestEmail } = require("../landing-request-email");

const submittedAt = "2026-08-27 12:34:56";

function request(overrides = {}) {
  return {
    landingVariant: "catalog",
    companyName: "Acme <script>alert(1)</script>",
    contactName: 'Jane "JJ" O\'Doe',
    email: "jane&acme.example",
    country: "US & Canada",
    expectedVolume: "1,000 < 5,000",
    message: "Please use <b>vegan</b> & fragrance-free.",
    catalogItems: [
      {
        id: "serum-1",
        name: "PINK <SERUM> & BOOST",
        category: "serum",
      },
    ],
    utmSource: "cold-email",
    pageUrl: "https://www.medidakos.com/landing/catalog?utm_content=catalog",
    isTest: false,
    status: "new",
    ...overrides,
  };
}

test("catalog notification contains a useful summary and never addresses the buyer", () => {
  const notification = buildLandingRequestEmail("req-catalog-1", request(), submittedAt);

  assert.equal(typeof notification.subject, "string");
  assert.match(notification.subject, /catalog/i);
  assert.match(notification.html, /Acme/);
  assert.match(notification.html, /PINK/);
  assert.match(notification.html, /landingRequests\/req-catalog-1/);
  assert.equal("to" in notification, false);
  assert.equal("recipient" in notification, false);
});

test("dashboard notification contains dashboard brief summary", () => {
  const notification = buildLandingRequestEmail(
    "req-dashboard-1",
    request({
      landingVariant: "dashboard",
      catalogItems: undefined,
      dashboardBrief: {
        currentStep: 6,
        step1: { selection: "skincare" },
        step4: { orderQuantity: "5,000" },
      },
    }),
    submittedAt,
  );

  assert.match(notification.subject, /dashboard/i);
  assert.match(notification.html, /Step 6|dashboard brief/i);
  assert.match(notification.html, /5,000/);
});

test("all buyer-provided HTML values are escaped", () => {
  const notification = buildLandingRequestEmail("req-escape", request(), submittedAt);
  const html = notification.html;

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;vegan&lt;\/b&gt;/);
  assert.match(html, /&amp;/);
  assert.match(html, /&quot;/);
  assert.match(html, /&#39;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<b>vegan<\/b>/);
});

test("missing optional values are rendered safely", () => {
  const notification = buildLandingRequestEmail(
    "req-minimal",
    request({
      message: undefined,
      catalogItems: undefined,
      dashboardBrief: { currentStep: 6 },
      utmSource: undefined,
    }),
    submittedAt,
  );

  assert.equal(typeof notification.html, "string");
  assert.doesNotMatch(notification.html, /undefined|null/);
});
