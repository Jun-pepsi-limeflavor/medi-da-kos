# Catalog text and product removal report

Date: 2026-08-27

## Completed

- Removed `R.E.D BLEMISH CLEAR MOISTURE CREAM` from the displayed catalog data.
- Updated visible totals to 34 products: 22 serum, 4 toner, 4 cream, and 4 mist.
- Replaced every displayed product's card `description` with its `DESCRIPTION`
  text from `카탈로그_제품_텍스트.md`.
- The same field is used by the product-details dialog, so the card and dialog
  description stay identical.

## Mapping audit

- Displayed catalog products: 34
- Source descriptions mapped: 34
- Unmatched displayed products: 0
- Exact-name matches: 32
- Normalized-name matches: 2
  - `FIRMING SOLUTION (MULTI-PEPTIDE EYE SERUM)` (source heading contains an
    extra space before the parenthesis)
  - `DEPUFFING SOLUTION (CAFFEINE + EGCG EYE SERUM)` (source contains a line
    break before the parenthesis)

Source-only product text intentionally not displayed: `LACTO CREAM SERUM`,
`R.E.D BLEMISH CLEAR MOISTURE CREAM`, and `GREEN FLAVONOID SOOTHING CREAM`.
`TIMELESS NOURISHING SERUM` has no matching product section in the supplied
text export. The export has two `COLLAGEN HYDROGEL MIST` sections with different
copy; the first occurrence was selected because it appears first in the source.

## Verification

- `npm test`: 21 passed
- `npx tsc --noEmit`: passed
- `npx eslint src/lib/landing/catalog-products.ts tests/catalog-products.test.ts`: passed
- `git diff --check`: passed
