# Plan 7 — 수집기 확장과 통합 집계 Implementation Plan

> **For implementers:** Complete the tasks in order and use the checkboxes (`- [ ]`) to record verification.

**Goal:** 나머지 Gmail 메일함, Outlook, 채널톡, 웹 폼을 같은 `messages`·`threads` 계약으로 집계하고, 관리자만 안전하게 회신할 수 있게 한다.

**Architecture:** `functions-ingest`의 한 스케줄 실행이 제공자별 어댑터를 순서대로 호출하되, 계정별 상태와 실패를 분리한다. 제공자 원문은 결정적 ID로 `messages`에 보존하고, 사람이 관리하는 `threads` 상태는 새 메시지의 최신 활동만 반영한다. 웹 폼은 기존 Firestore 생성 트리거에서 동일한 내부 메시지 투영을 만들며, 브라우저는 제공자 자격증명이나 내부 문서에 접근하지 않는다.

**Tech Stack:** Cloud Functions v2 (CommonJS, Node 20, `asia-northeast3`) / Cloud Scheduler / Gmail REST v1 / Microsoft Graph / Channel Talk Open API / Firestore Admin SDK / Secret Manager

**Spec:** `docs/backoffice-spec.md` — 3장, 6.2, 6.4, 9장 작업 7; 선행 문서 `docs/plans/2026-08-26-ingest-spike.md`, `docs/plans/2026-08-26-inbox.md`

## Global Constraints

- 배포·대화 발송·대화 내용을 바꾸는 테스트는 별도 승인 뒤에만 한다. 이 계획을 읽는 것만으로 권한이 생기지 않는다.
- 서비스 계정 키와 OAuth 토큰은 저장소·로그·브라우저에 두지 않고 Secret Manager 또는 런타임 위임으로만 사용한다.
- `messages`, `threads`, `ingestState`와 기존 원천 폼 컬렉션은 클라이언트에서 읽거나 쓸 수 없다. 모든 관리자 읽기·상태 변경·회신은 서버 허용목록(`withAdmin`)을 통과한다.
- 원가·공급가·마진은 어떤 메시지 본문, 회신 API 응답, 관리자 외 DTO에도 들어가지 않는다.
- 문서 ID와 `threadKey`는 제공자·계정까지 namespaced 한다. 재수집은 원문과 파싱 상태를 보존하고 `threads`의 수동 `side`, 읽음, 보관, 연결 상태를 덮지 않는다.
- 제공자의 모든 페이지를 저장한 뒤에만 해당 계정의 cursor/delta 링크를 전진시킨다. 정상 0건과 실패는 `lastSuccessAt`, `lastError`, `processedCount`로 구분한다.
- 새 컬렉션은 만들지 않는다. 불가피하게 outbox 또는 자격증명 상태 컬렉션을 추가하면 스키마·`firestore.rules`·에뮬레이터 테스트를 같은 변경에 포함하고 먼저 승인을 받는다.

## 현재 확인된 사실과 미해결 전제

- 현재 `functions-ingest/index.js`는 `INGEST_MAILBOXES`에 든 Gmail만 5분마다 읽고, 초기 조회는 `newer_than:7d`다. `google-auth.js`의 현재 범위는 `gmail.readonly` 하나다.
- `docs/gmail-response-shape.md`는 2026-08-27의 Thomas/Hally 읽기 스파이크와 Thomas 단독 배포를 기록한다. 당시 런타임 서비스 계정에도 `mail-ingest`에 대한 `roles/iam.serviceAccountTokenCreator`가 필요했다. 2026-08-28에 로컬 ADC를 통해 `thomas@medidakoslabs.com`과 `hally@medidakoslabs.com`의 위임 토큰 발급과 읽기 전용 `messages.list` 한 페이지를 각각 확인했다. 이는 배포 런타임이나 `gmail.send` 권한의 증거는 아니다.
- 여섯 Gmail 채널은 `thomas@medidakoslabs.com`, `hally@medidakoslabs.com`, `rheekw@techasset.co.kr`, `songjh@techasset.co.kr`, `kimhs@techasset.co.kr`, `parkjy@techasset.co.kr`이다. 첫 두 계정의 위임 승인이 네 `@techasset.co.kr` 계정에도 적용된다고 가정하지 않는다.
- 현재 작업 트리는 이 계획과 무관한 미커밋 변경이 있다. 구현자는 그 파일을 되돌리거나 함께 커밋하지 않는다.

