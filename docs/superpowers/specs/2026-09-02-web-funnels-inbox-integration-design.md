# 웹 유입 퍼널(주문·샘플·문의·랜딩) 통합 검토함 인테이크 및 동기화 설계

## 1. 개요 및 배경

### 1.1 현상 및 문제점
- 메디다코스 웹사이트에는 대시보드 맞춤 브리프(ODM 주문), 샘플 신청, 웹 일반 문의(Contact), 랜딩 상담 신청(Landing Requests) 등 다양한 고객 유입 채널이 존재한다.
- 현재 대시보드로 들어온 주문/샘플 요청은 검토함(`/admin/inbox?queue=unclassified`)에 원천 데이터로 뜨지 않고, 관리자 알림용으로 발송된 "Support 메일"을 통해서만 간접적으로 읽어오고 있다.
- 원인 분석:
  1. `functions/web-message-materializer.js`에서 웹 폼 투영 시 `messages`와 `threads`만 생성하고 `conversationIdentities` 문서를 생성하지 않으며 `thread.identityId`를 누락함.
  2. `orders` 및 `sampleRequests` 문서는 고객 이메일 필드 없이 `uid`만 저장하는 경우가 많아, `users/{uid}` 프로필 조회가 누락되면 임의 이메일(`web+<orderId>@medidakos.invalid`)로 떨어져 고객 단위 식별에 실패함.
  3. 시스템 알림 메일(`order_admin_...`, `contact_admin_...`)이 이메일 수집기에 의해 Support 계정의 대화로 유입되어 검토함에 노이즈를 발생시킴.

### 1.2 목표
1. **모든 웹 고객 유입 퍼널의 단일 인테이크 규격화**: `orders`, `sampleRequests`, `contact`, `landingRequests` 데이터를 실제 고객 이메일(`users/{uid}` 매핑)을 기반으로 `conversationIdentities`, `threads`, `messages`로 투영.
2. **검토함(`/admin/inbox?queue=unclassified`) 완전 통합**: 미분류 웹 유입 건이 이메일/채널톡과 동일한 UI에서 즉시 확인되고 바이어 생성 및 딜 연결이 가능하도록 지원.
3. **"웹 고객문의 동기화" 기능 제공**: 온디맨드 API 및 UI 버튼을 제공하여 기존에 누락되었거나 새로 발생한 웹 유입 건을 원클릭으로 동기화.
4. **Cloud Functions 및 내부 알림 정리**: `functions/web-message-materializer.js`의 투영 로직을 일치시키고, 시스템 자동 알림 메일로 인한 중복/노이즈를 방지.

---

## 2. 유입 퍼널 및 데이터 스키마 매핑

### 2.1 대상 퍼널 목록

| 퍼널 | 원천 컬렉션 | 주요 필드 | 고객 Identity 추출 방식 |
|---|---|---|---|
| **대시보드 ODM 주문** | `orders` (`type: "custom"`) | `uid`, `title`, `summary`, `briefSnapshot`, `shippingAddress` | `users/{order.uid}.email` (fallback: `order.customerEmail`) |
| **대시보드 샘플 신청** | `sampleRequests` & `orders` (`type: "sample"`) | `uid`, `sampleProductName`, `sampleQuantity`, `shippingAddress` | `users/{sample.uid}.email` |
| **웹사이트 일반 문의** | `contact` | `email`, `companyName`, `name`, `businessType`, `message`, `referralSource`, `utm*` | `contact.email` |
| **랜딩 상담 문의** | `landingRequests` (`landingVariant`: `korea` \| `catalog` \| `dashboard`) | `email`, `companyName`, `contactName`, `country`, `expectedVolume`, `message`, `catalogItems`, `dashboardBrief`, `utm*` | `landingRequests.email` |

---

## 3. 세부 아키텍처 및 투영 규칙

### 3.1 Identity 및 스레드/메시지 생성 규칙 (`materializeWebInbound`)

1. **고객 프로필 해석 (`resolveCustomerProfile`)**:
   - `uid`가 있는 경우 `users/{uid}` 문서에서 `email`, `displayName`, `companyName`, `phone`, `country`를 조회.
   - `contact`나 `landingRequests`처럼 폼에 직접 입력된 경우 폼 데이터 우선 적용.
   - 고객 이메일이 유효하지 않은 경우만 안전한 fallback 처리.

2. **`conversationIdentities` 생성/업데이트**:
   - 문서 ID: `email:<customer_email>` (소문자 정규화)
   - 만약 `buyers` 컬렉션에 해당 이메일이 이미 존재하면:
     - `classification: "buyer"`, `buyerId: buyer.id`, `conversationId: buyer.conversationId`
   - 내부 직원 이메일인 경우: `classification: "internal"`
   - 그 외 신규 고객: `classification: "unclassified"`
   - `displayName`, `displayEmail`, `createdAt`, `updatedAt` 필드 기록.

3. **`threads` 문서 생성**:
   - 문서 ID (`threadKey`): `web:<source>:<source>:<externalId>` (예: `web:orders:orders:fFBJcdpvhhImV9HYPmI2`)
   - 필드:
     - `channel: "web"`
     - `sourceAccount: "<source>"` (`orders` | `sampleRequests` | `contact` | `landingRequests`)
     - `providerThreadId: "<source>:<externalId>"`
     - `identityId: "email:<customer_email>"`
     - `classification: identity.classification`
     - `conversationId: identity.conversationId` (존재 시)
     - `readState: "unread"`, `triageState: "open"`, `linkState: "unlinked"`
     - `side: "brand"`, `sideSource: "account_rule"`, `sideHistory: []`
     - `lastMessageAt: source.createdAt`, `lastDirection: "in"`

