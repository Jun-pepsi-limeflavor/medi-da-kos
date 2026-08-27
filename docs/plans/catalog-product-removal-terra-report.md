# Catalog product removal report

Date: 2026-08-27

## Change

- Removed `LACTO CREAM SERUM`, `TIMELESS NOURISHING SERUM`, and `GREEN FLAVONOID SOOTHING CREAM` from the catalog source data.
- The displayed catalog now has 35 products: serum 22, toner 4, cream 5, and mist 4.
- Updated the approved-name and count assertions. The asset check now loads only the 35 displayed product assets.
- Supplied image files were retained. No source asset was deleted.

## Stale-reference check

The catalog UI derives its cards and consultation selection only from `CATALOG_PRODUCTS`; the three removed IDs and names have no remaining references in `src` or `tests`.

## Verification

- `node --test tests/catalog-products.test.ts`: 4 passed
- `npm test`: 20 passed
- `npx tsc --noEmit`: passed
