# Landing Catalog/Dashboard A/B final test and audit report

**Date:** 2026-08-27  
**Worktree:** `/private/tmp/medi-da-kos-landing-catal-dash-ab`  
**Scope:** test owner verification and read-only audit; no production, rules, UI,
or original-checkout edits were made in this pass.

## Verification results

| Command | Result | Evidence |
| --- | --- | --- |
| `npm test` | **FAIL: 19 passed, 1 failed** | The new catalog image-integrity test fails because all 38 image files share one SHA-256. All request, attribution, catalog metadata, and dashboard-draft tests pass. |
| `npm --prefix functions test` | **PASS: 4/4** | Email summary, dashboard summary, HTML escaping, and optional-value tests pass. |
| `npm run test:rules` | **PASS: 5/5** | Firestore Emulator under the configured JDK 21 runtime: valid catalog/dashboard creates, create-only access, malformed/oversized/extra-key rejection, and variant mismatch rejection. The missing-dashboardBrief fixture now omits the property and reaches rules; it is rejected. |
| `npx tsc --noEmit` | **PASS** | Runtime test files are excluded by the current `tsconfig`; application TypeScript compiles. |
| `npx eslint src/app/landing src/components/landing src/components/dashboard/CMWizard.tsx src/lib/dashboard-brief-context.tsx src/lib/landing tests functions/test` | **PASS with 1 existing warning** | Zero errors. Existing `@next/next/no-img-element` warning at `CMWizard.tsx:669`. |
| `git diff --check` | **PASS** | No whitespace errors in the tracked diff. |

The unit script intentionally excludes `tests/firestore-landing-requests.test.ts`;
that file is run through `npm run test:rules`, which starts the emulator.

## Blocking findings

### P0 — Catalog assets are copied placeholders, not 38 genuine unique Figma assets

`tests/catalog-products.test.ts` now reads every referenced local asset and
compares SHA-256 hashes. All 38 files under `public/landing/catalog/` hash to:

```text
70c1a81ec6237abc81fbb09be46a22e16e0272052762b20f04a69a59deb4af3b
```

They are all `415 x 152` RGBA PNGs. The test therefore reports `1 !== 38`.
This does satisfy local-path syntax but fails the approved requirement that
production use the actual product images downloaded from the Figma source.
Replace them with the 38 exported Figma images before release; do not weaken
the test.

### P0 — Product detail content is generic for 37 of 38 products

`src/lib/landing/catalog-products.ts:20-25` supplies the same placeholder
description, differentiators, technology, ingredient, and usage text for every
product. Only Green Apple Capsule Serum is overridden at line 31. The approved
spec requires the actual Figma product description and product-specific details,
so the catalog cannot be reported complete until those records are transcribed.

Terra’s implementation report records the Figma MCP Starter-plan export quota
as the reason both blockers remain unresolved.

## Non-blocking audit notes

- `firestore.rules:94-113` checks required fields and bounded strings, but does
  not assert that `serverCreatedAt` is a timestamp or that each catalog item is
  a map with bounded `id`, `name`, and approved `category` values. The current
  rules tests cover the required acceptance cases; tightening these checks would
  reduce spoofed/malformed payload risk.
- `src/components/landing/CatalogLanding.tsx:22` emits `consultation_start` on
  every add attempt, including duplicate and 13th-item attempts. The event is
  described as the first meaningful interaction, so production measurement may
  overcount starts.
- `src/components/landing/CatalogLanding.tsx:35` permits opening the contact form
  with zero selected products. The builder later rejects an empty catalog list;
  either disable the CTA until one item is selected or define an empty catalog
  consultation as valid to avoid a dead-end form.
- `src/lib/dashboard-brief-context.tsx:130-133` persists dashboard changes when
  the wizard advances or navigates, but direct field edits are held only in React
  state until that action. If “draft persistence” is intended to survive an
  immediate reload during field editing, persistence needs to happen on change.
- Browser responsive/console QA and a production build were not claimed here;
  Terra’s report leaves them pending until the asset/content blockers are
  resolved.

## Test-side changes in this pass

- Removed obsolete `@ts-expect-error` comments now that
  `allowImportingTsExtensions` is enabled.
- Removed the unnecessary `CMBrief` to `Record` cast; the snapshot remains a
  typed `CMBrief`.
- Changed the missing-dashboard-brief fixture to omit `dashboardBrief` rather
  than pass `undefined`, ensuring Firestore rules—not the Firebase client—make
  the rejection.
- Added the asset-hash integrity assertion and kept the root unit script
  separate from the emulator-backed rules script.

No commit, push, deploy, global install, or original-checkout modification was
performed.

## Regression addendum — 2026-08-27

Terra’s latest changes were reviewed without editing production files.

