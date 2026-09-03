# Medidakos 백오피스 1차 출시(v1) 구현 스펙

> **문서 개정:** 2026-08-26 승인 반영본 (이전 개정 v2: 2026-08-26, 최초안: 2026-08-25)
> **제품 범위:** 백오피스 1차 출시(v1)
> **입력:** `PRD/backoffice_prd_schema_specification.md` (화이트보드 스키마), 이전 개정본, 라이브 상태 조사, 사내 위키의 실제 거래 사례
> **적용 대상:** `medi-da-kos` 저장소의 `/admin`
> **승인된 변경:** 다제품·다공급자, HQ 경유 샘플, 작업 분리, 스레드 상태, 수집 안전성, 인테이크 판정, 원자적 단계 전환, 재무 분리

---

## 1. 이 문서가 정하는 것

일곱 개 메일함과 채널톡, 웹 폼에 흩어진 대화를 한 화면에 모으고, 바이어↔공장 양면 딜을 한 원장에서 굴린다.

최초안은 "인수인계가 먼저"라고 썼다. 그 우선순위는 내려갔다. 자격증명 이관은 여전히 **첫 작업**이지만 이유가 바뀌었다 — 후임을 위해서가 아니라, **서버가 개인 노트북 없이 돌아야 수집기가 존재할 수 있기 때문**이다.

---

## 2. 착수 전 반드시 알아야 할 것

### 2.1 `orders`는 이미 쓰이고 있다

현행 `orders/{autoId}`는 고객이 직접 제출한 주문이고 `onOrderCreated`가 걸려 있다. 문서가 생기면 즉시 메일이 나간다.

**내부 원장에 같은 이름을 쓰면 딜을 만들 때마다 고객에게 주문 접수 메일이 발송된다.** 내부 원장은 `deals`로 부른다.

### 2.2 현행 컬렉션 — 건드리지 않는다

| 컬렉션 | 실측 | 용도 | 트리거 |
|---|---|---|---|
| `users/{uid}` | 40건, `role` 전부 `"user"` | 회원 프로필 | `onUserSignup` |
| `cmBriefs/{uid}` | 26건, **전부 `draft`** | 6단계 브리프 초안 | 없음 |
| `orders/{autoId}` | 9건, **전부 `submitted`** | 고객 제출 주문 | `onOrderCreated` |
| `sampleRequests/{autoId}` | 3건 | 샘플 배송 상세 | 없음 |
| `contact` / `koreaLeads` | 5건 / 3건 | 문의 폼 | 각각 트리거 있음 |
| `mail/{결정적ID}` | 감사 로그 | 발신 큐 | Gmail API (`support@`); Trigger Email 끔 |
| `tracking/{uid}/entries` | **컬렉션 없음** | 죽은 기능 | 없음 |

예외 하나만 손댄다 — 2.4.

### 2.3 이미 있는 좋은 관행 두 개는 따른다

- **결정적 문서 ID로 중복 방지** — `mail`이 `signup_member_{uid}` 같은 ID로 중복 발송을 막는다. 수집기의 `messages`도 같은 방식을 쓴다
- **알림 발신은 Functions** — `queueEmail()`이 Gmail API로 `support@`에서 보낸다. Trigger Email 확장에 `mail` 문서를 맡기지 않는다. 인박스 회신은 별도 Gmail send 경로다.

### 2.4 `role` 필드 — 착수 시 막는다

`saveUserProfile()`이 `users/{uid}`를 `setDoc` 전체 덮어쓰기로 저장하고, 규칙이 필드를 제한하지 않는다. 브라우저 콘솔에서 자기 `role`을 `admin`으로 쓸 수 있다.

지금은 취약점이 아니다 — **`role`을 읽는 코드가 없다.** 그래서 함정이다. 나중에 누군가 그 값을 믿는 한 줄을 쓰면 40명 전원이 관리자가 된다.

```
match /users/{uid} {
  allow read:   if isOwner(uid);
  allow create: if isOwner(uid) && request.resource.data.keys().hasOnly([
    'uid', 'email', 'displayName', 'phone', 'country', 'companyName',
    'provider', 'createdAt', 'isTest'
  ]);
  allow update: if isOwner(uid)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'displayName', 'phone', 'country', 'companyName', 'provider', 'isTest'
    ]);
  allow delete: if false;
}
```

`saveUserProfile()`은 안전 필드만 `{ merge: true }`로 쓰고 `role`·`permissions`를 요청에 넣지 않는다. 기존 `role: "user"` 문서는 보존되지만 앱의 인가 근거로 사용하지 않는다. `deleteDoc`은 코드 어디에도 없다. 별도 커밋 + 에뮬레이터 테스트로 경계를 고정한다.

