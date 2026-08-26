# Medidakos 백오피스 구현 스펙 v2

> **기준일:** 2026-08-26 (v1: 2026-08-25)
> **입력:** `PRD/backoffice_prd_schema_specification.md` (화이트보드 스키마), 이 문서 v1, 라이브 상태 조사
> **적용 대상:** `medi-da-kos` 저장소의 `/admin`
> **v1에서 바뀐 것:** 6장 요약 참조

---

## 1. 이 문서가 정하는 것

일곱 개 메일함과 채널톡, 웹 폼에 흩어진 대화를 한 화면에 모으고, 바이어↔공장 양면 딜을 한 원장에서 굴린다.

v1은 "인수인계가 먼저"라고 썼다. 그 우선순위는 내려갔다. 자격증명 이관은 여전히 **첫 작업**이지만 이유가 바뀌었다 — 후임을 위해서가 아니라, **서버가 개인 노트북 없이 돌아야 수집기가 존재할 수 있기 때문**이다.

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
| `mail/{결정적ID}` | 108건 | 발신 큐 | Trigger Email 확장 (us-central1) |
| `tracking/{uid}/entries` | **컬렉션 없음** | 죽은 기능 | 없음 |

예외 하나만 손댄다 — 2.4.

### 2.3 이미 있는 좋은 관행 두 개는 따른다

- **결정적 문서 ID로 중복 방지** — `mail`이 `signup_member_{uid}` 같은 ID로 중복 발송을 막는다. 수집기의 `messages`도 같은 방식을 쓴다
- **발신 경로가 이미 있다** — `mail`에 쓰면 메일이 나간다. 회신 기능을 붙일 때 새로 만들 필요가 없다

### 2.4 `role` 필드 — 착수 시 막는다

`saveUserProfile()`이 `users/{uid}`를 `setDoc` 전체 덮어쓰기로 저장하고, 규칙이 필드를 제한하지 않는다. 브라우저 콘솔에서 자기 `role`을 `admin`으로 쓸 수 있다.

지금은 취약점이 아니다 — **`role`을 읽는 코드가 없다.** 그래서 함정이다. 나중에 누군가 그 값을 믿는 한 줄을 쓰면 40명 전원이 관리자가 된다.

```
match /users/{uid} {
  allow read:   if isOwner(uid);
  allow create: if isOwner(uid) && request.resource.data.role == 'user';
  allow update: if isOwner(uid) && request.resource.data.role == resource.data.role;
  allow delete: if false;
}
```

앱은 DB에서 읽은 `role`을 그대로 되쓰므로 깨지지 않는다(`mapFirebaseUser`: `role: extra?.role ?? "user"`). `deleteDoc`은 코드 어디에도 없다. 별도 커밋 + 에뮬레이터 테스트 4종.

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
| `medidakos.com` (Microsoft 365) | `support@` | 바이어 | Azure 앱 전용 `Mail.Read` |

**서비스 계정은 하나.** 도메인 전체 위임은 관리콘솔에서 클라이언트 ID를 등록하는 방식이라, 같은 서비스 계정을 두 Workspace에 각각 등록하면 된다. 프로젝트가 그 조직에 속할 필요가 없다.

`techasset.co.kr`는 GCP 프로젝트가 그 조직 소유(org `243848759364`)라 OAuth Internal도 가능하지만 쓰지 않는다. 두 도메인에 서로 다른 방식을 쓰면 코드가 두 갈래가 된다.

Azure는 `ApplicationAccessPolicy`로 `support@` 하나만 접근되게 범위를 조인다. **빼먹으면 테넌트 전체 메일함이 열린다.** 같은 Azure 앱 등록에서 Firebase Auth 마이크로소프트 제공자도 같이 설정한다(5장).

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
| 4 | 단일 `tracking_number` | `samples[]` + `shipmentMain` | 샘플은 여러 회차 돌고 본품 발송은 별건이다 |
| 5 | `escrow_status` 필수 | 선택 + 수기 | 본주문 0건, API 승인 미확보 |

### 4.1 컬렉션