This addendum supersedes the earlier non-blocking notes about repeated
`consultation_start`, the zero-item CTA, and landing draft persistence; those
three items were rechecked after Terra’s fixes below.

| Regression requested | Verdict | Evidence |
| --- | --- | --- |
| `consultation_start` fires once after the first successful catalog selection | **PASS by code inspection** | `CatalogLanding.tsx:20-31` tracks only after duplicate/cap checks, guards the event with `hasStartedConsultation`, and sets that guard in the same successful path. |
| Zero-item catalog CTA is disabled and cannot open the form | **PASS by code inspection** | `CatalogLanding.tsx:39` uses `disabled={selected.length === 0}`; the form is only rendered after `setForm(true)`, which is reachable from that CTA or a product-detail action. |
| Product-detail “Discuss this product” never hands off an empty list | **PASS by React state-flow inspection** | `CatalogLanding.tsx:40` calls `add(detail)` and `setForm(true)` in one React event. The queued selection update is committed before the next render, so the rendered `ConsultationForm` receives the newly selected product. |
| Only landing mode autosaves every field edit; signed-in mode remains Firestore-backed | **PASS by code inspection** | `dashboard-brief-context.tsx:130-135` mirrors `brief` changes only in `LandingDashboardBriefProvider`. The normal provider at `:80-96` still calls `saveCMBrief` only through its existing persistence methods and has no local-storage effect. |
| Rules enforce timestamp and catalog item map/enum constraints | **PASS: 6/6 emulator groups** | `npm run test:rules` passes, including non-map items, extra item keys, invalid `category`, and a spoofed non-timestamp `serverCreatedAt`. Emulator logs show the malformed writes denied; several large rule evaluations hit the Firestore 1,000-expression limit while still rejecting the writes. |
| Generated `firestore-debug.log` absent | **PASS** | Removed the emulator-generated untracked file after the final rules run; final filesystem check reports `absent`. |
| Consultation mode bypasses shipping-address gate while order mode retains it | **FAIL / P1** | `CMWizard.tsx:102-109` checks `isShippingAddressIncomplete` before the `mode === "consultation"` branch at `:110-113`. An incomplete address therefore blocks consultation handoff, contrary to the requested regression behavior. Order mode retains the intended gate. |

The final command status is unchanged: `npm test` has only the expected P0
catalog image-hash failure (19 pass, 1 fail), functions tests pass 4/4, rules
tests pass 6/6, typecheck passes, targeted lint has zero errors plus the
pre-existing `CMWizard.tsx:669` image warning. `npm run build` was attempted
and is blocked by unavailable Google Fonts network fetches for Geist,
Geist Mono, and Noto Serif, rather than a TypeScript/build diagnostic.

## Final scoped regression addendum — 2026-08-27

The latest Terra changes were reviewed without production edits.
This supersedes the earlier P1 shipping-address finding above.

- `CMWizard.tsx:102-113` now branches to consultation handoff before the
  shipping-address check. Consultation mode therefore skips the address gate
  at final handoff, while order mode still reaches the existing gate at
  `:106-113`.
- `CMWizard.tsx:143-145` makes the Step 4 navigation block address-dependent
  only in order mode. Consultation mode can continue with the Step 4 address
  fields visible, as required.
- `CatalogLanding.tsx:23-35` returns the next selection synchronously, rejects
  duplicates and the 13th item, and emits `consultation_start` only on the
  first successful selection. `:43` passes that returned list into the form
  for “Discuss this product”, so a first-time detail action cannot open with
  an empty catalog payload.
- `npm test`: **19 passed, 1 failed**, only the expected P0 duplicate-image
  hash assertion (`1 !== 38`).
- `npx tsc --noEmit`: **PASS**.
- Targeted ESLint: **PASS**, zero errors and the same pre-existing
  `CMWizard.tsx:669` image warning.

No component-test harness exists in this repository, so the two UI behaviors
above are code-flow verdicts rather than browser assertions. The unresolved
P0 asset/content blockers and the Google Fonts network build limitation remain
unchanged.

## Rules simplification test addendum — 2026-08-27

The rules contract was narrowed to list type/size, top-level strictness,
variant matching, and escaped mail rendering. The malformed nested item-map,
extra-key, and category assertions were removed from
`tests/firestore-landing-requests.test.ts`; the test still rejects a spoofed
non-timestamp `serverCreatedAt` and now includes an unauthenticated catalog
create with exactly 12 items.

`npm run test:rules` was rerun against the current checkout. Result: **5/6
groups passed**; the exact-12 valid create was rejected by the current
`firestore.rules` evaluator with `Unable to evaluate the expression as the
maximum of 1000 expressions to evaluate has been reached` at `L145`. This is
the expected red result while Terra’s planned repeated-index rule
simplification is still pending in the shared worktree. The emulator-generated
`firestore-debug.log` was removed after the run.
