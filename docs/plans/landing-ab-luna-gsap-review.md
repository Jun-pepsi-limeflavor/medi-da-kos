# Landing A/B GSAP review

## Verdict

**Pass — no GSAP-specific blocking findings.** The implementation uses GSAP 3.15.0 in the catalog, shared consultation form, and consultation wizard. The reviewed flows retain their existing state transitions: catalog tabs, product detail dialog, selected-item tray, catalog form, dashboard wizard edits, and dashboard-to-form handoff.

## Evidence

- `CatalogLanding` scopes entrance effects with `gsap.context(...).revert()`. Category and dialog-exit timelines are explicitly killed on replacement/unmount; category changes and dialog close preserve the existing state updates.
- `ConsultationForm` scopes heading/field/submit entrance effects with context cleanup. `shouldReduceLandingMotion()` is checked before creating any animation, leaving reduced-motion DOM styles at their immediate defaults.
- `CMWizard` animates only the consultation-mode step container, keyed by the current step, and reverts the context on step changes/unmount. Order-mode behavior is untouched by the new effect.
- `npm install --package-lock-only --ignore-scripts --dry-run`: up to date; `package.json`'s `gsap: ^3.15.0` matches the lockfile's `node_modules/gsap` 3.15.0 entry.
- `npx tsc --noEmit`: passed.
- Targeted ESLint over the changed landing/wizard/context files: 0 errors, 1 pre-existing `@next/next/no-img-element` warning in `CMWizard.tsx:688` for the uploaded-logo preview.

The broader report's asset test failure and network-blocked production build are outside this GSAP review and do not establish a motion regression.
