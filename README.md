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
   - `orders/{autoId}` — order history, field `uid` for queries
   - `tracking/{uid}/entries/{entryId}` — shipment tracking
   - `users/{uid}` — user profiles
   - `mail/{docId}` — email queue (Cloud Functions send via Gmail API as `support@medidakos.com`)
4. Deploy Cloud Functions and configure `functions/.env` (`ADMIN_EMAILS`, `NOTIFY_FROM_EMAIL`). See [Firebase collections & mail](docs/firebase-collections-and-mail.md).
5. Set `NEXT_PUBLIC_USE_MOCK_AUTH=false` when ready for production auth.

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing home + hero carousel |
| `/about-us` | Company & manufacturing network |
| `/process` | ODM workflow (brief → delivery) |
| `/compare` | Unit economics & lead-time benchmarks |
| `/login` | Sign in / register |
| `/dashboard` | CM Steps 1–6 |
| `/dashboard/orders` | Orders (empty state) |
| `/dashboard/tracking` | FedEx / DHL / UPS tracking |

## Design

Clean, water-inspired UI referencing Samsung Biologics–style trust and K-beauty hydration aesthetics. English-only copy throughout.

## Documentation

- [Firebase collections & email notifications](docs/firebase-collections-and-mail.md) — when each collection is written, mail triggers, and email templates
