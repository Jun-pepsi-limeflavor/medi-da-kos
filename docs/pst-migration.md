# Outlook PST migration

`scripts/import-pst.mjs` converts an Outlook PST to the existing `messages` / `threads` contract. It does not change provider documents, start Gmail polling, or upload attachment binaries.

## Run

Install the local PST extractor once:

```sh
brew install libpst
```

Use the real support mailbox address; do not use a display name or a guessed address.

```sh
node scripts/import-pst.mjs /absolute/path/support.pst \
  --mailbox support@example.com
```

The default is read-only dry-run. After reviewing the count, run:

```sh
FIREBASE_SERVICE_ACCOUNT_B64='...' \
node scripts/import-pst.mjs /absolute/path/support.pst \
  --mailbox support@example.com --apply
```

The importer first exports and parses every `.eml`; it writes nothing if parsing fails. Firestore writes then go through `functions-ingest/store.js`, so rerunning the same PST is deterministic and deduplicated. It does not advance `ingestState` because PST has no provider cursor.

Attachments are preserved as filename, MIME type, size, and deterministic ID metadata. Binary attachment storage requires a separate Storage path and access contract.