### 2.5 소스와 배포가 어긋나 있다

`lifecycleScan`이 소스에 있고 배포에는 없다. **의도된 상태이므로 그대로 둔다.** 전체 배포하면 딸려 올라가므로 수집 함수는 별도 코드베이스로 분리한다(8장).

`/admin`은 아직 라이브가 아니다 — `origin/main`·`origin/dev` 어디에도 없는 로컬 미커밋 작업이고 `medidakos.com/admin`은 404다. **인가 게이트 없이 `main`에 올리는 순간 공개된다.**

---

## 3. 자격증명 — 코드보다 먼저

바이어 소통과 공장 소통이 도메인으로 갈린다. 셋 다 회사 계정이라 관리·인증이 가능하다.

| 도메인 | 메일함 | 쓰임 | 인증 |
|---|---|---|---|
| `medidakoslabs.com` (Google Workspace) | `thomas@`, `hally@` | 바이어 | 도메인 전체 위임 |
| `techasset.co.kr` (Google Workspace) | `rheekw`, `songjh`, `kimhs`, `parkjy` | 국내 공장 | 도메인 전체 위임 |
| `medidakos.com` (Google Workspace) | `support@` | 바이어 알림 발신 | 도메인 전체 위임 (`gmail.send`) |

**서비스 계정은 하나.** 도메인 전체 위임은 관리콘솔에서 클라이언트 ID를 등록하는 방식이라, 같은 서비스 계정을 Workspace마다 각각 등록하면 된다. 프로젝트가 그 조직에 속할 필요가 없다.

`techasset.co.kr`는 GCP 프로젝트가 그 조직 소유(org `243848759364`)라 OAuth Internal도 가능하지만 쓰지 않는다. 두 도메인에 서로 다른 방식을 쓰면 코드가 두 갈래가 된다.

`support@medidakos.com`은 Outlook/M365에서 Gmail로 옮겼다. 알림 발송은 Azure Graph가 아니라 `mail-ingest`의 `gmail.send` 위임이다. 이 메일함 수집(인박스 폴링)은 아직 켜지 않는다.

관리자 작업 3건이 크리티컬 패스다. 첫날 요청을 넣는다.

비밀값은 Secret Manager. 기존 Functions 서비스 계정은 `778843049415-compute@developer.gserviceaccount.com`.

---

## 4. 데이터 모델

PRD 필드는 살리고 다음을 바꾼다.

| # | PRD | 이 문서 | 이유 |
|---|---|---|---|
| 1 | `Members` PK = `email` | `buyers/{autoId}` + `emails[]` | 대소문자, 주소 변경 시 FK 파손, **한 사람이 여러 주소를 쓰는 상황이 이미 발생 중** |
| 2 | 메시지 테이블 없음 | `messages` 신설 | 채널 통합이 목적인데 담을 곳이 없다 |
| 3 | 공장 8단계 | **9단계** | 4번이 「샘플 수정」이고 끝에 「배송」이 붙는다 |
| 4 | 단일 `tracking_number` | `sampleRounds` + `shipments` | 샘플은 여러 회차·여러 구간을 거치고 본품 발송은 별건이다 |
| 5 | `escrow_status` 필수 | 선택 + 수기 | 본주문 0건, API 승인 미확보 |
| 6 | 단일 제품·단일 공장 | `items` + `supplierEngagements` | 제품 옵션과 제형·용기·충진 공급자가 거래마다 달라진다 |
| 7 | 제출 즉시 주문으로 집계 | 원천 문서 + `intakeReviews` | 미완성·테스트·메일 기반 진행을 사람이 판정해야 한다 |

### 4.1 컬렉션