## 데이터 계약

기존 `src/lib/schemas/message.ts`와 `src/lib/schemas/thread.ts`가 기준이다.

| 제공자 | `channel` | `sourceAccount` | 기본 `side` | 외부 ID와 cursor |
|---|---|---|---|---|
| Gmail | `gmail_<local-part>` | 실제 메일함 주소 | `@medidakoslabs.com` → `brand`, `@techasset.co.kr` → 위임 확인 뒤 결정 | Gmail `message.id`, `threadId`, `internalDate`, 계정별 `lastEpochSeconds` |
| Outlook | `outlook_support` | `support@`의 실제 주소 | `unknown` 또는 승인된 계정 규칙 | Graph message ID, conversation ID, 계정별 delta link |
| Channel Talk | `channeltalk` | 설치된 Desk/공용 계정 식별자 | `unknown` | API가 돌려주는 chat/message ID, API 페이지 cursor |
| 웹 폼 | `web` | 원천 컬렉션 이름(`contact`, `koreaLeads`, `orders`, 필요 시 `sampleRequests`) | `brand`를 쓰려면 `sideSource`에 대한 스키마 승인 필요 | 원천 컬렉션과 문서 ID를 합친 결정적 ID |

모든 투영은 기존 필드(`externalId`, `providerThreadId`, `threadKey`, `direction`, `from`, `to`, `subject`, `bodyText`, `attachments`, `sentAt`, `parseStatus`)를 채운다. 웹 폼의 `bodyText`는 원천 문서를 대체하지 않는 읽기용 요약이며, 원천의 고객 이메일·이름·메시지는 서버 내부에만 남는다. `sideSource: "channel_rule"` 같은 새 값이 필요하면 먼저 `src/lib/schemas/message.ts`, `src/lib/schemas/thread.ts`의 enum 변경과 규칙 테스트 승인을 받는다.

## 실행 전 라이브 테스트 게이트

다음 순서가 모두 확인되기 전에는 스케줄 설정, backfill, 회신 발송을 실행하지 않는다.

1. 관리자 콘솔에서 `mail-ingest` 서비스 계정의 OAuth 클라이언트 ID, Gmail API 활성화, `gmail.readonly`·`gmail.send` 위임 범위를 확인한다. `medidakoslabs.com`과 `techasset.co.kr`은 도메인별로 확인하며, 후자의 위임이 없으면 해당 네 계정은 활성화하지 않는다.
2. 배포 런타임 신원에 `mail-ingest`의 `signJwt` 권한과 Secret Manager 접근 권한이 있는지 확인한다. 로컬 사용자 ADC가 성공해도 배포 함수의 신원을 대신하지 않는다.
3. 읽기 전용 canary로 각 활성 Gmail 계정의 `profile`과 한 페이지를 조회하고, 응답 본문이나 토큰을 로그에 남기지 않는다. 계정별 결과를 `ingestState`에 쓰기 전에는 별도 진단 결과로만 보관한다.
4. 초기 backfill 범위(기본 30일 또는 운영자가 정한 ISO 시각)를 승인하고, 실제 메시지 수·첨부 유무·내부/자동 발신 비율을 계정별로 기록한다. 현재 코드의 7일 기본값을 무심코 전체 백필로 해석하지 않는다.
5. Outlook 앱 등록의 tenant/client/secret 보관 위치와 Graph `Mail.Read`·`Mail.Send` 권한 및 `support@` 대상 동의를 확인한다.
6. Channel Talk Open API 키 세 가지(`x-access-key`, `x-access-secret`, `Channel-Version`)의 Secret Manager 보관과 읽기 권한을 확인한다. 웹훅은 쓰지 않는다.
7. 외부 수신자에게 보내는 Gmail/Outlook/Channel Talk 회신 canary는 별도 승인 후, 테스트 주소 한 곳에만 한다. 이 계획 단계에서는 발송하지 않는다.

