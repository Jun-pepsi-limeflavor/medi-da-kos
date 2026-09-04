# Backoffice loading performance implementation plan

> **Status:** Draft for review. This plan does not authorize code changes, commits, pushes, deployments, Firestore writes, backfills, or schema changes.

**Goal:** Make the authenticated backoffice feel responsive and reduce server work without changing the current security, inbox coverage, provider-thread, or finance-data boundaries.

**Decision:** Keep Firestore for this optimization cycle. Measure and remove avoidable reads, waterfalls, fan-out queries, and oversized React Server Component payloads before considering PostgreSQL. Do not add Redis, an ORM, OpenTelemetry packages, or a second database in the initial implementation.

**Priority:** `/admin/inbox` first, then `/admin/deals` and `/admin/suppliers`, then `/admin/intakes` if its measured impact justifies a new read model.

**Tech stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript strict, Firebase Admin SDK 13.6.0, Firestore, Node built-in tests, Vercel Git integration.

## Evidence frame

### Observed

- `/admin/inbox` is force-dynamic and its customer-work path reads ingest health, all buyers, all suppliers, all conversation rollups, and one conversation detail. Buyers and suppliers are only consumed by review queues.
- The first inbox visit has a waterfall: it reads and sorts all conversation rollups before it knows which first conversation detail to load.
- `listConversationRollups()` reads the entire `conversations` collection and sorts it in application memory.
- Conversation detail reads identities, threads, events, and then runs one message query per linked thread.
- `InboxWorkspace` is a Client Component that receives the complete queue, detail, buyer, and supplier structures as serializable props.
- `listDealsWithDetails()` loads every deal and then six subcollections per deal. The kanban board does not use shipments or events.
- `/admin/intakes` reads five source collections plus all intake reviews before assembling rows.
- The admin layout and some child pages can both call `requireAdminPage()`. The Firebase session check uses revocation checking and should retain that behavior.
- There is no admin-specific `loading.tsx`, request timing log, or current production p50/p95 baseline in the repository.

### Inferred

- The first likely bottlenecks are query volume, dependent server round trips, serialized RSC payload size, and deployment/database region distance—not the document data model by itself.
- Removing unused reads and fixed fan-out is lower risk than caching or schema migration.

### Unknown

- Current production document counts and average document sizes.
- Vercel function region, Firestore database location, cold-start frequency, and their network distance.
- Authenticated production TTFB, queue-ready time, detail-ready time, RSC payload size, hydration cost, and p50/p95 values.
- Which route is slowest in real operator usage.

## Global constraints

- Do not expose buyers, suppliers, deals, messages, threads, ingest state, or finance data through the Firebase client SDK.
- Keep server authorization and `checkRevoked: true`. Performance work may deduplicate the same check within one render request but must not weaken it across requests.
- Preserve the inbox invariant: every inbound must remain reachable through a customer conversation or a review queue. Optimization must not drop older, unassigned, overdue, or unclassified work.
- Preserve existing customer-work ordering: overdue, oldest unanswered, unassigned, then recent activity. Do not replace it with recent-only pagination without a separately approved queue contract.
- Do not mutate provider-native `messages` for read performance. Do not change reply routing or thread identity.
- Do not cache request-specific actor data or raw message bodies across admins.
- Do not log email addresses, message bodies, subjects, attachment names, credentials, session values, or document contents. Performance logs contain route/operation names, duration, counts, and byte estimates only.
- A new collection, denormalized field, index contract, or backfill requires a data-shape proposal and explicit approval before implementation.
- Implement on a dedicated `fix/backoffice-loading` branch from the approved base. Do not switch branches over a dirty worktree.
- Commit, push, deploy, and production mutation remain separately authorized actions.

## Provisional performance budgets

Task 0 replaces these provisional budgets with an agreed baseline/SLO before later optimization claims are made.

| User-visible event | Warm authenticated production target (p95) |
|---|---:|
| Navigation shows route-specific skeleton or stable shell | 250 ms |
| Inbox queue is usable | 1,500 ms |
| Selected conversation detail is usable | 1,500 ms |
| Deal board is usable | 2,000 ms |

Additional budgets:

- No route may increase Firestore document reads or RSC payload bytes relative to its recorded baseline.
- Each optimized route should reduce its dominant server span by at least 30%, unless it already meets the agreed absolute SLO.
- Correctness, coverage, authorization, and audit behavior take precedence over a timing target.

## Task 0: Establish the baseline and measurement contract

**Files:**

- Create: `src/lib/admin-performance.ts`
- Modify: `src/lib/repo/conversations.ts`
- Modify: `src/lib/repo/deals.ts`
- Modify: `src/app/admin/(dash)/intakes/page.tsx`
- Create: `docs/backoffice-loading-baseline.md`
- Test: `tests/admin-performance.test.ts`

**Produces:** A small server-only timing helper, safe structured timing events, and a reproducible before-change baseline.