```
buyers/{autoId}
  name, emails[], inflowChannel, brandName, country, phone
  firebaseUid?                     기존 users/{uid} 참조 (복제 아님)
  lastContactAt

suppliers/{autoId}
  companyName
  contacts[]                       name, title, email, phone, channel
  capabilities[]                   formulation, packaging, filling, testing, logistics
  productionModels[]               OEM, ODM, private_label, tech_transfer
  supportedCerts[]

deals/{autoId}
  reference                        기존 orders.referenceId 규칙
  buyerId, sourceRefs[]             order·brief·message·attachment 원문 참조
  buyerInfo{} certifications{} timeline{} shippingInfo{} additionalRequests
  payment{ samplePayment{}, mainPayment{} }
  stageBrand: 1..8                 딜에 하나
  ownerIds[]
  supplierIds[]                    역방향 조회용 비정규화; 트랜잭션으로만 갱신

  ├ items/{autoId}
  │    productType, variantName, volume, quantity
  │    formulaSpec{}, packagingSpec{}
  │
  ├ supplierEngagements/{autoId}
  │    supplierId, roles[], supplyMode
  │    contactStatus: 'ing'|'fix'|'drop'
  │    stageFactory: 1..9, contactPersonSnapshot{}, notes
  │    ipTerms{}                    소유권·독점권·기술이전은 거래별 조건
  │
  ├ private/finance                어드민 서버만 조인 (4.3)
  │    supplierQuotes[]             itemId·engagementId·수량 구간·버전
  │    buyerQuote{}, internalCosts[], fxSnapshot{}, grossProfit, margin
  │
  ├ sampleRounds/{autoId}
  │    itemId, supplierId, roundNo, requestNotes
  │    producedQty, retainedQty, receivedAt
  │    qcStatus: 'pending'|'passed'|'failed'|'waived', qcNotes, qcWaiverReason?
  │    feedbackAt, verdict: 'approved'|'revision'|'dropped', feedbackNotes
  │
  ├ shipments/{autoId}
  │    kind: 'sample'|'main'
  │    route: 'supplier_to_hq'|'hq_to_buyer'|'supplier_to_buyer'
  │    sampleRoundId?, trackingNumber, carrier, status, shippedAt, deliveredAt
  │    addressSnapshot{}, customsSnapshot{}
  │
  ├ tasks/{autoId}
  │    type, summary, ownerId, waitingOn: 'us'|'buyer'|'supplier'|'carrier'
  │    dueAt, status: 'open'|'done'|'canceled', sourceMessageId?

  └ events/{autoId}                메모·단계변경·무시 기록
       type: 'note'|'stage'|'override'
       actor, at, body, from, to, reason, sourceRefs[]

intakeReviews/{base64url(source + NUL + externalId)}
  source: 'order'|'sampleRequest'|'contact'|'koreaLead'|'message'
  externalId, sourceRef
  status: 'raw'|'qualified'|'rejected'
  reason, reviewedBy, reviewedAt, dealId?
  isTest, isTestReason

messages/{channel}:{externalId}
  channel: 'gmail_thomas'|'gmail_hally'|'gmail_rheekw'|'gmail_songjh'
         |'gmail_kimhs'|'gmail_parkjy'|'outlook_support'|'channeltalk'|'web'
  side: 'brand'|'factory'|'unknown'
  sideSource: 'account_rule'|'address_match'|'manual'
  externalId, providerThreadId, threadKey, sourceAccount
  direction: 'in'|'out'
  from, to[], subject, bodyText, sentAt, attachments[]
  extraction{}, confidence{}, accepted{}
  parseStatus: 'pending'|'processing'|'completed'|'failed'|'skipped'

threads/{threadKey}
  channel, sourceAccount, providerThreadId
  readState: 'unread'|'read'
  triageState: 'open'|'archived'|'ignored'
  linkState: 'unlinked'|'linked'
  side: 'brand'|'factory'|'unknown', sideSource
  buyerId?, supplierId?, dealId?
  lastMessageAt, lastDirection
  sideHistory[]                    from, to, reason, actor, at
```

**문서 ID를 `{channel}:{externalId}`로 고정하는 것이 수집기의 핵심이다.** 폴링을 재실행해도 덮어쓰기만 되고 중복 생성이 되지 않는다.

`threadKey`는 `{channel}:{sourceAccount}:{providerThreadId}`다. 제공자나 계정이 다른 같은 문자열을 한 스레드로 합치지 않는다. `messages`는 제공자 원문과 파싱 상태, `threads`는 읽음·보관·연결처럼 사람이 바꾸는 상태를 맡는다.

### 4.2 메일함은 양면 판정의 기본값이지 진실 원천은 아니다

수집기는 어느 메일함으로 들어왔는지로 `side`의 기본값을 정한다. 다만 전달 메일·알림·채널톡 변환·혼용 계정이 있으므로 단정하지 않는다. 주소 매칭이 반대 근거를 주거나 판정할 수 없으면 `unknown`으로 두고 사람이 고칠 수 있게 한다. LLM은 이 판정에 쓰지 않는다.

```
side='brand'    발신자를 buyers.emails[]에서 조회 → 딜에 연결, stageBrand 근거
side='factory'  발신자를 suppliers.contacts[].email에서 조회 → supplierEngagements에 연결, stageFactory 근거
side='unknown'  양쪽 후보를 보여주되 자동 연결하지 않음
```

수동 정정은 `sideSource='manual'`로 바꾸고 `sideHistory[]`에 이전 값·새 값·사유·actor·시각을 append한다. 제조사 화면의 "이 공장과 주고받은 메일"은 `threads.supplierId`에서 따라온다.

### 4.3 원가·마진은 `private/finance`로 분리한다