---

### Task 1: 자격증명·메일함 목록과 Gmail 전체 집계

**Files:**

- Modify: `functions-ingest/google-auth.js`, `functions-ingest/index.js`, `functions-ingest/.env.example`
- Modify: `functions-ingest/gmail.js`, `functions-ingest/store.js`
- Test: `tests/gmail-normalize.test.mjs`, new provider/config tests under `tests/`
- Reference only: `docs/gmail-response-shape.md`

**Interfaces:**

- Consumes: approved mailbox list, per-domain delegation, existing `normalizeMessage()`, `saveMessage()`, `ingestState`
- Produces: six-account Gmail run with isolated success/error state, bounded initial backfill, and deterministic re-runs

- [ ] **Step 1: Write the mailbox contract test.** Assert the six exact addresses map to the six existing channel names; reject blank, duplicate, unsupported-domain, and accidental secret values. Keep `@techasset.co.kr` disabled until its own delegation is verified.
- [ ] **Step 2: Write pagination/backfill tests.** Cover multiple `messages.list` pages, empty pages, a failing `messages.get`, retrying an existing deterministic ID, and cursor advancement only after every page has been stored. Assert a failed account does not stop the next account.
- [ ] **Step 3: Extend auth for read/send without key files.** Request the approved Gmail scopes in the runtime delegation helper, with the exact service account and subject passed server-side. Do not expose tokens or print message bodies.
- [ ] **Step 4: Implement per-account backfill and steady-state polling.** Make the initial lower bound explicit, then retain the existing overlap window for later polls. Record the actual processed count and error per account; preserve human-owned `threads` fields in `store.js`.
- [ ] **Step 5: Run focused tests and a read-only canary after the live gates.** Compare each result to `profile`/`messages.list`, then inspect only counts, timestamps, IDs, and error state. Do not claim live success from a module-load or unit-test result.

### Task 2: Outlook Graph adapter

**Files:**

- Create: `functions-ingest/outlook.js`
- Modify: `functions-ingest/index.js`, `functions-ingest/store.js`
- Test: `tests/outlook-normalize.test.mjs`, `tests/outlook-delta.test.mjs`

**Interfaces:**

- Consumes: Secret Manager Graph credential, `support@` mailbox, Graph message pages and delta links
- Produces: the existing message/thread contract with `outlook_support` and an account-specific delta cursor

- [ ] **Step 1: Capture one anonymized Graph response.** Record the actual message, conversation, sender/recipient, body, attachment, paging, and delta fields before writing a normalizer; do not invent field names from the Gmail shape.
- [ ] **Step 2: Write fixtures and tests.** Cover HTML/text body selection, attachments, sent/inbound direction, conversation namespacing, pagination, delta expiration, and a response with no messages.
- [ ] **Step 3: Implement Graph paging and delta persistence.** Store each page before committing its next link; on an expired delta link, restart the approved backfill window and keep the old failure visible. Reuse `saveMessage()` so parser and human thread fields remain separate.
- [ ] **Step 4: Verify with read-only Graph calls.** Confirm the sender address, conversation ID, and count against the mailbox without sending or changing mail.

### Task 3: Channel Talk polling adapter

**Files:**

- Create: `functions-ingest/channeltalk.js`
- Modify: `functions-ingest/index.js`, `functions-ingest/store.js`
- Test: `tests/channeltalk-normalize.test.mjs`, `tests/channeltalk-pages.test.mjs`

**Interfaces:**

- Consumes: Secret Manager API keys, `GET /open/user-chats` followed by each chat's `.../messages`, and the documented `Channel-Version`
- Produces: `channeltalk` messages/threads, a durable poll cursor, and isolated `ingestState`