```
buyers/{autoId}
  name, emails[], inflowChannel, brandName, country, phone
  firebaseUid?                     기존 users/{uid} 참조 (복제 아님)
  lastContactAt

suppliers/{autoId}
  companyName, contactPerson, phone, email
  category: 'pack' | 'ODM'
  supportedCerts[], ownershipExclusivity

deals/{autoId}
  reference                        기존 orders.referenceId 규칙
  buyerId, sourceOrderId?, sourceBriefId?
  buyerInfo{} productOverview{} formula{} packaging{}
  certifications{} timeline{} shippingInfo{} additionalRequests
  payment{ samplePayment{}, mainPayment{} }

  stageBrand: 1..8                 딜에 하나
  supplierContacts[]               PRD ⑧ — 원가 인라인 (4.3)
    supplierId, contactStatus: 'ing'|'fix'|'drop'
    stageFactory: 1..9             제조사마다 하나
    moq, unitCost, leadTime, supportedCerts[], notes
  supplierIds[]                    역방향 조회용 비정규화

  samples[]                        회차 기록
    round, supplierId, requestNotes
    shippedAt, trackingNumber, carrier
    feedbackAt, verdict: 'approved'|'revision'|'dropped', feedbackNotes
  shipmentMain{ trackingNumber, carrier, status, shippedAt }

  └ events/{autoId}                메모·단계변경·무시 기록
       type: 'note'|'stage'|'override'
       actor, at, body, from, to, reason

messages/{channel}:{externalId}
  channel: 'gmail_thomas'|'gmail_hally'|'gmail_rheekw'|'gmail_songjh'
         |'gmail_kimhs'|'gmail_parkjy'|'outlook_support'|'channeltalk'|'web'
  side: 'brand' | 'factory'        메일함으로 자동 판정 (4.2)
  externalId, threadId
  direction: 'in'|'out'
  from, to[], subject, bodyText, sentAt, attachments[]
  buyerId?, supplierId?, dealId?
  extraction{}, confidence{}, accepted{}
  status: 'new'|'reviewed'|'linked'|'ignored'
```

**문서 ID를 `{channel}:{externalId}`로 고정하는 것이 수집기의 핵심이다.** 폴링을 재실행해도 덮어쓰기만 되고 중복 생성이 되지 않는다.

### 4.2 메일함이 딜의 양면과 일치한다

수집기가 **어느 메일함으로 들어왔는지만 보고** 스레드가 브랜드 건인지 공장 건인지 판정한다. LLM도 규칙도 필요 없다.

```
side='brand'    발신자를 buyers.emails[]에서 조회 → 딜에 연결, stageBrand 근거
side='factory'  발신자를 suppliers.email에서 조회 → supplierContacts[]에 연결, stageFactory 근거
```

제조사 화면의 "이 공장과 주고받은 메일"도 여기서 따라온다.

### 4.3 원가는 딜 문서에 인라인으로 둔다

v1은 `deals/{id}/private/` 서브컬렉션으로 분리했다. **전제가 바뀌었다.** 어드민은 클라이언트 SDK를 쓰지 않고 모든 접근이 서버를 지난다(5장). 브라우저가 `deals`에 닿는 경로 자체가 없으므로 나눌 이유가 없다.

서브컬렉션으로 쪼개면 방어선이 늘어나는 게 아니라 **"이 필드는 어느 문서냐"를 매번 판단해야 하는 지점**이 늘어난다. 판단할 일이 없는 쪽이 안전하다.

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
| 브랜드4 샘플 발송 | **마지막 회차**의 `trackingNumber` + 브라질이면 `shippingInfo.taxId` |
| 브랜드8 배송 | `shipmentMain.trackingNumber` |
| 공장7 생산 | `payment.mainPayment.escrowStatus == 'funded'` |

디펜던시는 순서가 현실에서 자주 뒤집히는 일이고, 이 셋은 뒤집히면 돈이나 물건이 실제로 사라지는 일이다. 브라질 세금번호는 저장 시점에는 경고만 하고 발송 게이트에서 막는다 — 경고에 기한을 붙이되 바이어 회신을 기다리는 동안 딜이 멈추지 않게 한다.

**단계는 되돌아갈 수 있다.** 샘플 루프(발송 → 피드백 → 수정 → 발송)는 정상이다. 화면에 회차를 같이 띄운다(`샘플 발송 (3차)`). `samples.length ≥ 4`면 색을 바꾼다 — 사양 합의가 안 됐거나 공장이 안 맞는다는 신호다.