어드민은 모든 접근이 서버를 지나지만, 접근 제어와 응답 투영은 다른 문제다. 원가·공급가·환율·마진을 `deals/{id}/private/finance`에 분리해 일반 딜 조회가 실수로 재무 필드를 직렬화하지 못하게 한다.

어드민 상세 저장소만 명시적으로 finance 문서를 조인한다. 바이어용 서비스와 DTO는 이 경로를 import하거나 읽지 않는다. 금액은 `{ amount, currency }`, 환율은 `{ rate, base, quote, asOf, source }`로 저장하며 브라우저가 고정 환율로 마진을 계산하지 않는다.

### 4.4 이원화 파이프라인

| 브랜드 (`stageBrand`) | 공장 (`stageFactory`) |
|---|---|
| 1 접수 | 1 견적 문의 |
| 2 가견적 발송 | 2 견적 회신 |
| 3 샘플 발주 | 3 샘플 요청 |
| 4 샘플 발송 | 4 샘플 수정 |
| 5 피드백 | 5 계약 |
| 6 계약 | 6 결제완료 |
| 7 결제/발주 | 7 생산 |
| 8 배송 | 8 완료 |
| | 9 배송 |

**디펜던시 — 막지 않고 물어본다.**

| 선결조건 | 이후 상태 |
|---|---|
| 브랜드1 접수 | 공장1 견적 문의 |
| 공장2 견적 회신 | 브랜드3 샘플 발주 |
| 브랜드3 샘플 발주 | 공장3 샘플 요청 |
| 브랜드5 피드백 | 공장4 샘플 수정 |
| 브랜드7 결제/발주 | 공장5 계약 |

공장 쪽 선결조건은 **제조사 중 하나라도** 도달했으면 충족으로 본다. 전 공장 회신을 기다리는 건 현실과 안 맞는다.

넘길 때 모달을 띄우고 「그래도 진행」이면 통과시킨다. **누가 언제 무엇을 무시했는지가 `events`에 남는다.** 화면에서는 위반 항목의 글씨 색을 바꾼다 — 저장하지 않고 매번 계산한다(30건 규모에서 비용 없음, 저장하면 한쪽만 바뀌었을 때 색이 거짓말을 한다).

**차단 게이트 — 이 셋만 실제로 막는다.**

| 전환 | 검사 |
|---|---|
| 브랜드4 샘플 발송 | 해당 제품의 최신 활성 `sampleRound` + 아래 샘플 경로 조건 + 브라질이면 `shippingInfo.taxId` |
| 브랜드8 배송 | `kind='main'`인 shipment의 `trackingNumber` |
| 공장7 생산 | `payment.mainPayment.escrowStatus == 'funded'` |

디펜던시는 순서가 현실에서 자주 뒤집히는 일이고, 이 셋은 뒤집히면 돈이나 물건이 실제로 사라지는 일이다. 브라질 세금번호는 저장 시점에는 경고만 하고 발송 게이트에서 막는다 — 경고에 기한을 붙이되 바이어 회신을 기다리는 동안 딜이 멈추지 않게 한다.

**샘플은 HQ 경유가 기본이다.** `supplier_to_hq` 입고 뒤 `qcStatus='passed'`이고 `hq_to_buyer` 송장이 있어야 발송 단계로 간다. 예외적으로 공장 직송이면 `qcStatus='waived'`, `qcWaiverReason`, `supplier_to_buyer` 송장을 모두 요구한다. 샘플 3개 중 2개를 바이어에게 보내고 1개를 내부 보관하는 경우는 `producedQty`와 `retainedQty`로 남긴다.

**단계는 되돌아갈 수 있다.** 샘플 루프(발송 → 피드백 → 수정 → 발송)는 정상이다. 화면에 회차를 같이 띄운다(`샘플 발송 (3차)`). 회차는 배열 길이가 아니라 제품별 `roundNo`로 계산하고, 한 제품에서 4차 이상이면 색을 바꾼다.

**본품 경로는 아직 고정하지 않는다.** 실제 발주 사례가 없으므로 shipment 생성 시 세 경로 중 하나를 운영자가 선택한다. `공장9 → 브랜드8` 자동 동기화는 동일한 `kind='main'` shipment가 `supplier_to_buyer`일 때만 같은 트랜잭션에서 수행한다. HQ 경유이면 공장 출고와 바이어 발송이 다른 구간이므로 각각 전환한다.

단계와 다음 행동은 분리한다. `stageBrand`·`stageFactory`는 업무 위치이고, 담당자·회신 대기·기한은 `tasks`에 둔다. 보드 카드는 단계와 함께 다음 열린 작업, `waitingOn`, 담당자, 기한, 마지막 활동 시각을 보여준다.

