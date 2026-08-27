# Catalog price-information removal

Date: 2026-08-27

## Scope completed

- Removed the optional `referencePrices` field from the catalog product type.
- Removed the only stored unit-price values from the Green Apple Capsule Serum record.
- Removed the conditional reference-price section from the catalog product-detail dialog.
- Kept product descriptions, product details, selection, and consultation submission unchanged.

## Verification

- `npm test` — 22 passing, 0 failing.
- `npx tsc --noEmit` — passing.
- Targeted ESLint for the catalog component, catalog data, and tests — passing.
- Residual source search of the catalog component/data found no customer-visible price terms or currency values. The sole match is the regression test that enforces their absence.
- `git diff --check` — passing.
