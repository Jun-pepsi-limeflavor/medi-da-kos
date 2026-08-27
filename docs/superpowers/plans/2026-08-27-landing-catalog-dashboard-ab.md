# Cold-mail Landing Catalog/Dashboard A/B Implementation Plan

> **For agentic workers:** Follow this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/landing/catalog` and `/landing/dashboard` as comparable consultation-focused cold-mail landing pages.

**Architecture:** A shared landing request model, form, Firestore writer, analytics helper, and visual shell serve both routes. The catalog uses Figma-derived static product data and local selection state. The dashboard adds an injectable consultation mode and local-storage provider around the existing six-step `CMWizard`, preserving the signed-in dashboard behavior.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, strict TypeScript, Tailwind v4, Firebase JS SDK 12, Cloud Functions CommonJS/Node 20, Node built-in test runner, Firestore Emulator.

**Spec:** `docs/plans/2026-08-27-landing-catalog-dashboard-ab-spec.md`

## Global Constraints

- Routes are exactly `/landing/catalog` and `/landing/dashboard`.
- Both variants solicit an email consultation; neither creates a sample request, order, account, or `cmBriefs` document.
- Dashboard order is exactly Category → Packaging → Branding → Quantity & Specs → Formula → Compliance and reuses the existing step implementations.
- Catalog categories are exactly Serum, Toner, Cream, Mist and use the actual Figma catalog content.
- Production code uses local assets under `public/landing/catalog/`, never expiring Figma URLs.
- Firestore collection is exactly `landingRequests`; public clients have create-only access to validated documents.
- Cloud Functions region remains `asia-northeast3`; `isTest === true` never sends internal mail.
- Every buyer-provided string placed in email HTML is escaped.
- Analytics never receives personal data and every event contains `landing_variant` plus the existing `is_test`.
- Completion text is exactly: `Thank you — your request has been received. A member of our team will review the details and contact you shortly.`
- Do not add React Bits Pro source code or bypass its paywall; reproduce only the documented interaction pattern.
- Do not commit, push, deploy, stash, reset, clean, or alter the original checkout.

---

### Task 1: Shared request contract, validation, and persistence

**Files:**
- Create: `src/lib/landing/types.ts`
- Create: `src/lib/landing/request.ts`
- Create: `src/lib/landing/analytics.ts`
- Modify: `src/lib/firestore-service.ts`
- Modify: `src/lib/types.ts`
- Create: `tests/landing-request.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `LandingVariant`, `LandingContactFields`, `LandingCatalogItem`, `LandingRequestInput`, and `LandingRequestSubmission`.
- Produces `validateLandingContact(fields)` returning `Partial<Record<keyof LandingContactFields, string>>`.
- Produces `buildLandingRequest(input, context)` and `submitLandingRequest(input)`.
- Produces `trackLandingEvent(name, variant, params?)`, which strips personal-data keys before forwarding to `trackConversionEvent`.

- [ ] **Step 1: Add failing unit tests**

Create literal test fixtures covering valid catalog and dashboard requests, invalid/blank contact fields, the 12-item catalog cap, rejection of a variant/payload mismatch, stripping `logoDataUrl`, and analytics parameter sanitization.

```ts
test("catalog input cannot carry a dashboard brief", () => {
  assert.throws(
    () => buildLandingRequest(catalogInput({ dashboardBrief: { currentStep: 6 } }), context),
    /catalog request cannot include dashboardBrief/,
  );
});

test("dashboard snapshots omit the uploaded logo data URL", () => {
  const request = buildLandingRequest(
    dashboardInput({
      dashboardBrief: { step3: { logoFileName: "brand.svg", logoDataUrl: "data:image/svg+xml;base64,AAA" } },
    }),
    context,
  );
  assert.deepEqual(request.dashboardBrief?.step3, { logoFileName: "brand.svg" });
});
```

- [ ] **Step 2: Run the targeted tests and record the expected missing-module failure**

Run: `node --test tests/landing-request.test.ts`

- [ ] **Step 3: Implement the types and pure builder**

Use discriminated inputs so exactly one detail payload is possible:

```ts
export type LandingRequestInput = LandingContactFields & (
  | { landingVariant: "catalog"; catalogItems: LandingCatalogItem[]; dashboardBrief?: never }
  | { landingVariant: "dashboard"; dashboardBrief: CMBrief; catalogItems?: never }
);
```

Keep timestamps and browser context in `buildLandingRequest`; call `stripUndefined` before Firestore persistence. Set `status: "new"` and `isTest: isNonProductionEnv()` in one shared path.

- [ ] **Step 4: Add the Firestore writer and analytics wrapper**

`submitLandingRequest` writes only to `landingRequests` with `addDoc` and `serverTimestamp`. In mock mode it logs and returns a mock ID. `trackLandingEvent` rejects the keys `companyName`, `contactName`, `email`, `message`, `pageUrl`, `gaClientId`, and `userAgent` from optional analytics parameters.

- [ ] **Step 5: Run unit tests and typecheck**

Run: `node --test tests/landing-request.test.ts`

Run: `npx tsc --noEmit`

---

### Task 2: Shared landing shell and consultation form