각 명령의 파생값과 감사 기록은 같은 Firestore transaction에서 수행한다. engagement 생성·변경은 `supplierIds` 비정규화와 함께 저장하고, 단계 갱신은 shipment 연계·event 기록과 함께 저장한다. `override=true`이면 사유가 필수이고 중간 실패 시 어느 변경도 남지 않는다.

---

## 5. 인가

**어드민은 Firebase 클라이언트 SDK를 쓰지 않는다.** 모든 읽기·쓰기가 Next.js route handler에서 `firebase-admin`으로 나간다.

### 5.1 신원

커스텀 클레임을 쓰지 않는다. 클레임은 토큰에 박히는 값이라 **회수가 즉시 반영되지 않는다.** 요청마다 허용목록을 확인하면 그 문제가 없어지고, 부여 스크립트도 부트스트랩 문제도 사라진다.

```
세션 쿠키 검증 → { email, email_verified, sign_in_provider }
→ email_verified === true
→ sign_in_provider ∈ { 'google.com', 'microsoft.com' }
→ ADMIN_EMAILS 포함 여부
```

`email_verified`와 제공자를 같이 보는 이유: 미가입 팀 주소를 제3자가 비밀번호 계정으로 선점하는 경로를 닫는다.

```
1차 배포   rheekw, songjh, kimhs, parkjy @techasset.co.kr   (google, 이미 가입됨)
Azure 후   + support@medidakos.com                          (microsoft, 백업용)
```

`support@`는 공용계정이라 `events.actor`에 사람이 안 남는다. 백업 경로로만 쓰고, 화면에서 그 계정의 기록은 색을 달리 표시한다. 넣는 이유는 **제공자 이중화** — 구글 쪽 장애 시 네 명이 동시에 잠긴다.

### 5.2 세션과 라우트

```
1. /admin/login 구글 로그인                → ID 토큰
2. POST /api/admin/session                 → 검증 + 허용목록 → 세션 쿠키
                                              (httpOnly, secure, sameSite=strict, 5일)
3. middleware /admin/*                     → 쿠키 없으면 리디렉트   ※ 편의일 뿐
4. route handler /api/admin/*              → verifySessionCookie + 허용목록  ※ 실제 방어선
```

미들웨어는 Edge 런타임이라 `firebase-admin`을 못 쓴다. 토큰을 제대로 검증할 수 없으므로 **리디렉트 외의 판단을 맡기지 않는다.**

**핸들러는 래퍼를 통해서만 내보낸다.**

```ts
export const GET = withAdmin(async (req, actor) => { ... })
```

`withAdmin`을 안 거치면 핸들러가 존재하지 않는다. 잊어버릴 수가 없는 구조다. `actor`는 `events.actor`로 그대로 들어간다.

`ADMIN_EMAILS`가 비어 있으면 **500을 던진다.** 빈 목록을 "전원 허용"으로 읽으면 안 된다. Vercel 프리뷰 URL이 공개라 이게 실제로 중요하다.

`app/api/admin/` 아래 모든 파일이 `withAdmin`으로만 내보내는지 확인하는 테스트를 붙인다.

### 5.3 규칙

```
match /buyers/{id}    { allow read, write: if false; }
match /suppliers/{id} { allow read, write: if false; }
match /deals/{id}     { allow read, write: if false; }
match /messages/{id}  { allow read, write: if false; }
match /threads/{id}   { allow read, write: if false; }
match /intakeReviews/{id} { allow read, write: if false; }
```

`deals/{id}/{sub=**}`도 명시적으로 차단해 `items`·`supplierEngagements`·`private`·`sampleRounds`·`shipments`·`tasks`·`events`까지 덮는다. Admin SDK는 규칙을 우회하므로 서버는 동작하고 브라우저는 어느 쪽에서도 못 닿는다. **컬렉션을 만드는 커밋에 규칙과 에뮬레이터 테스트가 같이 들어간다.** 규칙은 눈으로 읽어서 맞는지 알 수 없는 종류의 코드다.

---

## 6. 수집과 파싱

### 6.1 순서

```
1단계  수집만 — messages에 넣고 화면에 띄운다. 파싱 없음
2단계  파서 — 구조화 제안을 만든다
3단계  평가 — 정확도를 잰다
```

1단계만으로 **아홉 개 채널이 한 화면에 모인다.** 지금 없는 건 그것부터다. 그리고 실제 메일이 어떻게 생겼는지 보고 나야 프롬프트를 제대로 쓴다.

### 6.2 수집

**5분 주기 폴링 하나가 세 소스를 전부 처리한다.**

