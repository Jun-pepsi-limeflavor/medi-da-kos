# Landing A/B GSAP report

## Completed

- Added GSAP 3.15.0 and used it in the public landing client components.
- Catalog: heading and tab entrance, category tile exit/entrance stagger, selected-item tray entrance, and product detail dialog entrance/exit.
- Dashboard: consultation-wizard content transition when the current step changes.
- Shared consultation form: heading, fields, and submit-button entrance.
- All landing GSAP effects check `prefers-reduced-motion` before creating motion. Reduced-motion users keep the normal immediately-rendered DOM.
- React effects use `gsap.context(...).revert()` cleanup; manually managed category and dialog timelines are killed on unmount.

## Verification

- `npx tsc --noEmit`: passed.
- Targeted ESLint: no errors; one existing `@next/next/no-img-element` warning in `CMWizard.tsx` (uploaded-logo preview, line 688).
- Browser, desktop: catalog has all four tabs; Toner switched to four tiles; PDRN detail dialog visibly opened and closed; dialog-scoped add updated the tray to one selected item. Dashboard rendered without account UI and transitioned from Category to Packaging.
- Browser, mobile 390x844: catalog and dashboard both had no horizontal overflow. Fresh dashboard console after the GSAP fix had no GSAP or hydration warnings; it only reports the existing missing ChannelTalk environment-key warning.
- `npm test`: 19 passed, 1 failed before motion concerns: `catalog assets are present and each product has a distinct image` found one unique local image instead of 38. This is catalog-asset scope, not changed here.
- `npm run build`: blocked by sandbox network access to Google Fonts (`Geist`, `Geist Mono`, `Noto Serif`), not by a TypeScript or GSAP build error.

## Notes

- A preview was already reachable on port 3100. Attempting to start an additional server was denied because that port was in use/restricted, so the existing preview was used for verification.
- No commit, push, or deployment was performed.
