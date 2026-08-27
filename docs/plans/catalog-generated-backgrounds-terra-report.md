# Catalog generated-background assets — Terra report

Date: 2026-08-27

## Applied assets

The user approved the five generated product-background previews. Each source image was copied (not moved) into the active catalog asset path used by `CATALOG_PRODUCTS`.

| Product | Generated source | Active destination | SHA-256 |
| --- | --- | --- | --- |
| NIACINAMIDE 2% + SAPONIN PINK SERUM | `/Users/giwook/.codex/generated_images/01a041ce-0495-7321-a359-40eeec9a4ead/exec-35be1edc-2cc8-4c33-822a-60d3c151e9eb.png` | `public/landing/catalog/niacinamide-2-saponin-pink-serum.png` | `178b424ca1563f23254513ed88d194e40c127764323c437c6fc1f5548bb70b58` |
| GREEN APPLE CAPSULE SERUM | `/Users/giwook/.codex/generated_images/01a041ce-0495-7321-a359-40eeec9a4ead/exec-958c8682-6aee-400b-a8c4-fedb8c59c99f.png` | `public/landing/catalog/green-apple-capsule-serum.png` | `07e90681dbe91aab8fa81e06c93a41299ce441062f5a2685a4a047579be327ed` |
| SUPER PDRN BOOSTER | `/Users/giwook/.codex/generated_images/01a041ce-0495-7321-a359-40eeec9a4ead/exec-749aeac1-b92c-4570-beff-5d7c15ee0070.png` | `public/landing/catalog/super-pdrn-booster.png` | `d59269cdb28d809cf096024985fd5ef04df348b8809f39316906fcd3ea7e487b` |
| HYDRO BOOST HYALURONIC ACID SERUM | `/Users/giwook/.codex/generated_images/01a041ce-0495-7321-a359-40eeec9a4ead/exec-7071222d-afca-4dcb-863b-6e14ee874025.png` | `public/landing/catalog/hydro-boost-hyaluronic-acid-serum.png` | `3b0b1bfe42e0f695ef2b069f0e8952689970721aa0046b7bd4c6aa7e255abd98` |
| POWER ANTIAGING SERUM | `/Users/giwook/.codex/generated_images/01a041ce-0495-7321-a359-40eeec9a4ead/exec-d82ad323-7ca8-47d1-8672-f90b6f111dcb.png` | `public/landing/catalog/power-antiaging-serum.png` | `ce9bfd03c6840f2b1940b324d7873f3fe25bea9a346d0e0cd3f6948e0466a80e` |

## Validation

- All five active files are 1254 × 1254 PNGs.
- SHA-256 hashes of the active files match their generated source files.
- `CATALOG_PRODUCTS` continues to point at the five destination paths, and the catalog integrity test checks all 34 displayed product assets.
- No catalog data or asset-integrity tests required edits; the existing test validates a local asset for every displayed product and checks the active count is 34.
- `npm test` passed: 22 tests, including the catalog asset-integrity test.
- `npx tsc --noEmit` passed.
- Targeted lint (`npx eslint tests/catalog-products.test.ts src/lib/landing/catalog-products.ts`) passed. The repository-wide `npm run lint` still reports 28 pre-existing errors in unrelated files; this asset-only change did not add a lint error.
- The running local server returned HTTP 200 for `/landing/catalog`; its HTML referenced all five destination paths, and each served image matched the source SHA-256 above.