| 소스 | 방식 |
|---|---|
| Gmail 6개함 | `after:` 중첩 조회 + 전 페이지 순회 + 결정적 ID 중복 흡수 |
| `support@` (Gmail) | 알림 발신은 Gmail API. 인박스 수집은 아직 비활성 (구 Graph/Outlook 경로 폐기) |
| 채널톡 | `GET /open/user-chats` → `.../messages`. `x-access-key` + `x-access-secret` + `Channel-Version` |
| 웹 폼 | 가져올 게 없다. `contact`·`koreaLeads`·`orders` 트리거에서 `messages` 문서를 하나 더 만든다 |

2026-08-25 사내 기획의 "채널톡은 이메일 유도로 대체" 결정은 Open API 확인 전의 판단이다. 이 문서는 API 폴링을 1차 출시 범위로 확정하며 이전 결정을 대체한다.

채널톡 웹훅은 쓰지 않는다. 문서에 `token`이 *"페이로드 검증용 HMAC 토큰"* 이라고만 있고 **어느 헤더에 어떤 알고리즘으로 실리는지 스펙이 없다.** 검증 못 하는 공개 엔드포인트는 URL만 알면 아무나 가짜 대화를 밀어넣는다. 폴링이면 그 문제가 없고, **백필과 같은 코드가 된다** — 과거 대화 가져오기는 하한선 없는 폴링일 뿐이다.

메시지 원문을 그대로 저장한다. 토큰이 깨져도 지난 대화를 읽을 수 있고, **프롬프트를 고칠 때 메일함을 다시 긁지 않고 저장된 본문에 대고 재파싱**할 수 있다. 3단계가 여기 통째로 기댄다.

수집기는 제공자 페이지를 끝까지 저장한 뒤에만 cursor를 전진시킨다. 재수집 때 사람이 바꾸는 `threads` 상태는 건드리지 않는다. 계정별 `ingestState`에 `lastSuccessAt`·`lastError`·`processedCount`를 남겨 **정상 0건**과 **수집 실패**를 구분한다. 한 계정 실패는 다른 계정을 막지 않는다.

`needsReply`: 스레드의 마지막 메시지가 `direction: 'in'`이면 참.

### 6.3 파서

아래 겹은 LLM을 쓰지 않는다 — 중복 제거, 스레드 묶기, 발신자 추출, `side` 기본 판정, 필터링.

거르는 대상: 내부 발신(전달 제외), `noreply@`·`mailer-daemon`·뉴스레터, 이미 딜에 연결된 스레드.

위 겹만 모델을 부른다. 출력은 **딜이 아니라 제안**이고 `messages.extraction`에 들어가 거기서 멈춘다. 검증은 Zod — LLM 출력은 신뢰 경계 바깥이고, 스키마 하나에서 `z.infer`로 타입이 나와 둘이 어긋날 수 없다.

**추가하는 의존성은 Zod 하나다.** Inngest는 쓰지 않는다 — 스케줄링은 Cloud Scheduler가, 재시도는 Cloud Functions가 맡고 파서 진행은 `messages.parseStatus`가 맡는다. `pending → processing → completed|failed|skipped`로 남겨 중간 실패를 재개한다. 읽음·보관·연결 상태와 파서 상태를 섞지 않는다.

모델 호출은 `callModel()` 한 곳으로 감싼다. AWS 크레딧을 쓰기로 했으므로 Bedrock을 붙이되, **리전과 모델은 AWS 계정을 만든 뒤 확정한다.** 서울 리전 가용 여부에 따라 메일 본문이 리전을 건너갈 수 있다.

### 6.4 확인과 평가

```
파서 제안 → 사람이 검토·수정 → 확정 → messages.accepted
                                        ↑ 이게 정답이다
```

**확신도가 높아도 자동으로 딜을 만들지 않는다.** 잘못 만들어진 딜을 찾아 지우는 비용이 클릭 한 번보다 크다. 확신도는 자동화 기준이 아니라 **무엇을 먼저 볼지 정하는 순서**다.

별도 픽스처 파일도 익명화도 없다. 검토 화면이 일하는 동안 (입력, 정답) 쌍을 저절로 쌓는다.

```
npm run eval    accepted가 있는 메시지 전부로 필드별 정확도. 프롬프트 고칠 때
npm test        손으로 쓴 가짜 메일 2~3건. 매핑·검증이 안 깨졌는지. 매번
```

> **코퍼스 편향:** 기존 665통은 `mailmap`이 ADC(rheekw)로 돌아 공장 쪽이 과소 대표돼 있다. `songjh`·`kimhs`·`parkjy`는 한 통도 없다. 일곱 함을 다 연동하면 공장 물량이 크게 는다. 견적서·단가표는 문체가 완전히 달라서 초기 정확도 숫자를 그대로 믿으면 안 된다.

---

## 7. 화면 (`/admin`)

