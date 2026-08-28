# Catalog image display debug report

Date: 2026-08-27

## Diagnosis

The catalog image source files were already replaced correctly. For example,
`public/landing/catalog/niacinamide-2-saponin-pink-serum.png` is a 1,216,443
byte product image, and the same URL served by `http://localhost:3100` had an
identical SHA-256 digest.

Port 3100 is served by the intended worktree:

```
node /private/tmp/medi-da-kos-landing-catal-dash-ab/node_modules/.bin/next dev --port 3100
```

Cards used `next/image`, so browser requests were normally routed through
`/_next/image`. That optimizer keeps transformed files in
`.next/dev/cache/images`; the public file path did not change when the
placeholder was replaced. This could therefore keep showing the old optimized
placeholder even though the public PNG had changed.

## Fix

Catalog card images now use `next/image` with `unoptimized`. The cards directly
request their current local public file, for example:

```
/landing/catalog/niacinamide-2-saponin-pink-serum.png
```

This removes the stale Next image-optimizer layer for the catalog only. The
three products without supplied source files remain on their existing
placeholder images.

## Verification

- `http://localhost:3100/landing/catalog` HTML emits the direct image URL and
  no `/_next/image` URL for the first card.
- The served direct image and worktree source image have matching SHA-256
  digests.
- `npx tsc --noEmit` passed.
- `npm test` passed: 20/20.

The browser-automation subagent could not attach to the existing in-app tab,
so direct UI inspection was not available in that session. A normal refresh of
the existing catalog tab now loads the direct product image URLs.