- [ ] Write one focused test showing the timing helper records operation name, rounded duration, and numeric counts while rejecting or omitting arbitrary payload data.
- [ ] Use `performance.now()` and existing logging facilities. Do not add a monitoring dependency or build a general tracing framework.
- [ ] Time only the route-level repository operations needed to distinguish auth, queue, detail, deal-board, and intake loading. Record returned document counts alongside durations.
- [ ] In an authenticated production session, record at least 5 cold loads and 20 warm navigations for inbox, deals, suppliers, and intakes. Capture TTFB, RSC transfer size, route-ready time, and browser main-thread blocking from the Network/Performance panels.
- [ ] Inspect the deployed Vercel function region and Firestore database location read-only. Record the result without printing environment values or credentials.
- [ ] Record dataset counts using metadata/count queries where available; do not download document bodies solely to count them.
- [ ] Rank bottlenecks by measured user impact and cost. Stop work on any later task whose route already meets the agreed SLO and has no scaling cliff.

## Task 1: Apply no-schema inbox quick wins

**Files:**

- Modify: `src/lib/admin-page.ts`
- Modify: `src/app/admin/(dash)/inbox/page.tsx`
- Create: `src/app/admin/(dash)/inbox/loading.tsx`
- Modify: `tests/admin-auth.test.ts`
- Modify: `tests/inbox-workspace.test.ts`

**Produces:** The same inbox behavior with fewer reads, one authorization verification per render request, and immediate navigation feedback.

- [ ] Add a test proving repeated `requireAdminPage()` calls in one React render request share one session verification while a new request verifies again. Preserve revocation checking and all current redirect/500 behavior.
- [ ] Deduplicate `requireAdminPage()` with React request memoization documented for non-`fetch` database/auth calls. Do not introduce cross-request auth caching.
- [ ] In the customer-work branch, stop calling `listBuyers()` and `listSuppliers()` because those props are consumed only by review classification UI.
- [ ] Keep buyer/supplier reads for review queues and verify all classification controls still receive their candidates.
- [ ] Add an inbox-specific skeleton that matches the three-panel dimensions and does not create layout shift. This improves perceived navigation only; do not report it as reduced backend latency.
- [ ] Compare Firestore reads, auth duration, TTFB, and queue-ready time with Task 0. Continue only if the results identify remaining material work.

## Task 2: Separate queue readiness from detail readiness

**Files:**

- Modify: `src/app/admin/(dash)/inbox/page.tsx`
- Modify: `src/app/admin/(dash)/inbox/InboxWorkspace.tsx`
- Modify: `src/app/admin/(dash)/inbox/ConversationQueue.tsx`
- Create: `src/app/admin/(dash)/inbox/ConversationDetailPanels.tsx` only if the existing components cannot form the boundary directly
- Modify: `tests/inbox-workspace.test.ts`

**Produces:** A usable queue that does not wait for conversation messages, events, intake review, or linked deal reads.

- [ ] Write a focused render test showing the queue fallback/list can resolve before a delayed detail promise and that detail failure does not remove the queue.
- [ ] Keep the route shell and queue data in Server Components where possible; keep client boundaries only around search/filter, panel collapse, and mutations.
- [ ] Start independent health, rollup, and explicitly selected-detail reads early. Place slow data behind the nearest meaningful `Suspense` boundary rather than blocking the whole page.
- [ ] For a URL without `conversationId`, render the queue as soon as rollups resolve, then stream the first conversation detail. Preserve the current first-selection behavior and deep links.
- [ ] Do not pass buyers, suppliers, or unrelated review data through the customer-work Client Component boundary.
- [ ] Keep skeleton dimensions stable and ensure keyboard focus is not moved when streamed detail replaces its fallback.
- [ ] Verify initial page loads and client navigations separately; Next.js can deliver different shells for each.

## Task 3: Bound Firestore fan-out without changing the data model

### Task 3A: Conversation detail

**Files:**

- Modify: `src/lib/repo/conversations.ts`
- Modify: `src/lib/repo/messages.ts`
- Modify: `tests/conversation-repository-contract.test.ts`
- Modify: `tests/conversation-repository-emulator.test.mjs`

- [ ] Record the production distribution of threads per conversation and messages per thread before choosing a query shape.
- [ ] If thread fan-out is material, fetch messages for bounded thread-key chunks instead of one query per thread, then reuse the existing chronological merge.
- [ ] Preserve exact message coverage and provider-thread boundaries. Test zero, one, 30, and more-than-30 thread keys plus duplicate-free chronological output.
- [ ] If the measured thread count is small and the detail query meets the SLO, leave this code unchanged.

### Task 3B: Deal board and supplier ledger

**Files:**

- Add: a board-specific loader in `src/lib/repo/deals.ts`
- Modify: `src/app/admin/(dash)/deals/page.tsx`
- Modify: `src/app/admin/(dash)/suppliers/page.tsx`
- Modify: `tests/deal-sync.test.ts`

- [ ] Write a loader test proving board output contains deals, items, supplier engagements, sample rounds, and tasks grouped under the correct deal.
- [ ] Replace per-deal six-subcollection loading with the fewest fixed server queries supported by the current Firestore structure, such as collection-group reads grouped by parent deal.
- [ ] Do not load shipments or events for the board because the current kanban does not consume them. Deal detail continues to load its complete record.
- [ ] Reuse the same minimal board/engagement result for the supplier ledger instead of loading every deal detail.
- [ ] Verify orphan child documents are ignored or surfaced safely and never attached to the wrong deal.

