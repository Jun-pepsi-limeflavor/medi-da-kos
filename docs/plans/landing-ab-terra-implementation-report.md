# Landing catalog/dashboard A/B implementation report

**Worktree:** `/private/tmp/medi-da-kos-landing-catal-dash-ab`
**Branch:** `feat/landing_catal_dash_ab`
**Status:** implementation present, uncommitted; release-blocked by Figma MCP Starter-plan asset-export quota.

## Implemented

- Shared landing request types, field validation, create-only Firestore writer, browser attribution capture, and analytics filtering in `src/lib/landing/`.
- Shared no-account landing layout, accessible consultation form, retry/fallback text, and exact success message.
- Catalog route at `/landing/catalog` with four keyboard-accessible tabs, product detail dialog, add/remove consultation tray, 12-item cap, and 38 approved product names/categories.
- Local catalog paths under `public/landing/catalog/`; the production source contains no Figma temporary asset URL.
- Dashboard route at `/landing/dashboard` using the existing six-step `CMWizard` in a new consultation mode. The landing provider persists to `medidakos:landing-dashboard-brief:v1`, keeps normal `/dashboard` behavior on its Firestore provider, hides saving/sample behaviors, and hands the stripped brief to the shared form.
- Create-only `landingRequests` Firestore rules and an `asia-northeast3` document-create notification trigger. The pure notification builder escapes buyer controlled HTML and test submissions skip mail queueing.

## Checks run

- `npm test` — pass, 19 Node 26 landing tests. The script explicitly runs pure tests; Firestore Emulator tests remain in `npm run test:rules` rather than an unbootstrapped glob.
- `npm --prefix functions test` — pass, 4 tests.
- `npx tsc --noEmit` — pass.
- `npm run build` — first blocked by sandboxed Google Fonts access; succeeded after network approval. Both `/landing/catalog` and `/landing/dashboard` are in the production route manifest.
- `npm run dev -- --port 3100` — starts after local-port approval; `curl -I --fail` returned 200 for both landing routes.
- Targeted ESLint — no errors; one pre-existing `img` performance warning in `CMWizard.tsx`.
- `git diff --check` — pass.
- Confirmed no temporary Figma asset URL or forbidden order/sample/brief persistence call in public landing code.

## Remaining verification / limitations

- `npx tsc --noEmit` now passes after excluding runtime Node test files from the production compilation and enabling explicit `.ts` imports for the Node 26 runner.
- Added `@firebase/rules-unit-testing` and `firebase-tools`, locked them, and changed `test:rules` to start a real Firestore Emulator with the bundled JDK 21. Four rule groups pass. The final `dashboardBrief: undefined` case cannot reach rules: Firebase JS rejects an `undefined` field client-side with `invalid-argument` before `assertFails` receives a permission result. This is a test-fixture/runtime limitation, not a rules allow.
- Figma export is hard blocked: after mapping the catalog frames and image nodes, `figma_download_assets` returns `INVALID_ARGUMENT`: `You've reached the Figma MCP tool call limit on the Starter plan.` It does so for direct top-level-frame export, e.g. `16:1306` (NIACINAMIDE 2% + SAPONIN PINK SERUM), so no short-lived source URL can now be issued to download. Mapped assets include Serum frames `16:1306,16:2,16:913,16:842,16:805,16:236,16:1269,16:274,16:1232,16:1157,16:273,16:530,16:348,16:496,16:311,16:1195,16:385,16:738,16:772,16:421,16:879,16:458,16:37,16:69`; Toner `16:1122,16:128,16:162,16:199`; Cream `16:631,16:597,16:668,16:703,18:2,19:103`; Mist `16:948,16:982,16:1017,16:1052,16:1087`.
- Aside CLI fallback cannot attach the logged-in tab: after `aside --help` and `aside repl --help`, an interactive `aside repl` exits with `Failed to request daemon auth challenge: fetch failed` and `Aside daemon is not reachable — make sure Aside Browser is running, then retry.` No tabs can be listed/attached, so desktop/mobile visual interaction QA and UI-derived Figma downloads cannot be performed.
- Therefore the copied source-image placeholders are still unacceptable and must be replaced after the user upgrades/re-enables Figma MCP access or shares exported originals. The 38 non-GREEN-APPLE detail records also cannot be fully transcribed from Figma while this export/read quota is locked; their current generic content must not ship.
- Hash verification confirms the unreleased state: `shasum -a 256 public/landing/catalog/*.png | awk '{print $1}' | sort -u | wc -l` returns **1**, not 38 distinct source images.
- The root test script keeps emulator-backed checks separate; `npm run test:rules` starts a real emulator and passes its five rules tests. The root test suite is red only because the retained P0 catalog-asset integrity test correctly finds one image hash instead of 38.

## Audit follow-up — 2026-08-27

- Catalog measurement now sends `consultation_start` exactly once, only after the first successful item selection. The tray keeps its request button disabled at zero items and tells the buyer to add a product first.
- `LandingDashboardBriefProvider` now mirrors every in-progress brief state change to local storage. The signed-in `DashboardBriefProvider` remains unchanged and retains its Firestore-only persistence path.
- `landingRequests` rules now require a timestamp `serverCreatedAt` and validate every supported catalog list position (1–12) as a bounded `{id, name, category}` map with category limited to Serum, Toner, Cream, or Mist.
- Removed only the generated untracked `firestore-debug.log` after each emulator execution.
- Rechecks: 16 non-asset landing tests pass; 4 Functions tests pass; 5 Firestore Emulator rule tests pass; typecheck and production build pass; targeted lint has zero errors plus the existing `CMWizard.tsx` image warning; diff check passes. The full 20-test root suite still fails exclusively on the deliberately retained P0 38-distinct-Figma-assets assertion (`1 !== 38`).

## Follow-up correctness fixes — 2026-08-27

- `Discuss this product` now derives the exact next selection synchronously, stores it as the form payload, and only opens the consultation form after the detail item is included. Duplicates open with the existing selection; a thirteenth unselected item stays on the detail panel with the cap message.
- Consultation mode keeps the brief quantity/TBD check, but no longer blocks step-four advancement or the final handoff on a shipping address. Shipping remains required in the signed-in order mode only.
- Targeted typecheck and lint pass with no errors; the existing `CMWizard.tsx` `<img>` warning remains.