**Files:**
- Create: `src/app/landing/layout.tsx`
- Create: `src/components/landing/LandingShell.tsx`
- Create: `src/components/landing/ConsultationForm.tsx`
- Create: `src/components/landing/ConsultationSuccess.tsx`
- Create: `src/components/landing/useLandingAttribution.ts`
- Create: `tests/landing-attribution.test.ts`

**Interfaces:**
- `ConsultationForm` consumes `variant`, the variant-specific payload, and optional `onBack`.
- `useLandingAttribution` returns UTM fields, `pageUrl`, `gaClientId`, and `userAgent` without exposing them to rendered inputs.
- Successful submission renders the exact completion text from the spec.

- [ ] **Step 1: Add attribution parsing tests**

Test literal URLs with missing, present, and encoded UTM parameters. Assert that `utm_content` remains available for A/B reporting without changing the route-selected `landingVariant`.

- [ ] **Step 2: Implement the shared layout and form**

Use semantic labels and errors connected through `aria-describedby`. Required fields are company/brand, contact, work email, country, and expected quantity. Message is optional. Preserve values on failure and prevent double submission while awaiting Firestore.

- [ ] **Step 3: Wire successful persistence and analytics**

Call `submitLandingRequest`; only after it resolves call:

```ts
trackLandingEvent("consultation_submit", variant, {
  expected_volume: fields.expectedVolume,
  utm_source: attribution.utmSource,
  utm_medium: attribution.utmMedium,
  utm_campaign: attribution.utmCampaign,
  utm_content: attribution.utmContent,
});
```

- [ ] **Step 4: Run tests, typecheck, and lint changed files**

Run: `node --test tests/landing-attribution.test.ts tests/landing-request.test.ts`

Run: `npx tsc --noEmit`

Run: `npx eslint src/app/landing src/components/landing src/lib/landing`

---

### Task 3: Figma catalog data, assets, and catalog route

**Files:**
- Create: `src/lib/landing/catalog-products.ts`
- Create: `src/components/landing/CatalogLanding.tsx`
- Create: `src/components/landing/CatalogTabs.tsx`
- Create: `src/components/landing/ProductTile.tsx`
- Create: `src/components/landing/ProductDetail.tsx`
- Create: `src/components/landing/ConsultationTray.tsx`
- Create: `src/app/landing/catalog/page.tsx`
- Create: `public/landing/catalog/*`
- Create: `tests/catalog-products.test.ts`

**Interfaces:**
- `CATALOG_PRODUCTS` is a readonly array of 38 `CatalogProduct` records.
- Each product contains `id`, `category`, `name`, local `image`, `description`, `differentiators`, `technology`, `keyIngredients`, `howToUse`, and optional `referencePrices`.
- `CatalogLanding` passes selected `LandingCatalogItem[]` to `ConsultationForm`.

- [ ] **Step 1: Extract and download the approved Figma source**

Read page `0:1` of file `156LMOUK4MKVBgRySLuMp8`. Map the 38 product frames listed in the spec. Download the primary product image for every product and save deterministic lowercase filenames under `public/landing/catalog/`. Do not retain temporary Figma URLs in TypeScript or CSS.

- [ ] **Step 2: Add catalog integrity tests before the UI**

```ts
test("catalog has the approved category counts and local assets", () => {
  assert.deepEqual(counts(CATALOG_PRODUCTS), { serum: 24, toner: 4, cream: 6, mist: 4 });
  for (const product of CATALOG_PRODUCTS) {
    assert.match(product.image, /^\/landing\/catalog\//);
    assert.ok(product.description.length > 0);
  }
});
```

Also assert unique IDs/names, the four-category order, and that no asset URL begins with `http`.

- [ ] **Step 3: Implement tabs, tiles, and the detail panel**

Use real buttons for tabs and product actions. Add `aria-selected`, keyboard focus styles, an animated underline based on the selected tab, responsive one/two/three-column tiles, and a detail dialog or inline panel with a visible close control. Reference prices display as informational labels only.

- [ ] **Step 4: Implement the consultation tray and handoff**

Selection is idempotent, removal is available, and the 13th selection is rejected with an inline message. `Discuss this product` and `Add to consultation` are the only item actions. `Request a consultation` opens the shared form with the selected products.

- [ ] **Step 5: Add analytics and run checks**

Track `consultation_start`, `catalog_category_view`, `catalog_product_view`, and `catalog_product_select` with product IDs/categories only. Run catalog tests, typecheck, and targeted lint.

---

### Task 4: Consultation mode for the existing dashboard wizard

**Files:**
- Modify: `src/components/dashboard/CMWizard.tsx`
- Modify: `src/lib/dashboard-brief-context.tsx`
- Create: `src/components/landing/LandingDashboard.tsx`
- Create: `src/app/landing/dashboard/page.tsx`
- Create: `src/lib/landing/dashboard-draft.ts`
- Create: `tests/landing-dashboard-draft.test.ts`

