# Catalog card image fill

## Change

- Updated only the catalog card image wrapper in `src/components/landing/CatalogLanding.tsx`.
- Removed the image's `p-5` inset and changed its fit from `object-contain` to centered `object-cover`.
- Added `overflow-hidden` to the existing 4:3 image region so the centered crop fills the region without changing the product-card grid, text area, or responsive breakpoints.
- The product-detail dialog has no image region, so it was intentionally unchanged.

## Verification

- `npm test`: 22 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- `npx eslint src/components/landing/CatalogLanding.tsx`: passed.
- `git diff --check`: passed.
