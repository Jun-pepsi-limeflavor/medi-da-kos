# Medi Da Kos

Korean custom ODM brokerage platform for global beauty brand operators. Built with **Next.js**, **TypeScript**, and **Firebase** (Auth + Firestore).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local mock admin (no Firebase required)

When Firebase env vars are empty, the app runs in **mock mode** (localStorage).

| Field | Value |
|-------|--------|
| Email | `admin@medidakos.com` |
| Password | `MediDaKos2024!` |

You can also register new accounts or use **Continue with Google** (mock demo user).

## Firebase setup

1. Copy `.env.example` to `.env.local` and add your Firebase web app config.
2. Enable **Email/Password** and **Google** sign-in in Firebase Authentication.
3. Create Firestore collections (rules as needed):
   - `cmBriefs/{uid}` — custom manufacturing brief (draft/submitted)
   - `sampleRequests/{autoId}` — Top 10 sample requests
   - `orders/{autoId}` — order history (custom + sample), field `uid` for queries
   - `tracking/{uid}/entries/{entryId}` — shipment tracking
   - `users/{uid}` — user profiles
4. Set `NEXT_PUBLIC_USE_MOCK_AUTH=false` when ready for production auth.

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing home + hero carousel |
| `/about-us` | Company & manufacturing network |
| `/process` | ODM workflow (brief → delivery) |
| `/compare` | Unit economics & lead-time benchmarks |
| `/login` | Sign in / register |
| `/dashboard` | CM Steps 1–6 + Top 10 samples |
| `/dashboard/orders` | Orders (empty state) |
| `/dashboard/tracking` | FedEx / DHL / UPS tracking |

## Top 10 product images

Replace placeholders in `public/products/prod-01.svg` … `prod-10.svg` with your product photos (same filenames, `.jpg` or `.png` — update paths in `src/lib/products.ts`).

## Design

Clean, water-inspired UI referencing Samsung Biologics–style trust and K-beauty hydration aesthetics. English-only copy throughout.
