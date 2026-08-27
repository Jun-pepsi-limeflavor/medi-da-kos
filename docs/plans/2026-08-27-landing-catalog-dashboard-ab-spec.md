# Cold-mail Landing Catalog/Dashboard A/B Spec

**Date:** 2026-08-27
**Routes:** `/landing/catalog`, `/landing/dashboard`
**Branch:** `feat/landing_catal_dash_ab`

## Goal

Compare two cold-mail landing experiences while keeping the conversion action identical: a buyer sends a consultation request and Medidakos follows up by email. Neither page creates a sample request, an order, or an account.

## Shared consultation handoff

Both variants collect these fields immediately before submission:

- Company / brand name — required, 1–200 characters
- Contact name — required, 1–120 characters
- Work email — required, valid email shape, at most 320 characters
- Country — required, 1–100 characters
- Expected order quantity — required, 1–40 characters; “Not sure yet” is valid
- Message — optional, at most 5,000 characters

After a successful Firestore write, show exactly:

> Thank you — your request has been received. A member of our team will review the details and contact you shortly.

Submission failures keep the entered values and show a retry message plus `hally@medidakoslabs.com` as the fallback contact.

## Catalog variant

Use four tabs: Serum, Toner, Cream, Mist. The tab treatment and responsive tile grid follow the interaction shown in React Bits Pro Ecommerce 7: a visible animated underline identifies the current category and the tile collection changes without navigation.

The product source is Figma file `156LMOUK4MKVBgRySLuMp8`, page `0:1`. Transfer the actual product image, product name, description, differentiators, technology, key ingredients, usage instructions, and 1,000/5,000-unit reference prices when present. Store downloaded assets under `public/landing/catalog/`; production code must not depend on expiring Figma URLs.

Catalog inventory:

- Serum (24): NIACINAMIDE 2% + SAPONIN PINK SERUM; GREEN APPLE CAPSULE SERUM; SUPER PDRN BOOSTER; GREEN RETINAL BEAN DROP SERUM; CLOUD ROOT SOOTHING SERUM; NAD + SLUSH RESET SERUM; LACTO CREAM SERUM; PERFECT RESURFACING SERUM; HYALURON SEAL SERUM; HYALUCOGEN SERUM; PANTHENOL REGENERATIVE SERUM; TIMELESS NOURISHING SERUM; PINK HYDRATION CAPSULE SERUM; HYDRA JELLY SMOOTHIE SERUM; RETINOL MATRIX REPAIR SERUM; DERMA ACTION REVITALIZING SERUM; HYDRO BOOST HYALURONIC ACID SERUM; LAYER BLENDING SERUM; YUJA Vit.C BRIGHTENING SERUM; BETA CALMING REPAIR AMPOULE; DAILY GLUTA SHOT; POWER ANTIAGING SERUM; FIRMING SOLUTION (MULTI-PEPTIDE EYE SERUM); DEPUFFING SOLUTION (CAFFEINE + EGCG EYE SERUM)
- Toner (4): PDRN GLOW BOOSTER; GREEN EXOSOME SEBUM SOFTENER; PANTHENOL 10 REPAIR ESSENCE TONER; PHA 10 GLASS RESET BUBBLE TONER
- Cream (6): PDRN-EEDLE REVIVAL CREAM; QUERCETIN 1000 CALMING CREAM; GREEN BALANCING CREAM; BERRY BOUNCE BALM; R.E.D BLEMISH CLEAR MOISTURE CREAM; GREEN FLAVONOID SOOTHING CREAM
- Mist (4): RED ELIXIR JELLY MIST; DEW LAYER SERUM MIST; RED REVIVE DUAL MIST; COLLAGEN HYDROGEL MIST

Selecting a tile opens a compact detail panel. The only product actions are `Discuss this product` and `Add to consultation`. The consultation list allows removing items and accepts at most 12 products. Reference prices are informational and must never appear as a payable total.

## Dashboard variant

Keep the existing dashboard content, field choices, validation, and order:

1. Category
2. Packaging
3. Branding
4. Quantity & Specs
5. Formula
6. Compliance

Reuse `CMWizard` and its existing step components. Add a consultation mode rather than duplicating the six step implementations. Consultation mode:

- has no authentication guard, account navigation, Orders, Tracking, or Logout links;
- stores a draft in browser local storage under `medidakos:landing-dashboard-brief:v1`;
- does not write `cmBriefs`, `orders`, or `sampleRequests`;
- omits `Top10Products` and all sample-order behavior;
- changes final action copy from `Submit brief` to `Continue to consultation`;
- opens the shared contact form after the existing step-6 validation succeeds;
- removes `logoDataUrl` from the final Firestore snapshot while preserving `logoFileName`.

## Firestore document

Collection: `landingRequests`

```ts
type LandingVariant = "catalog" | "dashboard";

interface LandingRequestDocument {
  landingVariant: LandingVariant;
  companyName: string;
  contactName: string;
  email: string;
  country: string;
  expectedVolume: string;
  message?: string;
  catalogItems?: Array<{
    id: string;
    name: string;
    category: "serum" | "toner" | "cream" | "mist";
  }>;
  dashboardBrief?: Record<string, unknown>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl: string;
  gaClientId?: string;
  userAgent?: string;
  isTest: boolean;
  status: "new";
  createdAt: string;
  serverCreatedAt: FieldValue;
}
```

Exactly one of `catalogItems` and `dashboardBrief` is present, matching `landingVariant`. Public clients may create a valid document but may not read, update, or delete it. Rules limit strings, catalog list length, and the accepted top-level keys.

## Internal email

Add an `asia-northeast3` Firestore create trigger for `landingRequests/{requestId}`. It sends one internal notification through the existing `mail` collection and `ADMIN_EMAILS`. It does not email the buyer. `isTest === true` submissions do not enqueue mail. Every buyer-provided value is HTML-escaped.

## Measurement

Assign variants in outbound email links, not by randomizing inside the browser. Keep campaign parameters comparable and use `utm_content=dashboard` or `utm_content=catalog`.

Events:

- `consultation_start` — first meaningful interaction with the variant
- `catalog_category_view` — category tab selection
- `catalog_product_view` — detail panel opened
- `catalog_product_select` — consultation item added
- `dashboard_step_view` — landing dashboard step shown
- `consultation_submit` — only after the Firestore write succeeds

Every event includes `landing_variant` and the existing `is_test`. Do not send company name, contact name, email, message, or other personal data to Google Analytics.

## Acceptance criteria

- Both routes render without login and are usable at mobile and desktop widths.
- Both routes finish in the same contact form and success message.
- No interaction creates `orders`, `sampleRequests`, or `cmBriefs` documents.
- Catalog tabs, product detail, selection, removal, and 12-item cap work by keyboard and pointer.
- Dashboard preserves the six existing steps and uses local draft persistence.
- `landingRequests` rejects reads, updates, deletes, malformed emails, mismatched variant payloads, and oversized values.
- Production submissions enqueue one escaped internal notification; test submissions enqueue none.
- Targeted tests, typecheck, lint, build, and Terra browser verification pass before completion is reported.
- Do not commit, push, deploy, or modify the original checkout unless the user explicitly asks.
