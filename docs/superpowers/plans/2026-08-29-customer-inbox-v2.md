# Customer-centered inbox v2 implementation plan

> **For agentic workers:** Use subagent-driven development task by task. This plan does not authorize commits, pushes, deploys, Firestore backfills, Secret changes, or provider canary sends.

**Goal:** Add a customer-centered conversation read model over provider-native threads, then expose its first usable admin workspace without changing the original message records or reply path.

**Architecture:** `messages` and `threads` remain the provider source of truth. A deterministic identity document connects a thread to exactly one conversation or the review queue; `conversations` stores a server-maintained list rollup. The existing Gmail thread reply route remains the only reply transport. Admin writes use `withAdmin`, strict Zod input schemas, Admin SDK transactions, and per-conversation events.

**Tech stack:** Next.js 16.2 server components and route handlers, TypeScript strict, Zod, Firebase Admin SDK, Firestore rules/emulator tests, Node built-in tests, Tailwind v4.

**Spec:** `docs/plans/받은편지함 PLAN.md`

## Global constraints

- Do not expose cost, supplier terms, margin, or exchange rates in client components, API responses, rollups, briefs, or events.
- Do not change provider `messages`; reply only through the selected original thread.
- Client Firestore reads and writes to `buyers`, `suppliers`, `deals`, `messages`, `threads`, `conversationIdentities`, `conversations`, and every conversation child collection remain denied.
- Preserve legacy `threads.buyerId`, `supplierId`, and `dealId`; a new connection that conflicts with a legacy value fails transactionally.
- Normalize an email identity with exactly `trim().toLowerCase()`; never name-match or create a buyer/supplier automatically.
- A thread has exactly one `conversationId` or is represented by one review identity. `unclassified`, `internal`, and `advertising` are review queues, not customer conversations.
- `needsReply` is true only when `lastInboundAt` is later than both `lastOutboundAt` and `handledThroughAt`.
- Keep pages server-rendered; client components are leaf controls only. Use dynamic route `params` from Next 16 route context, not pathname parsing.
- The initial UI uses existing dark neutral/indigo tokens and Geist. It has visible focus states, native buttons/links, text plus color for state, no hover-only action, an action-level status/error, and an equivalent button/keyboard path for every future drag action.

## Task 1: Conversation contracts, pure derivations, and deny rules

**Files:**

- Create: `src/lib/schemas/conversation-identity.ts`
- Create: `src/lib/schemas/conversation.ts`
- Modify: `src/lib/schemas/thread.ts`
- Modify: `firestore.rules`
- Create: `tests/conversation-state.test.ts`
- Create: `tests/rules/conversations.test.mjs`

**Produces:** `ConversationIdentity`, `Conversation`, `ConversationRollup`, `conversationIdentityId()`, `normalizeEmailIdentity()`, `threadNeedsReply()`, strict mutation schemas, and client-deny rule coverage.

- [ ] Write failing Node tests for email normalization, deterministic identity IDs, Channel Talk identity IDs, exactly-one review-or-conversation placement, legacy link conflict, and inbound/outbound/manual-completion reply state.
- [ ] Add `conversationIdentitySchema` with `kind: "email" | "channeltalk"`, normalized value, `classification: "unclassified" | "buyer" | "supplier" | "internal" | "advertising"`, optional conversation/buyer/supplier IDs, and ISO timestamps. Reject unknown keys in every mutation schema.
- [ ] Add `conversationSchema` with only non-financial customer workflow fields: buyer/supplier IDs, `identityIds`, `mergedConversationIds`, owner/collaborator email fields, workflow state, next action, due date, default outbound account, list rollup fields, and timestamps. Keep an explicit `conversationPatchSchema` allowlist.
- [ ] Extend `threadSchema` with optional `identityId`, `classification`, `conversationId`, `lastInboundAt`, `lastOutboundAt`, and `handledThroughAt`; retain all legacy fields. Replace the old last-direction-only calculation with a pure timestamp comparison that treats absent timestamps as no pending reply.
- [ ] Add explicit `allow read, write: if false` matches for `conversationIdentities`, `conversations`, `conversations/{id}/brief/{briefId}`, and `conversations/{id}/events/{eventId}`. Add emulator tests proving anonymous and authenticated browser clients cannot read or write each path.
- [ ] Run the targeted Node tests and rules tests; record only actual failures, without changing unrelated legacy rule coverage.