**Interfaces:**
- Extend `CMWizard` props with `mode?: "order" | "consultation"` and `onConsultationReady?: (brief: CMBrief) => void` while keeping existing `/dashboard` callers unchanged.
- Add `LandingDashboardBriefProvider` or a storage adapter that satisfies the existing context value and persists under `medidakos:landing-dashboard-brief:v1`.
- `LandingDashboard` receives the completed brief and opens `ConsultationForm` with `landingVariant: "dashboard"`.

- [ ] **Step 1: Add local-draft pure-function tests**

Test the empty default, valid JSON migration, malformed JSON recovery, storage key, step advance capped at 6, and removal of `logoDataUrl` from submission snapshots.

- [ ] **Step 2: Add an injectable persistence mode without changing signed-in behavior**

Keep `DashboardBriefProvider` as the Firestore-backed default. Add a landing provider/adapter for local storage. Do not write a guest UID to Firebase. Preserve `getNavigableSteps`, `stepHasContent`, and existing step analytics.

- [ ] **Step 3: Add `CMWizard` consultation mode**

In order mode, behavior and copy remain unchanged. In consultation mode:

- hide `Save draft` because local persistence happens automatically;
- omit `Top10Products`;
- change step-6 action to `Continue to consultation`;
- call `onConsultationReady(brief)` instead of `submitCustomBrief`;
- never route to My Orders;
- track `dashboard_step_view` with the landing variant.

- [ ] **Step 4: Create the route and shared handoff**

Render the existing six-step sidebar/content flow without `DashboardGuard` or account navigation. After step 6, show `ConsultationForm`; back returns to the wizard without losing the draft.

- [ ] **Step 5: Run dashboard tests and regression checks**

Run: `node --test tests/landing-dashboard-draft.test.ts tests/landing-request.test.ts`

Run: `npx tsc --noEmit`

Run: `npx eslint src/app/landing src/components/landing src/components/dashboard/CMWizard.tsx src/lib/dashboard-brief-context.tsx src/lib/landing`

---

### Task 5: Firestore rules and internal consultation email

**Files:**
- Modify: `firestore.rules`
- Create: `functions/landing-request-email.js`
- Create: `functions/test/landing-request-email.test.js`
- Modify: `functions/index.js`
- Modify: `functions/package.json`
- Create: `tests/firestore-landing-requests.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- `buildLandingRequestEmail(requestId, data, submittedAt)` returns `{ subject, html }` and escapes all buyer-provided fields.
- `onLandingRequestCreated` listens at `landingRequests/{requestId}` and calls existing `queueEmail` once only when `isTest !== true`.

- [ ] **Step 1: Add failing email-builder tests**

Test catalog and dashboard subject/body summaries, omission of a buyer email, and escaping of `<script>`, quotes, ampersands, selected product names, and message text.

- [ ] **Step 2: Implement and connect the trigger**

Keep the pure builder in `functions/landing-request-email.js`. The trigger reuses `getAdminEmails`, `formatKoDate`, and `queueEmail`. Use document ID `landing_request_admin_${requestId}` for idempotence.

- [ ] **Step 3: Add Firestore emulator rule tests**

Add `@firebase/rules-unit-testing` and `firebase-tools` as development dependencies. Test unauthenticated valid creates for both variants; reject reads, updates, deletes, invalid emails, missing required fields, extra top-level keys, 13 catalog items, mismatched payload fields, and oversized message values.

- [ ] **Step 4: Tighten rules with `hasOnly` and variant matching**

Create helper functions for bounded optional strings and common keys. Permit `catalogItems` only for catalog requests and `dashboardBrief` only for dashboard requests. Keep the final catch-all deny.

- [ ] **Step 5: Run function and rule tests**

Run: `npm --prefix functions test`

Run: `npm run test:rules`

Run: `npm test`

---

### Task 6: Integration, responsive browser check, and final verification

**Files:**
- Modify only files required to fix findings from the checks below.

**Interfaces:**
- Both routes are complete and share one submission pipeline.

- [ ] **Step 1: Run repository checks**

Run: `npm test`

Run: `npx tsc --noEmit`

Run: `npm run lint`

Run: `npm run build`

- [ ] **Step 2: Start the development server from the isolated worktree**

Run `npm run dev` on an unused port. Keep the server attached for browser verification.

- [ ] **Step 3: Verify both routes in a Terra-controlled browser**

At desktop and mobile widths verify:

- `/landing/catalog`: four tabs, real product images, detail open/close, add/remove, 12-item cap, form validation, failed/mock submit handling, focus visibility, no horizontal overflow.
- `/landing/dashboard`: six-step order and fields, local draft reload, no login/account/order UI, consultation handoff, back navigation, no horizontal overflow.
- browser console has no uncaught errors or hydration warnings.

- [ ] **Step 4: Inspect the final diff and protected paths**

Confirm `git status --short` contains only this feature, `git diff --check` is clean, no expiring `figma.com/api/mcp/asset` URL remains, and no code path calls `createOrder`, `saveSampleRequest`, `saveCMBrief`, or `submitCustomBrief` from the public landing routes.

- [ ] **Step 5: Leave the branch uncommitted and report evidence**

Do not commit, push, deploy, or merge. Report the isolated worktree path, branch, changed files, test/typecheck/lint/build outcomes, browser findings, and any residual limitations.