**공장9 배송과 브랜드8 배송은 같은 상자다.** 공장에서 브랜드로 직송하므로 HQ를 거치지 않는다. 공장이 배송으로 넘어가면 브랜드도 따라 넘어간다. `shippingInfo` 주소는 한 벌이면 된다.

> HQ가 샘플을 한 번도 보지 않는 구조다. 불량을 바이어에게서 처음 듣게 된다. 첫 몇 건의 피드백 양상을 기록해두고, HQ 경유가 필요해지면 `samples[]`에 칸을 더한다.

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
```

Admin SDK는 규칙을 우회하므로 서버는 동작하고 브라우저는 어느 쪽에서도 못 닿는다. **컬렉션을 만드는 커밋에 규칙과 에뮬레이터 테스트가 같이 들어간다.** 규칙은 눈으로 읽어서 맞는지 알 수 없는 종류의 코드다.

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
| Gmail 6개함 | `historyId` 증분 |
| Outlook `support@` | Graph delta 쿼리 |
| 채널톡 | `GET /open/user-chats` → `.../messages`. `x-access-key` + `x-access-secret` + `Channel-Version` |
| 웹 폼 | 가져올 게 없다. `contact`·`koreaLeads`·`orders` 트리거에서 `messages` 문서를 하나 더 만든다 |

채널톡 웹훅은 쓰지 않는다. 문서에 `token`이 *"페이로드 검증용 HMAC 토큰"* 이라고만 있고 **어느 헤더에 어떤 알고리즘으로 실리는지 스펙이 없다.** 검증 못 하는 공개 엔드포인트는 URL만 알면 아무나 가짜 대화를 밀어넣는다. 폴링이면 그 문제가 없고, **백필과 같은 코드가 된다** — 과거 대화 가져오기는 하한선 없는 폴링일 뿐이다.

메시지 원문을 그대로 저장한다. 토큰이 깨져도 지난 대화를 읽을 수 있고, **프롬프트를 고칠 때 메일함을 다시 긁지 않고 저장된 본문에 대고 재파싱**할 수 있다. 3단계가 여기 통째로 기댄다.

`needsReply`: 스레드의 마지막 메시지가 `direction: 'in'`이면 참.

### 6.3 파서

아래 겹은 LLM을 쓰지 않는다 — 중복 제거, 스레드 묶기, 발신자 추출, `side` 판정, 필터링.

거르는 대상: 내부 발신(전달 제외), `noreply@`·`mailer-daemon`·뉴스레터, 이미 딜에 연결된 스레드.

위 겹만 모델을 부른다. 출력은 **딜이 아니라 제안**이고 `messages.extraction`에 들어가 거기서 멈춘다. 검증은 Zod — LLM 출력은 신뢰 경계 바깥이고, 스키마 하나에서 `z.infer`로 타입이 나와 둘이 어긋날 수 없다.

**추가하는 의존성은 Zod 하나다.** Inngest는 쓰지 않는다 — 스케줄링은 Cloud Scheduler가, 재시도는 Cloud Functions가, 단계는 `status` 필드가 이미 한다. `new → reviewed`로 표시하니 중간에 죽어도 다음 실행이 이어받는다.

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

1. **통합 받은편지함** — v1의 주 화면. 노션 inbox 형태. 왼쪽 목록 + 오른쪽 상세, 처리해도 사라지지 않고 필터로 남는다. `status`가 이미 그 모델이다(`new`/`reviewed`/`linked`/`ignored`). `needsReply`·`side`·채널 필터
2. **딜 보드** — 브랜드 단계가 가로축인 카드. 카드 안에 공장 단계를 띄우고, 디펜던시 위반이면 색을 바꾼다. 공장 단계는 **확정(fix) 제조사가 있으면 그 값, 없으면 진행중 중 가장 앞선 값**
3. **딜 상세** — PRD ①~⑨ + 스레드 + `events` 타임라인
4. **제조사** — `pack`/`ODM` 필터, 제조사별 진행중·확정·기각 딜과 해당 공장 메일
5. **설정 → 메일 제공자** — 계정별 연결 상태·마지막 수집 시각·**재연결 버튼**. 이게 없으면 토큰이 깨졌을 때 결국 개인 노트북으로 돌아간다

첨부는 라우트로 프록시한다(`GET /api/admin/messages/{id}/attachments/{attId}` → `withAdmin` → provider에서 스트림). Cloud Storage에 복사하지 않는다 — 메일함에 이미 있는 걸 한 벌 더 두면 용량과 정합성 문제만 생긴다. 목록에는 📎 배지.

편의: 즉시 메모(타임스탬프 자동), 배송 정보 입력 시 바이어 기본값 프리필.

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

**훅** (`.claude/hooks/`): 배포·강제푸시·하드리셋 차단, 편집한 파일 타입체크, 원가 유출 검사. 원가 검사는 **화이트리스트**다 — `src/app/admin/**`·`src/app/api/admin/**`·`functions-ingest/**` 밖에서 `unitCost`·`moq`·`margin` 등이 나타나면 차단한다. 블랙리스트는 새 디렉터리가 생길 때마다 구멍이 뚫린다.

화면 점검은 `aside repl`.

---

## 9. 작업 순서

| 순서 | 내용 | 선행 |
|---|---|---|
| 1 | Workspace 2곳 + Microsoft 365 관리자 승인 요청 | — |
| 2 | 보안 규칙 정비 (`role` 쓰기 차단) + 에뮬레이터 테스트 | — |
| 3 | **인가 게이트** — `withAdmin`·미들웨어·세션·허용목록. 화면 기능 0개 | 2 |
| 4 | `buyers`·`suppliers` 컬렉션 + 규칙 + 수기 입력 화면 | 3 |
| 5 | 수집기 — `thomas@` **한 계정만** 먼저 관통 | 1, 3 |
| 6 | 통합 받은편지함 + 설정 화면 | 5 |
| 7 | 나머지 여섯 함 + 채널톡 + 웹 폼 | 5 |
| 8 | `deals` + 이원화 파이프라인 보드 + `events` | 4 |
| 9 | `supplierContacts` + 원가 | 8 |
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
| ①~⑦ ⑨ | `deals` 맵 필드 |
| ⑧ 컨택 제조사 현황 | `deals.supplierContacts[]` (인라인 — 4.3) |
| ⑩ 진행 단계 | `stageBrand` + `supplierContacts[].stageFactory` + `events` |
| ⑪ 결제 | `deals.payment` (필수 → 선택) |
| ⑦ 송장번호 | `samples[].trackingNumber` + `shipmentMain` (4.1) |
| — | `messages` (신설) |

---

## 12. v1 → v2 변경 요약

| 항목 | v1 | v2 | 근거 |
|---|---|---|---|
| LLM 파싱 | 제외 | **포함** | 사용자 결정 |
| 채널톡 | 제외 (API 제약) | **포함** | Open API 문서 확인 — 인증·백필·웹훅 전부 있음 |
| 수집 대상 | Gmail 2 + Outlook | **Gmail 6 + Outlook + 채널톡 + 폼** | 공장 소통이 `techasset.co.kr` 4함에 있음 |
| 공장 단계 | 8 | **9** | 사용자 확정 |
| 원가 위치 | `private/` 서브컬렉션 | **딜에 인라인** | 어드민이 서버 전용이 되어 전제가 바뀜 |
| 인가 | 규칙에서 `users.role` 검사 | **서버 허용목록** | `role`은 사용자가 쓰는 문서 — 신뢰 의존을 없애는 쪽 |
| 폴링 주기 | 10분 | **5분** | 사용자 요청 |
| 린터 | Biome | **ESLint 유지** | 앱이 `medi-da-kos`에 남고 `eslint-config-next`를 버릴 이유가 없음 |
| 인수인계 | 최우선 | **우선순위 하향** | 사용자 결정. 자격증명 이관은 유지 — 이유가 "서버가 돌아야 해서"로 바뀜 |
| 샘플 회차 | 없음 | **`samples[]`** | 샘플은 여러 번 돈다 |
| 디펜던시 | 차단 | **모달 확인 후 통과 + 기록** | 강제 차단은 과격 |