- [ ] **Step 1: Make a bounded authenticated read and save an anonymized payload fixture.** Confirm the actual chat/message IDs, timestamps, author identity, body, attachments, pagination, and update/deletion markers.
- [ ] **Step 2: Write normalization tests.** Assert deterministic IDs, inbound/outbound mapping, unknown-side default, conversation grouping, duplicate absorption, and cursor behavior across empty and multi-page results.
- [ ] **Step 3: Implement polling only.** Do not add a webhook: the current specification does not establish a verifiable signature header. Advance the cursor only after all returned messages are stored.
- [ ] **Step 4: Verify the read path and counts.** Compare one chat in Desk with the stored message count; never put API keys or visitor PII in logs.

### Task 4: Web-form message materialization

**Files:**

- Modify: `functions/index.js` (existing `contact`, `koreaLeads`, `orders`/sample flow triggers)
- Create or modify: a small server-only materializer module next to the trigger code
- Test: `functions/test/web-message-materialization.test.js`
- Rules: `firestore.rules` only if a new collection is introduced (not expected)

**Interfaces:**

- Consumes: create events from the existing form/order source documents
- Produces: one deterministic synthetic inbound message and thread per source submission, without changing the source document or firing a buyer email

- [ ] **Step 1: Approve the web shape.** Use `channel: "web"`, a namespaced `sourceAccount`, source-derived `externalId`/`providerThreadId`, submitted email/name as `from`/`fromName`, empty `to`, generated subject, and a bounded text projection in `bodyText`. Resolve the `sideSource` value before changing its enum.
- [ ] **Step 2: Write idempotency and privacy tests.** A retried trigger must not create a second message or thread; `isTest` submissions follow the source trigger policy; HTML/control characters are plain text; no cost or internal-only fields are projected.
- [ ] **Step 3: Implement the materializer with Admin SDK.** Use the same transactional save path and deterministic IDs as provider messages. Preserve the existing `mail` notification behavior and keep the original form document as the source of truth.
- [ ] **Step 4: Run emulator tests.** Assert client reads/writes remain denied for `messages`/`threads` and existing public form rules remain unchanged.

### Task 5: Server-side reply sending and conversation linkage

**Files:**

- Modify: `functions-ingest/google-auth.js`, `functions-ingest/gmail.js`
- Create: provider send helpers and an admin route under `src/app/api/admin/threads/[threadKey]/reply/route.ts`
- Modify: `src/lib/schemas/message.ts`, `src/lib/schemas/thread.ts` only for approved provider metadata
- Test: `tests/reply-mime.test.ts`, `tests/reply-auth.test.ts`, `tests/reply-linkage.test.ts`

**Interfaces:**

- Consumes: an authenticated admin, an existing linked thread, latest provider message metadata, and plain-text reply body
- Produces: a provider-sent outbound message stored with `direction: "out"`, the same `sourceAccount`, returned provider thread ID, and preserved human thread state

- [ ] **Step 1: Define the provider metadata needed for threading.** Store only the minimum approved values (provider message ID/thread ID and RFC `Message-ID`/`References` metadata if required by the provider). Never use a buyer-controlled address as the sender.
- [ ] **Step 2: Write route and MIME tests first.** Reject unauthenticated/non-admin requests, empty or oversized bodies, mismatched provider/account, and attempts to send from an unapproved mailbox. Assert `In-Reply-To`, `References`, `Subject`, and `From` are derived from the existing thread, not browser input.
- [ ] **Step 3: Implement send on the server.** Use Gmail `users.messages.send` with the delegated `gmail.send` scope and provider-native thread/conversation identifiers. Do not write to the `mail` collection, which would invoke the unrelated trigger-email extension.
- [ ] **Step 4: Persist the returned outbound message and update the thread transactionally.** If the provider response is unknown, do not blindly retry; the next poll must reconcile the sent provider ID and deterministic document ID. Keep `parseStatus` independent from read/triage/link state.
- [ ] **Step 5: Perform one approved canary per provider and inspect linkage.** Confirm exactly one outbound message, the expected conversation/thread, and no duplicate after the next poll. This is the only step that sends external email and therefore remains approval-gated.

### Task 6: Deal transition transaction and supplier replacement integrity

**Files:**

- Modify: `src/lib/schemas/deal.ts`, `src/lib/repo/deals.ts`
- Modify: `src/app/api/admin/deals/[id]/stage/route.ts`, `src/app/api/admin/deals/[id]/engagements/route.ts`
- Test: focused deal-stage, engagement, sample-round, and shipment transition tests under `tests/`