## Task 2: Server repositories and audited admin mutations

**Files:**

- Create: `src/lib/repo/conversations.ts`
- Modify: `src/lib/repo/threads.ts`
- Create: `src/app/api/admin/conversations/[id]/route.ts`
- Create: `src/app/api/admin/conversation-identities/[identityId]/classify/route.ts`
- Create: `src/app/api/admin/threads/[threadKey]/handled/route.ts`
- Modify: `tests/conversation-state.test.ts`

**Consumes:** Task 1 contracts. **Produces:** server-only list/detail reads, transactional identity classification, constrained workflow patching, explicit manual completion, and per-conversation audit events.

- [ ] Write tests for a valid owner/workflow patch, rejection of unknown or financial fields, a rejected legacy/new link mismatch, and a new inbound timestamp making an otherwise handled thread pending again.
- [ ] Implement `listConversationRollups(queue)` as a single `conversations` query and in-memory ordering by overdue, oldest unanswered, unassigned, then newest activity. Do not read thread messages in this list function.
- [ ] Implement `getConversationDetail(id)` to return the conversation, identities, linked threads, and messages ordered by time; all calls occur in server components/routes only.
- [ ] Implement transactional `classifyIdentity()` that validates the selected existing buyer/supplier/conversation IDs, rejects automatic entity creation, updates the identity/thread/conversation together, writes an event containing actor/reason/action metadata, and refuses a legacy mismatch.
- [ ] Implement `patchConversation()` with only `ownerEmail`, `collaboratorEmails`, `workflowState`, `nextAction`, `dueAt`, and `defaultOutboundAccount`; write an event in the same transaction.
- [ ] Implement `markThreadHandled()` as an authenticated transaction that records only `handledThroughAt` and an audit event; it must not mutate provider messages or pretend to send an answer.
- [ ] Implement route handlers with `withAdmin`, `RouteContext` params, safe JSON parsing, Zod errors as 400, missing entities as 404, and no raw document dump in errors.
- [ ] Run the focused tests and `npm run typecheck` before the next task.

## Task 3: Ingestion dual-write and health read model

**Files:**

- Modify: `functions-ingest/store.js`
- Modify: `functions-ingest/store.test.js` or existing closest ingest test file
- Modify: `src/lib/repo/ingest-state.ts`
- Modify: `src/lib/repo/conversations.ts`

**Consumes:** Tasks 1-2. **Produces:** idempotent write-time identity/thread/conversation rollups and a UI-safe ingest health summary.

- [ ] Add tests for duplicate poll idempotency, a new inbound reopening only its own thread, an outbound preserving another unanswered thread, manual handling followed by a new inbound, and a thread being put into exactly one conversation or review identity.
- [ ] In the existing `saveMessage()` transaction, create or reuse the deterministic identity. For known existing buyer emails, attach to that buyer's existing customer conversation only when it is unambiguous; otherwise leave it in review. Never infer by display name or create an entity.
- [ ] Transactionally update the original message/thread behavior plus `lastInboundAt` or `lastOutboundAt`, the identity placement, and the affected conversation rollup. Preserve `sideSource: "manual"`, parse/extraction fields, and human state.
- [ ] Store only a safe rollup preview (counterparty display label, last subject/snippet, provider label, dates, counts) in `conversations`; omit bodies, attachments, internal notes, and all finance fields.
- [ ] Add an `ingestHealthSummary()` server read that reports enabled providers whose last success is older than 15 minutes or whose last error is present; it must not manufacture provider status.
- [ ] Run the ingest-focused tests plus `npm run typecheck`. Do not run a backfill, deploy, alter secrets, or activate a provider.

## Task 4: Customer-work three-panel inbox vertical slice

**Files:**

