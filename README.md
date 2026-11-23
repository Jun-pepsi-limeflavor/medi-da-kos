# Medi Da Kos

Korean custom ODM brokerage platform for global beauty brand operators. Built with **Next.js**, **TypeScript**, and **Firebase** (Auth + Firestore).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local mock mode (no Firebase required)

Run `NEXT_PUBLIC_USE_MOCK_AUTH=true npm run dev` to use mock auth (localStorage, nothing sent to Firebase).
Mock mode is explicit opt-in only; without Firebase config and without this flag, `npm run dev` stops.

There is no pre-made account: create one at `/signup`, or use **Continue with Google** (mock demo user).

## Firebase setup

1. Copy `.env.example` to `.env.local` and add your Firebase web app config.
2. Enable **Email/Password** and **Google** sign-in in Firebase Authentication.
3. Create Firestore collections (rules as needed):
   - `users/{uid}` — user profiles
   - `contact/{autoId}` — Contact form submissions
   - `mail/{docId}` — email queue (Cloud Functions send via Gmail API as `support@medidakos.com`)
4. Deploy Cloud Functions and configure `functions/.env` (`ADMIN_EMAILS`, `NOTIFY_FROM_EMAIL`). See [Firebase collections & mail](docs/operations/firebase-collections-and-mail.md).
5. Leave `NEXT_PUBLIC_USE_MOCK_AUTH` unset or `false` outside local mock development.

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing home + hero carousel |
| `/about-us` | Company & manufacturing network |
| `/contact` | Contact form (Firestore `contact` → admin mail + Channel Talk) |
| `/login` | Sign in / register |

## Design

Clean, water-inspired UI referencing Samsung Biologics–style trust and K-beauty hydration aesthetics. English-only copy throughout.

## Documentation

- [Firebase collections & email notifications](docs/operations/firebase-collections-and-mail.md) — when each collection is written, mail triggers, and email templates
