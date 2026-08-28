import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLandingRequest,
  validateLandingContact,
} from "../src/lib/landing/request.ts";
import { trackLandingEvent } from "../src/lib/landing/analytics.ts";
import type { LandingRequestInput } from "../src/lib/landing/types.ts";

const context = {
  pageUrl: "https://www.medidakos.com/landing/catalog?utm_content=catalog",
  gaClientId: "GA1.1.123.456",
  userAgent: "test-browser/1.0",
};

const contact = {
  companyName: "Acme Beauty",
  contactName: "Jane Doe",
  email: "jane@acme.example",
  country: "United States",
  expectedVolume: "1,000 units",
  message: "We are looking for a gentle daily serum.",
};

const catalogItem = {
  id: "niacinamide-2-saponin-pink-serum",
  name: "NIACINAMIDE 2% + SAPONIN PINK SERUM",
  category: "serum" as const,
};

function catalogInput(overrides: Record<string, unknown> = {}): LandingRequestInput {
  return {
    ...contact,
    landingVariant: "catalog" as const,
    catalogItems: [catalogItem],
    ...overrides,
  } as LandingRequestInput;
}

function dashboardInput(overrides: Record<string, unknown> = {}): LandingRequestInput {
  return {
    ...contact,
    landingVariant: "dashboard" as const,
    dashboardBrief: {
      uid: "landing-guest",
      currentStep: 6,
      requestType: "custom",
      status: "draft",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
      step3: {
        logoFileName: "brand.svg",
        logoDataUrl: "data:image/svg+xml;base64,AAA",
      },
    },
    ...overrides,
  } as LandingRequestInput;
}

function koreaInput(overrides: Record<string, unknown> = {}): LandingRequestInput {
  return {
    companyName: "Seoul Beauty Co",
    email: "buyer@seoulbeauty.com",
    expectedVolume: "5,000 units",
    referralSource: "Cold Email",
    businessType: "Indie Brand",
    positioningArm: "arm-a",
    message: "Looking for OEM partner",
    landingVariant: "korea" as const,
    ...overrides,
  } as LandingRequestInput;
}

test("valid catalog input builds a create-only landing request", () => {
  const request = buildLandingRequest(catalogInput(), context);

  assert.equal(request.landingVariant, "catalog");
  assert.equal(request.companyName, contact.companyName);
  assert.deepEqual(request.catalogItems, [catalogItem]);
  assert.equal(request.dashboardBrief, undefined);
  assert.equal(request.status, "new");
  assert.equal(request.isTest, true);
  assert.equal(request.pageUrl, context.pageUrl);
  assert.equal(request.gaClientId, context.gaClientId);
  assert.equal(request.userAgent, context.userAgent);
  assert.equal(typeof request.createdAt, "string");
});

test("valid korea input builds a create-only landing request", () => {
  const request = buildLandingRequest(koreaInput(), context);

  assert.equal(request.landingVariant, "korea");
  assert.equal(request.companyName, "Seoul Beauty Co");
  assert.equal(request.contactName, "Seoul Beauty Co");
  assert.equal(request.country, "Global");
  assert.equal(request.businessType, "Indie Brand");
  assert.equal(request.referralSource, "Cold Email");
  assert.equal(request.positioningArm, "arm-a");
  assert.equal(request.catalogItems, undefined);
  assert.equal(request.dashboardBrief, undefined);
  assert.equal(request.status, "new");
  assert.equal(request.isTest, true);
});

test("contact validation reports every blank required field", () => {
  const errors = validateLandingContact({
    companyName: " ",
    contactName: "",
    email: "not-an-email",
    country: " ",
    expectedVolume: "",
    message: "x".repeat(5001),
  });

  assert.deepEqual(Object.keys(errors).sort(), [
    "companyName",
    "contactName",
    "country",
    "email",
    "expectedVolume",
    "message",
  ]);
});

test("contact validation enforces the specified field lengths", () => {
  const errors = validateLandingContact({
    companyName: "x".repeat(201),
    contactName: "x".repeat(121),
    email: `${"x".repeat(316)}@a.co`,
    country: "x".repeat(101),
    expectedVolume: "x".repeat(41),
    message: "x".repeat(5001),
  });

  assert.ok(errors.companyName);
  assert.ok(errors.contactName);
  assert.ok(errors.email);
  assert.ok(errors.country);
  assert.ok(errors.expectedVolume);
  assert.ok(errors.message);
});

test("catalog input cannot carry a dashboard brief", () => {
  assert.throws(
    () =>
      buildLandingRequest(
        catalogInput({ dashboardBrief: { currentStep: 6 } }),
        context,
      ),
    /catalog request cannot include dashboardBrief/i,
  );
});

test("dashboard input cannot carry catalog items", () => {
  assert.throws(
    () =>
      buildLandingRequest(
        dashboardInput({ catalogItems: [catalogItem] }),
        context,
      ),
    /dashboard request cannot include catalogItems/i,
  );
});

test("a catalog consultation is capped at five products", () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    ...catalogItem,
    id: `${catalogItem.id}-${index}`,
  }));

  assert.throws(
    () => buildLandingRequest(catalogInput({ catalogItems: items }), context),
    /5|five/i,
  );
});

test("dashboard snapshots omit the uploaded logo data URL", () => {
  const request = buildLandingRequest(dashboardInput(), context);
  const snapshot = request.dashboardBrief as Record<string, unknown>;

  assert.deepEqual(snapshot.step3, { logoFileName: "brand.svg" });
  assert.equal(JSON.stringify(snapshot).includes("logoDataUrl"), false);
});

test("analytics wrapper strips personal data before forwarding", () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const globalScope = globalThis as unknown as { window?: unknown };
  const previousWindow = globalScope.window;
  globalScope.window = {
    gtag: (name: string, event: string, params: Record<string, unknown>) => {
      calls.push([event, params]);
      assert.equal(name, "event");
    },
  };

  try {
    trackLandingEvent("consultation_submit", "catalog", {
      product_id: catalogItem.id,
      companyName: "must not be sent",
      contactName: "must not be sent",
      email: contact.email,
      message: "must not be sent",
      pageUrl: context.pageUrl,
      gaClientId: context.gaClientId,
      userAgent: context.userAgent,
    });
  } finally {
    globalScope.window = previousWindow;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], {
    product_id: catalogItem.id,
    landing_variant: "catalog",
  });
});