4. **`messages` 문서 생성**:
   - 문서 ID: `web_<source>_<externalId>`
   - 필드:
     - `channel: "web"`, `sourceAccount: "<source>"`
     - `threadKey`, `providerThreadId`, `historyId: "<source>:<externalId>"`
     - `direction: "in"`
     - `from: customer_email`
     - `fromName: displayName || companyName || source_label`
     - `subject`: `[주문]`, `[샘플]`, `[문의]`, `[랜딩/<variant>]` 접두어와 회사/고객명 결합
     - `bodyText`: 원천 폼/브리프 데이터를 가독성 높은 구조화된 텍스트로 포맷팅
     - `sentAt: source.createdAt`, `parseStatus: "completed"`

### 3.2 중복 방지 및 멱등성 (Idempotency)
- `orders`에서 `type: "sample"`인 건은 `sampleRequests`와 1:1 대응되는 경우가 많음 (`referenceId`로 `sampleRequests.id`를 가짐).
- 동일한 샘플 요청에 대해 `sampleRequests`와 `orders` 양쪽에서 중복 스레드가 생성되지 않도록 `orders.type === "sample"` 건 중 `sampleRequests`에 원본이 있는 경우 병합 처리하거나 `sampleRequests`를 기준 스레드로 채택.

---

## 4. "웹 고객문의 동기화" 기능 및 UI/API

### 4.1 서버 리포지토리 모듈 (`src/lib/repo/web-inbound.ts`)
- `syncAllWebSubmissions(db)`:
  - `orders`, `sampleRequests`, `contact`, `landingRequests`를 병렬 조회.
  - 관련 `users` 문서를 일괄 조회하여 맵 구성.
  - 각 항목별로 `materializeWebInbound`를 트랜잭션/배치로 실행하여 `conversationIdentities`, `threads`, `messages` 생성/보정.
  - 처리 결과 요약(`{ ordersCount, samplesCount, contactCount, landingCount, createdThreads, updatedThreads }`) 반환.

### 4.2 어드민 API 엔드포인트 (`src/app/api/admin/inbox/sync-web/route.ts`)
- `POST /api/admin/inbox/sync-web`
- `withAdmin` 인증 가드로 보호.
- 실행 후 결과 JSON 반환 및 Next.js 캐시 갱신 (`revalidatePath("/admin/inbox")`).

### 4.3 어드민 UI 컴포넌트 (`InboxWorkspace.tsx` 및 `ReviewQueue.tsx`)
- 검토함 헤더 우측 또는 설정 영역에 **"웹 고객문의 동기화"** 버튼 배치 (아이콘: `RefreshCw` 또는 `Globe`).
- 클릭 시 로딩 스피너 및 성공 토스트/알림 표시 ("웹 고객문의 N건이 동기화되었습니다").

---

## 5. Cloud Functions 및 시스템 알림 메일 정돈

### 5.1 Cloud Functions (`functions/web-message-materializer.js`)
- Next.js의 `web-inbound` 투영 로직과 완전히 일치하도록 `functions/web-message-materializer.js`를 업데이트.
- 신규 주문/샘플/문의/랜딩 문서 생성 시 즉시 `users` 프로필을 조회하여 `conversationIdentities` 및 `identityId`를 포함한 스레드를 생성.

### 5.2 시스템 알림 메일 필터링 (`functions-ingest/filter.js` & `store.js`)
- `order_admin_...`, `contact_admin_...`, `signup_admin_...`, `landing_request_admin_...` 등의 메일은 발신/수신자가 모두 내부 관리자/시스템(`support@medidakos.com`)임.
- 이메일 수집기에서 제목에 `[신규 주문]`, `[문의]`, `[랜딩]`, `[육성 트랙]`, `신규 회원가입:`이 포함되고 내부에서 발송된 알림 메일은 `classification: "internal"`로 자동 분류하여 검토함(미분류 큐)을 어지럽히지 않도록 처리.

---

## 6. 검증 계획 (Verification Plan)

### 6.1 자동화 테스트 및 타입 검사
- `npm run typecheck`
- `npm run lint`
- `npm test` (기존 단위 테스트 및 스키마 검증)

### 6.2 데이터 정합성 검증 (실측 검증)
- 동기화 스크립트/API 실행 후 실제 Firestore 상태 확인:
  1. `conversationIdentities`에 실존 바이어(`loidygarcia@hotmail.com`, `chhavi.kumar19@gmail.com`, `jadeshanthidavis@gmail.com` 등)가 정상 등록되는지 확인.
  2. `threads` 문서들에 `identityId`가 유효한 이메일로 연결되고 `classification`이 `unclassified` 또는 `buyer`로 설정되는지 확인.
  3. `web+...` 임의 이메일로 잘못 생성되었던 레거시 스레드가 정리/교정되는지 확인.

### 6.3 UI 수동 검증
- 브라우저로 `/admin/inbox?queue=unclassified` 접속.
- "웹 고객문의 동기화" 버튼 동작 확인.
- 검토함 목록에 웹 주문/샘플/문의 항목이 카드 형태로 뜨고, 클릭 시 상세 브리프 내용이 정상 렌더링되는지 확인.
- 바이어 지정 및 딜 생성 모달 연계 동작 확인.