**Required approval before implementation:** The data contract below changes how supplier-specific history is identified. Confirm it before changing schemas or Firestore documents.

**Proposed data contract:**

```text
deals/{dealId}
  supplierIds[]                  # historical participants; dropping does not erase one
  supplierEngagements/{id}
    supplierId                   # immutable after creation
    contactStatus: ing|fix|drop

sampleRounds/{id}
  engagementId                   # proposed required reference to its supplier engagement

shipments/{id}
  engagementId                   # proposed required reference when route starts at supplier
```

**Interfaces:**

- Consumes: a current deal, engagement, sample round/shipment references, actor, and an explicit replacement reason.
- Produces: one Firestore transaction that rechecks every stage gate from transaction reads, drops the old engagement, creates a new engagement, retains both supplier IDs, and appends one auditable event.

- [ ] **Step 1: Approve the contract and automatic-sync semantics.** Decide whether `engagementId` must be added to supplier-originating sample rounds and shipments. Without it, two engagements for the same supplier cannot be distinguished safely; automatic shipping gates must remain conservative.
- [ ] **Step 2: Lock down mutation inputs.** General engagement patch must reject `supplierId` and `stageFactory`; those fields are created or transitioned only by dedicated server routes. Validate that supplied `engagementId` belongs to the deal.
- [ ] **Step 3: Move all transition reads into one transaction.** Read the deal, target engagement, relevant sample rounds, and shipments inside the transaction and rerun the same gate checks there. A stale pre-transaction read must not advance a stage.
- [ ] **Step 4: Replace, do not overwrite.** The supplier-change route atomically sets the old engagement to `drop`, creates a new stage-1 `ing` engagement with a new ID, unions the new supplier into `supplierIds`, and writes the reason, actor, time, and source references to a deal event. It never removes historical participants.
- [ ] **Step 5: Write only targeted tests.** Cover stale concurrent stage changes, replacing with the same supplier, an engagement from a different deal, old-supplier history preservation, and supplier-specific shipment/sample evidence. The tests must show that a supplier change cannot make an unrelated shipment satisfy the new engagement's gate.

## Focused verification matrix

| Area | Required evidence | Failure condition |
|---|---|---|
| Gmail six-mailbox run | six account results, page counts, `ingestState`, deterministic message totals | any account silently skipped, cursor advanced after failure, or techasset access assumed |
| Backfill | bounded lower bound, all pages consumed, rerun adds zero duplicates | default seven-day query mistaken for full history |
| Outlook | real anonymized Graph fixture, delta link after successful write | invented field mapping or lost delta after partial failure |
| Channel Talk | real anonymized Open API fixture and page/cursor proof | webhook without verifiable signature or visitor data in logs |
| Web forms | emulator idempotency/privacy/rules tests | source record changed, buyer email emitted, or duplicate thread |
| Replies | server auth, MIME headers, provider response reconciliation | browser token, wrong sender, duplicate send, or broken conversation |
| Deal transition | transaction-contained gate reads and immutable supplier replacement history | stale gate passes, supplier overwrite, or shipment evidence attributed to the wrong engagement |
| Security | `firestore.rules` tests and route coverage | client can read/write internal collections or finance data crosses DTO boundary |

## Safe local diagnostics recorded for this planning pass

- `node --test tests/gmail-normalize.test.mjs` — **9/9 passed** (normalization and Gmail page traversal fixtures).
- `node -e "require('./functions-ingest/gmail.js'); require('./functions-ingest/store.js')"` — **ingest modules load**.
- `git diff --check` — **no whitespace errors reported** for the pre-existing worktree changes.
- `functions-ingest/.env` exists; its contents were not printed. No interactive authentication, deployment, or external message send was performed.

## Completion gate

Plan 7 is complete only when the focused tests, full repository checks (`npm test`, `npm run typecheck`, `npm run lint`), approved read-only provider canaries, and the provider-specific send canaries all have recorded evidence. A passing local unit test is not evidence that delegation, Graph, Channel Talk, or deployed runtime credentials work.