## Task 4: Reduce Client Component payloads

**Files:**

- Modify: `src/app/admin/(dash)/inbox/InboxWorkspace.tsx`
- Modify: `src/components/crm/CrmKanbanBoard.tsx`
- Add or modify explicit list DTOs under `src/lib/repo/` only where current schemas contain unused fields
- Test: closest inbox/deal contract tests

- [ ] Measure serialized RSC payloads before changing DTOs. Do not optimize type shape by guesswork.
- [ ] Project queue, board, and supplier rows to fields actually rendered by those screens. Continue using explicit safe server projections; never spread raw Firestore documents into client props.
- [ ] Keep raw message bodies only in the selected detail payload. Keep finance fields server-only and absent from every list DTO.
- [ ] Compare compressed RSC transfer bytes and hydration/main-thread time before and after.

## Task 5: Optional cache, queue-pagination, and intake gates

These are not part of the first implementation slice.

### Cache gate

Add a cache only when Task 0–4 show a repeated, low-change read remains dominant. Any cache proposal must name its owner, key, TTL, invalidation points, stale-data behavior, and security boundary. Prefer React request memoization first. Do not cache inbox health, actor identity, or raw message detail across requests.

### Conversation pagination gate

The current ordering depends on overdue status, oldest unanswered time, assignment, and recent activity. Before adding pagination, propose a query/read-model contract that keeps every category reachable and preserves priority. If it requires new fields, indexes, or backfill, obtain schema approval and provide a dry-run/reconciliation plan first.

### Intake gate

Independent limits on the five source collections could hide older unreviewed work. If `/admin/intakes` remains a measured bottleneck, propose a unified server-maintained intake queue with exact source references, idempotent materialization, deny rules, emulator tests, dry-run counts, and rollback. Do not implement it under this plan without separate data-contract approval.

## SQL decision gate

Do not migrate databases to satisfy this plan. Revisit PostgreSQL only after Tasks 0–4 when all of the following evidence is available:

1. The optimized Firestore implementation still misses the agreed p95 SLO.
2. Remaining latency is dominated by relational joins or cross-entity transactional constraints, not auth, region distance, cold starts, rendering, or payload size.
3. Read cost grows materially with data volume despite bounded queries/read models.
4. A read-only PostgreSQL PoC using representative anonymized shapes demonstrates a meaningful improvement after connection and operational overhead.
5. The team accepts migration, dual-write/reconciliation, backup, access-control, and operator handoff costs.

If this gate is reached, evaluate the relational deal ledger first. Keep provider-native message ingestion in Firestore unless separate evidence supports moving it.

## Verification matrix

| Area | Required evidence | Failure condition |
|---|---|---|
| Authorization | one verification per render request; revocation and allowlist tests pass | cross-request auth cache or weakened revocation check |
| Inbox coverage | every conversation/review item remains reachable; ordering tests pass | old, overdue, unassigned, or unclassified work disappears |
| Inbox responsiveness | before/after TTFB, queue-ready, detail-ready, reads, RSC bytes | skeleton only improves appearance while server work regresses |
| Conversation detail | exact messages and thread boundaries | omitted, duplicated, or misordered messages |
| Deal board | fixed query count and equivalent rendered board data | missing tasks/items/engagements or finance leakage |
| Supplier ledger | equivalent linked-deal references and status counts | engagement attached to the wrong supplier/deal |
| Security | server-only repositories and safe DTO projections | internal collections or finance data reach client APIs/bundles |
| Regression | focused tests, `npm test`, `npm run typecheck`, `npm run lint`, production build | baseline debt reported as a new pass or ignored as a new failure |
| Browser QA | authenticated Aside checks at 375, 768, 1024, and 1440 px, including reduced motion | anonymous redirect treated as UI verification |

## Implementation sequence and stop conditions

1. Complete Task 0 and review its evidence.
2. Implement Task 1 as the first small change set and compare against baseline.
3. Implement Task 2 only if detail latency still blocks queue usability.
4. Implement only the measured portions of Tasks 3 and 4.
5. Stop when the agreed SLO is met and no near-term scaling cliff remains.
6. Use Task 5 or the SQL gate only through a separately reviewed decision.

## Completion gate

The optimization is complete only when the focused and full checks pass, an authenticated production-like browser run records before/after results, inbound/review coverage is reconciled, and the measured route meets the agreed target. Local tests alone are not production performance evidence. Deployment and post-deploy verification require separate approval.

## Plan self-review

- **Smallest useful first slice:** measurement plus three no-schema/no-dependency changes.
- **Preserved boundaries:** Admin SDK only, server authorization, finance isolation, provider-native messages, inbox coverage, and explicit deploy authority.
- **Deferred deliberately:** Redis, OpenTelemetry setup, Cache Components, queue schema changes, intake materialization, SQL, and provider/data backfills.
- **Revisit signal:** measured SLO miss after Tasks 0–4 or a demonstrated scaling cliff in Firestore reads/payload size.