1. **통합 받은편지함** — 1차 출시의 주 화면. 노션 inbox 형태. 왼쪽 목록 + 오른쪽 상세, 처리해도 사라지지 않고 필터로 남는다. `threads.readState`·`triageState`·`linkState`와 `needsReply`·`side`·채널 필터
2. **딜 보드** — 브랜드 단계가 가로축인 카드. 카드 안에 공장 단계, 다음 열린 작업, `waitingOn`, 담당자, 기한을 띄운다. 공장 단계는 **확정(fix) 제조사가 있으면 그 값, 없으면 진행중 중 가장 앞선 값**
3. **딜 상세** — PRD ①~⑨을 `items`·`supplierEngagements`에 맞춰 표시하고, 샘플 QC·구간별 배송·작업·스레드·`events` 타임라인을 함께 보여준다
4. **제조사** — 역량·공급 방식 필터, 제조사별 진행중·확정·기각 딜과 해당 공장 메일
5. **인테이크 검토** — 기존 `orders`·샘플 요청·웹 폼·메일 신호를 `raw|qualified|rejected`로 판정. 딜과 KPI는 `qualified`만 사용
6. **설정 → 메일 제공자** — 계정별 연결 상태·마지막 성공·오류 사유·처리 건수·**재연결/진단 버튼**. 이게 없으면 토큰이 깨졌을 때 결국 개인 노트북으로 돌아간다

첨부는 라우트로 프록시한다(`GET /api/admin/messages/{id}/attachments/{attId}` → `withAdmin` → provider에서 스트림). Cloud Storage에 복사하지 않는다 — 메일함에 이미 있는 걸 한 벌 더 두면 용량과 정합성 문제만 생긴다. 목록에는 📎 배지.

편의: 즉시 메모(타임스탬프 자동), 배송 정보 입력 시 바이어 기본값 프리필. 금액·송장·기한을 원장에 확정할 때 원문 메시지나 첨부의 `sourceRef`를 함께 저장하고 상세 화면에서 원문으로 돌아갈 수 있게 한다.

---

## 8. 개발 환경과 배포

```
앱(마케팅+대시보드+어드민)  →  Vercel (icn1). main 푸시하면 자동
Cloud Functions             →  firebase deploy --only functions:ingest
Firestore 규칙              →  firebase deploy --only firestore:rules
```

**수집 함수는 별도 코드베이스에 넣는다.**

```json
"functions": [
  { "source": "functions",        "codebase": "default" },
  { "source": "functions-ingest", "codebase": "ingest"  }
]
```

`--only functions:ingest`가 기존 코드베이스를 건드릴 수 없게 된다. `lifecycleScan`이 딸려 올라가지 않는 걸 기억이 아니라 배치로 보장한다.

**시크릿은 자연스럽게 갈린다.** Vercel 환경변수에 `ADMIN_EMAILS`·firebase-admin 서비스계정·세션 쿠키 시크릿(route handler가 Vercel에서 도니까), Firebase Secret Manager에 메일 토큰·Azure 앱·채널톡 키·모델 키(수집 함수가 Firebase에서 도니까). 겹치는 게 없다.

**린터는 ESLint를 유지한다.** `eslint-config-next`의 Next 전용 규칙을 버릴 이유가 없다. `"typecheck": "tsc --noEmit"` 스크립트를 추가한다.

**저장소 배치** — `medi-da-kos`는 `Medidakos backoffice/` 안에 있고 바깥 리포에서 gitignore된다. 바깥의 `AGENTS.md`·`CLAUDE.md`가 상위 디렉터리 상속으로 자동 적용된다.

**훅** (`.claude/hooks/`): 배포·강제푸시·하드리셋 차단, 편집한 파일 타입체크, 원가 유출 검사. 원가 검사는 **화이트리스트**다 — 재무 스키마·어드민 서버 저장소·어드민 화면의 명시된 경로 밖에서 `unitCost`·`supplierCost`·`margin` 등이 나타나면 차단한다. `moq`·`leadTime`은 거래 조건이라 일반 `supplierEngagements`에 허용하되 원가와 같은 객체에 넣지 않는다.

화면 점검은 `aside repl`.

---

## 9. 작업 순서

| 순서 | 내용 | 선행 |
|---|---|---|
| 1 | Workspace 2곳 + Microsoft 365 관리자 승인 요청 | — |
| 2 | 보안 규칙 정비 (`role` 쓰기 차단) + 에뮬레이터 테스트 | — |
| 3 | **인가 게이트** — `withAdmin`·미들웨어·세션·허용목록. 화면 기능 0개 | 2 |
| 4 | `buyers`·`suppliers`·`intakeReviews` 컬렉션 + 규칙 + 수기 입력 화면 | 3 |
| 5 | 수집기 — `thomas@` **한 계정만** 먼저 관통 | 1, 3 |
| 6 | `messages` 원문 + `threads` 상태 + 통합 받은편지함 + 설정 화면 | 5 |
| 7 | 나머지 여섯 함 + 채널톡 + 웹 폼 | 5 |
| 8 | `deals` + `items` + `supplierEngagements` + 이원화 파이프라인 + `tasks`·`events` | 4 |
| 9 | `sampleRounds` + 구간별 `shipments` + `private/finance` + 인테이크 판정 | 8 |
| 10 | 파서 + `accepted` + eval | 7, 8 |

