# Backoffice loading baseline

Status: instrumentation is available locally; authenticated production measurements are pending.

## Event contract

Server logs emit only `event`, `operation`, rounded `durationMs`, and numeric `counts`. Operations are `admin.auth`, `inbox.queue`, `inbox.detail`, `deal.board`, and `intake.load`. The event does not include user identifiers, subjects, message bodies, or document contents.

## Production capture sheet

Before claiming an optimization result, record five cold loads and twenty warm navigations per route in an authenticated session.

| Route | TTFB p50/p95 | RSC bytes | Queue/detail ready p50/p95 | Main-thread blocking | Firestore counts |
|---|---:|---:|---:|---:|---:|
| `/admin/inbox` | pending | pending | pending | pending | pending |
| `/admin/deals` | pending | pending | pending | pending | pending |
| `/admin/suppliers` | pending | pending | pending | pending | pending |
| `/admin/intakes` | pending | pending | pending | pending | pending |

Also record the deployed Vercel function region and Firestore database location without exposing environment values. This repository change does not include a deployment or production measurement.