- Modify: `src/app/admin/(dash)/inbox/page.tsx`
- Create: `src/app/admin/(dash)/inbox/InboxWorkspace.tsx`
- Create: `src/app/admin/(dash)/inbox/ConversationQueue.tsx`
- Create: `src/app/admin/(dash)/inbox/ConversationTimeline.tsx`
- Create: `src/app/admin/(dash)/inbox/ConversationInspector.tsx`
- Modify: `src/app/admin/(dash)/inbox/[threadKey]/ThreadReplyForm.tsx` only if it needs a query-string return target
- Create: `tests/inbox-workspace.test.ts`

**Consumes:** Tasks 1-3. **Produces:** a deep-linkable customer queue with no list-side message N+1 reads, desktop three panels, and mobile queue-to-timeline-to-inspector progression.

- [ ] Write tests for ordering (overdue, oldest unanswered, unassigned, recent), an unassigned row remaining visible, status labels carrying text as well as color, and query-string selection of conversation/thread/panel.
- [ ] Keep `page.tsx` a dynamic server component. Fetch the queue through `listConversationRollups()` once and fetch only the selected conversation detail; surface the ingest health warning when the summary reports it.
- [ ] Render `InboxWorkspace` as a client leaf for selection and mutation feedback. On desktop use a responsive grid with queue, timeline, and inspector; do not set a fixed minimum that produces narrow-screen horizontal overflow.
- [ ] Render the same data as a mobile staged view: queue first, then timeline, then inspector, with native back buttons and visible page headings. Preserve query-string deep links.
- [ ] Make the timeline show provider/account, subject, and original-thread boundaries. Retain the existing `ThreadReplyForm` only within the selected original thread so provider threading remains intact.
- [ ] Use native controls, `aria-current`/`aria-pressed` where applicable, visible `focus-visible` rings, loading/disabled feedback, `role="alert"` near failed mutations, and 44px minimum action hit areas. Do not implement drag before a button and keyboard classification path exists.
- [ ] Run focused UI tests, typecheck, and a browser check at 375px, 768px, 1024px, and 1440px with reduced motion. An authenticated Aside session is required for final real-record QA; report it separately if unavailable.

## Task 5: Review queue and identity classification controls

**Files:**

- Modify: `src/app/admin/(dash)/inbox/InboxWorkspace.tsx`
- Create: `src/app/admin/(dash)/inbox/ReviewQueue.tsx`
- Modify: `src/lib/repo/conversations.ts`
- Modify: `tests/inbox-workspace.test.ts`

**Consumes:** Tasks 1-4. **Produces:** review grouping by identity and equivalent button/keyboard classification controls.

- [ ] Write tests showing every unclassified/internal/advertising identity appears once, a classifier calls the same route regardless of button or keyboard invocation, and neither path offers automatic buyer/supplier creation.
- [ ] Add the `검토함`, `제조사`, and `광고·내부` top-level queues backed by identity/conversation rollups. Customer-work remains the default queue.
- [ ] Provide explicit classification buttons and keyboard shortcuts with discoverable labels. Do not ship pointer drag in this task; adding it later may only invoke the same server mutation.
- [ ] Show API progress and adjacent failure text, then refresh the server state after success without exposing data in client logs.
- [ ] Run focused tests, typecheck, lint, and keyboard-only browser verification.

## Deferred security-gated work

The following requirements remain deliberately unimplemented until the user supplies the missing allowlist/data contract or the plan's separate operational approval. This is not a backdoor stub and must not be presented as available UI:

- Brief analysis/approval and supplier-share sending: the plan does not define the exact approved brief-field allowlist or revision payload, so a server send boundary cannot safely be inferred.
- Backfill execution: create a read-only dry-run report before any write, then obtain separate approval before the idempotent backfill.
- Provider activation, secret binding, Gmail/Outlook/Channel Talk canaries, deployment, and real outbound supplier shares.

## Plan self-review

- Spec coverage implemented here: new identity/conversation hierarchy, per-thread reply state, dual-write, review placement, safe list rollup, server-only admin mutations, deny rules, ingest warning, responsive three-panel customer work, and button/keyboard classification.
- Security gate preserved: exact brief allowlist and provider send capability are not guessed; no backfill/deploy/send action is authorized.
- YAGNI ruling: no new UI framework, feature-flag system, provider abstraction, client Firestore SDK, or secondary audit collection. Existing thread reply and rendering components remain in use.