**3번이 머지되기 전에는 어드민 라우트를 `main`에 올리지 않는다.**

5번을 한 계정으로 먼저 관통시킨다. 도메인 전체 위임이 실제로 되는지가 여기서 판가름 나고, 안 되면 3장 설계가 바뀐다.

---

## 10. v1에서 명시적으로 뺀 것

| 항목 | 이유 |
|---|---|
| 첨부파일 파싱 | 스프레드시트 처방 구조화는 본문 파싱과 다른 문제다. 저장·다운로드만 |
| Escrow.com 연동 | 본주문 0건, API 승인 미확보. 필드만 두고 수기 |
| 국내 PG·PayPal·Stripe | 위와 같음 |
| 배송 추적 자동 조회 | `trackingNumber`·`carrier` 필드는 두되 조회는 나중. DHL·FedEx·UPS는 공식 API가 있고 EMS·CJ는 사정이 다르다. **어느 배송사를 실제로 쓰는지 확인이 먼저** |
| 백오피스에서 메일 발송 | `mail` 컬렉션 경로가 이미 있으니 붙이는 건 쉽다. v1은 읽기만 |
| 바이어에게 딜 진행 노출 | 바이어는 `/dashboard`에서 자기 `orders`만 본다. 딜 상태를 투영하지 않는다 |

빼는 이유는 "나중에"가 아니라 **"아직 겪어보지 않아서"**다. 본주문을 한 건도 처리해보지 않은 상태에서 정산 파이프라인을 설계하면 버릴 코드를 만든다.

---

## 11. PRD 대응표

| PRD | 이 문서 |
|---|---|
| `Members` | `buyers` (PK 변경) |
| `Suppliers` | `suppliers` |
| `Orders` | `deals` (이름 변경 — 2.1) |
| ①~⑦ ⑨ | `deals` + `items` + `sampleRounds` + `shipments` |
| ⑧ 컨택 제조사 현황 | `deals/{id}/supplierEngagements` |
| ⑩ 진행 단계 | `stageBrand` + `supplierEngagements.stageFactory` + `tasks` + `events` |
| ⑪ 결제 | `deals.payment` (필수 → 선택) |
| ⑦ 송장번호 | `deals/{id}/shipments` (4.1) |
| — | `messages` + `threads` + `intakeReviews` (신설) |

---

## 12. 문서 개정 이력

| 항목 | 2026-08-25 최초안 | 2026-08-26 이전 개정 | 현재 승인 반영 |
|---|---|---|---|
| 제품 범위 | 백오피스 초안 | 1차 출시 범위와 문서 버전이 모두 `v1/v2`로 표기됨 | **제품 1차 출시(v1)**로 고정, 문서 개정은 날짜로 구분 |
| LLM 파싱 | 제외 | 포함 | 유지 |
| 채널톡 | 이메일 유도 | Open API 폴링 포함 | **이전 이메일 대체 결정을 폐기했다고 명시** |
| 수집 대상 | Gmail 2 + Outlook | Gmail 6 + Outlook + 채널톡 + 폼 | 유지 + **전 페이지·성공 후 cursor·원천 상태 계약** |
| 공장 단계 | 8 | 9 | 유지 + **다음 행동은 tasks로 분리** |
| 제품·공급자 | 단일 | 단일 제품 + 복수 공장 배열 | **다제품 items + 역할별 supplierEngagements** |
| 원가 위치 | `private/` | 딜에 인라인 | **`private/finance`로 구조적 분리** |
| 샘플·배송 | 단일 송장 | `samples[]` + `shipmentMain`, 직송 가정 | **HQ 경유 기본 sampleRounds + 구간별 shipments; 본품 경로는 사례 발생 시 선택** |
| 메시지 상태 | 없음 | `messages.status` 하나 | **원문 messages + 작업 상태 threads + parseStatus 분리** |
| 제출 판정 | 제출 즉시 주문 | 기존 `orders` 유지 | **intakeReviews의 qualified만 딜·KPI로 인정** |
| 인가 | 규칙에서 `users.role` 검사 | 서버 허용목록 | 유지 + 재무 경로·신설 컬렉션 브라우저 차단 |
