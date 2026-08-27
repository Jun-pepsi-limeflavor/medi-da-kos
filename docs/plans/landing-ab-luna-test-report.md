# Landing A/B test-first report

**Run:** 2026-08-27, Node v26.7.0, before the landing implementation

The behavioral tests below were added before their production modules. The
initial failures are expected red-test results: they identify the module or
test dependency that the implementation phase must supply. No production
source, Firestore rules, UI, or Cloud Functions implementation was changed by
this test phase.

| Area | Command | Initial result |
| --- | --- | --- |
| Shared request validation, sanitization, and analytics | `node --test tests/landing-request.test.ts` | **FAIL (expected):** `ERR_MODULE_NOT_FOUND` for `src/lib/landing/request.ts` |
| UTM attribution parsing | `node --test tests/landing-attribution.test.ts` | **FAIL (expected):** `ERR_MODULE_NOT_FOUND` for `src/components/landing/useLandingAttribution.ts` |
| Catalog inventory/category/local assets | `node --test tests/catalog-products.test.ts` | **FAIL (expected):** `ERR_MODULE_NOT_FOUND` for `src/lib/landing/catalog-products.ts` |
| Dashboard local draft/snapshot | `node --test tests/landing-dashboard-draft.test.ts` | **FAIL (expected):** `ERR_MODULE_NOT_FOUND` for `src/lib/landing/dashboard-draft.ts` |
| Internal email escaping/content | `npm --prefix functions test` | **FAIL (expected):** `MODULE_NOT_FOUND` for `functions/landing-request-email.js` |
| Firestore create-only rules and payload limits | `node --test tests/firestore-landing-requests.test.ts` | **FAIL (expected):** `ERR_MODULE_NOT_FOUND` for `@firebase/rules-unit-testing` (emulator/dependency setup is still needed) |

The root test scripts now provide the planned entry points:

```text
npm test       -> node --test tests/*.test.ts
npm run test:rules -> node --test tests/firestore-landing-requests.test.ts
```

The functions package test script is:

```text
npm --prefix functions test -> node --test test/*.test.js
```

After concurrent implementation work began, `npm test` was also run. It still
exited non-zero, but the failure moved past the test files for the request and
attribution areas: plain Node cannot resolve the app's `@/…` TypeScript path
aliases imported by those modules (`ERR_MODULE_NOT_FOUND: Cannot find package
'@/lib'`). The test runner needs either relative imports in the pure modules or
a documented TypeScript/path-alias loader before these tests can execute.

The rules test will also need the Firestore emulator running before it can
produce behavioral pass/fail results. The root development dependencies do
not yet contain `@firebase/rules-unit-testing` or `firebase-tools`; adding
those dependencies and the emulator invocation belongs to the rules
implementation/integration phase.
