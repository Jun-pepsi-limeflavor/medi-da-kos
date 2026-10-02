# Channel Talk CRM 연동 계획

**목표:** 웹사이트 고객 정보와 제출(Contact·Landing·Order/Brief)을 Channel Talk 고객 프로필과 상담으로 연결해, Channel Talk을 메인 고객 관리 창구로 쓴다.

**상태:** 설계 승인 완료(2026-10-01). 구현 전. 0단계 운영 채널 검증(A·B·C) 완료.

**브랜치:** `feat/channeltalk-crm-integration` 하나에서 기능별 커밋 → `dev` 검증 → `main`.

**배경:** 백오피스(`/admin`)와 Notion은 앞으로 거의 쓰지 않는다. 다만 이번 작업에서 기존 기능(`functions-ingest`, 백오피스, 관리자 알림 메일, Notion)은 삭제·변경·재배포하지 않는다. 새 연동이 운영에서 안정된 뒤 기능별로 다시 판단한다.

---

## 1. 고객 식별

| 값 | 역할 |
|---|---|
| Firebase `uid` | 회원 마스터 키 |
| Channel `memberId` | 회원만 `uid`와 같다. 회원 boot(`memberHash`)와 서버 upsert에서만 쓴다 |
| `profile.firebaseUid` | `uid` 사본(표시·검색용) |
| email | 사람 키. 정규화(소문자·trim)해 우리 Firestore 매핑으로 관리. `+` 별칭은 다른 이메일 |
| Channel 내부 `id` | 리드·익명 고객을 다룰 유일한 값 |

- 회원 여부는 `member === true`·고객 유형·우리 `uid` 매핑으로만 판단한다. **Web SDK 익명 사용자에게도 Channel Talk이 UUID `memberId`를 자동 부여하므로 `memberId` 존재 여부로 판단하지 않는다.** 자동 UUID는 저장하지 않는다.
- 비회원은 `memberId` 없는 리드다(`POST /open/users`).
- Channel Talk은 이메일로 자동 병합하지 않고 API로 이메일 검색도 안 된다. 그래서 매핑은 우리가 갖는다.

### Contact·Landing 식별 순서 (fallback 포함)

| 순서 | 상황 | 사용할 고객 | `identitySource` |
|---|---|---|---|
| 0 | 로그인 회원 | `@uid` | `member` |
| 1 | 브라우저 Channel 사용자가 있고(boot 미완료면 최대 1~2초 대기) 그 이메일이 비었거나 폼 이메일과 같음 | 브라우저 사용자(이메일이 비었으면 채움) | `browser` |
| 2 | 브라우저 id 없음, 또는 브라우저 사용자에 다른 이메일 | 폼 이메일로 매핑 검색. 브라우저 사용자의 이메일은 덮어쓰지 않음 | `email_mapping` |
| 3 | 매핑도 없음 | 서버가 `memberId` 없는 리드 생성 | `server_lead` |

- 서버는 브라우저가 보낸 Channel id를 그대로 믿지 않는다. 그 고객의 이메일이 비었거나 제출 이메일과 같을 때만 연결한다(남의 메신저에 메시지를 띄우는 경로 차단).
- Channel Talk 처리 실패가 Firestore 저장이나 고객 제출을 실패시키지 않는다. 서버/API 오류는 `channelTalkSync`에 남기고 재시도한다.
- `server_lead`일 때만 내부대화 3번째 줄에 `[연동 참고] 브라우저 고객 식별 없이 접수된 문의입니다.`
- 다른 기기 가입 등으로 같은 이메일의 다른 Channel 고객이 발견되면 `dup-candidate`(5장) → 담당자 수동 확인·병합.

## 2. 제출 처리

- **제출 1건 = 상담 1건.** Contact·Landing은 신규·재문의 모두, Order·Brief 최종 제출도 주문마다 새 상담.
- 순서: 상담 생성 → `private` + `silentToUser` 내부대화(전체 원문) → `open`.
- 기존 open 상담을 찾아 재사용하지 않는다. 그래서 "전체 opened 상담 조회 후 `userId` 필터"는 제출 처리에 구현하지 않는다.
- 고객에게는 메시지·알림을 보내지 않는다(고객용 접수 메시지 없음).
- 브리프 진행(`briefStep`, `briefStepLabel`, `briefStatus=작성 중`, `briefUpdatedAt`)은 브라우저 SDK가 단계 저장 시 갱신. 중도 이탈은 따로 표시·알림하지 않는다.
- 브리프 최종 제출 시 `briefStep=완료`, `briefStepLabel=Submitted`, `briefStatus=제출 완료`.

## 3. 내부대화 양식 (A 형식: 항목별 줄 텍스트)

공통:

- 1~2줄: `[종류] 회사 · 고객` / `접수: YYYY-MM-DD HH:mm KST`. 진행중 목록 미리보기에 이 줄이 보인다.
- 앞 표시: 허용된 테스트 이메일이면 `[TEST]`, 내부 계정이면 `[내부]`(둘 다면 `[TEST]`만).
- `[연동 참고]` 안내는 3번째 줄.
- 순서: 메시지 → 정보 → (제품·브리프) → 프로필 반영 → 기술 정보 → 기록.
- 빈 값과 고객이 입력하지 않은 기본값(korea `Global`, 이름 칸 비워 회사명이 들어간 경우)은 `-`.
- 코드값은 라벨과 원값을 함께(`5,000 – 10,000 units (5k-10k)`, `Skin Care (skincare)`).
- 템플릿에 없는 필드는 `■ 기타 항목`에 그대로 붙인다(누락 방지).
- 기술 정보(UTM 5종, 페이지 URL, GA client id, 브라우저)와 링크 미리보기 카드 포함.
- 마지막 줄 `기록: {collection}/{docId}`는 중복 확인 표식이다.
- 한 메시지에 다 담을 수 없으면 섹션 경계에서 나누고 각 부분 첫 줄에 `(n/m)`, 각 부분에 `기록:` 줄을 넣어 **같은 상담**에 순서대로 등록한다. 최대 길이는 구현 테스트에서 확인.

종류별 첫 줄과 고유 섹션:

| 종류 | 첫 줄 | 고유 섹션 |
|---|---|---|
| Contact | `[Contact 문의] {회사} · {이메일}` | 문의 내용 · 회사/이메일/회원 여부/비즈니스 유형/유입 경로 |
| Landing korea | `[Landing 문의 · korea] {회사} · {담당자 또는 이메일}` | 담당자(회사명과 같으면 `-`), 국가 `-`(항목 없음), 비즈니스 유형, 유입 경로, 예상 물량(라벨+코드), 포지셔닝 |
| Landing catalog | `[Landing 문의 · catalog] {회사} · {담당자}` | 국가(원문), 예상 수량(원문), 선택 제품 목록 |
| Landing dashboard | `[Landing 문의 · dashboard] {회사} · {담당자}` | 국가(원문), 예상 수량(원문), 브리프(Order와 같은 형식, 마지막 단계 표시) |
| Order·Brief | `[Brief 제출 · 주문 {orderId}] {title} · {이름} ({회사})` | 참조 id, 고객 정보(회원, 전화·가입 국가 원문), 브리프 1~6단계, 배송지(샘플 수령지), 시스템 요약. 두 번째 주문부터 3번째 줄 `[연동 참고] 이 고객의 n번째 주문입니다. 프로필 값은 자동으로 바뀌지 않으니 필요하면 확인 후 수정하세요.` 기술 정보 섹션 없음(주문에 저장되지 않음) |

## 4. 프로필 필드 쓰기 규칙

| 구분 | 필드 |
|---|---|
| 처음 한 번만(`profileOnce`) | `name`(실제 사람 이름일 때만), `email`, `brandCompanyName`, `mobileNumber`(`+` 국가번호가 붙은 명확한 형식일 때만, 아니면 원문은 내부대화에만), `marketCountry`(아래), `product`, `moq`(정확한 정수일 때만), `businessType`, `referralSource`, `firstSource` |
| 자동 관리(항상 갱신) | `briefStep`, `briefStepLabel`, `briefStatus`, `briefUpdatedAt`, `lastOrderId`, `orderCount`, `lastCheckoutCompletedAt`, `firebaseUid`, `lastContactAt`(2차) |
| 절대 건드리지 않음 | `shippingAddress`, `description`, `nextAction`, `manufacturer`, `landlineNumber`, `firstName`, `lastName`, 담당자 태그, UTM·referrer(Channel 자동), 시스템 필드, `unsubscribe*` |
| 더 이상 쓰지 않음 | 예전 boot 키 `companyName`, `country`(기존 값 처리는 이관에서 결정) |

`shippingAddress`는 주문마다 다를 수 있어 현재 배송지로 오해될 수 있으므로 자동화가 쓰지 않는다. 주문별 배송지는 각 주문 상담 내부대화에 남는다.

### Desk에 추가할 필드 (담당자가 필요 시점에 생성)

| 필드 | 타입 | 값 |
|---|---|---|
| `briefStatus` | 문자열 | `작성 중` / `제출 완료`(미착수는 빈 값) |
| `briefUpdatedAt` | 날짜시간 | 마지막 단계 저장 시각 |
| `lastOrderId` | 문자열 | 최근 주문 Firestore 문서 id |
| `orderCount` | 숫자 | 테스트 제외 제출 주문 수 |
| `firstSource` | 문자열 | `contact` / `landing-korea` / `landing-catalog` / `landing-dashboard` / `signup` |
| `businessType` | List | 폼 영문 원문 6종: `Salon, Spa, Esthetician, MUA` / `Existing Beauty Brand` / `Influencer / Creator` / `Agency` / `New Entrepreneur` / `Other` |
| `referralSource` | 문자열 | 폼 영문 원문 6종: `Search (Google, Bing, etc.)` / `I saw an ad` / `Social Media` / `A friend` / `Events` / `Other` |

### API 쓰기 경로의 타입 검증 (필수)

0단계에서 API가 Desk 필드 타입을 검증하지 않고, 이후 다른 PATCH 때 잘못된 값을 변환한다는 것이 확인됐다(문자열 `moq` → `0`, 날짜시간 → 분 단위).

- number: 정확한 정수일 때만 보낸다. 범위·TBD·근사치는 필드를 보내지 않고 원문은 내부대화에만.
- datetime: 밀리초 timestamp를 **분 단위로 내림**해 보내고, 최신값 비교도 분 단위.
- list: 확정된 값의 문자열 배열만.
- string: 512자 이내.
- 담당자의 Desk 수동 입력은 Desk가 타입을 막으므로 별도 방어하지 않는다.

### `marketCountry`

- 출처: `users.country`(회원가입)와 `landingRequests.country`(catalog·dashboard). `shippingAddress.country`는 쓰지 않는다(내부대화에만).
- 비어 있을 때만 입력. 값이 하나라도 있으면 추가·수정·삭제하지 않는다. 담당자 수정값은 덮어쓰지 않는다. 원문은 항상 내부대화에.
- **주의:** 현재 두 폼의 `Country`는 문구상 판매 시장보다 고객·회사 소재 국가에 가깝다. 초기 CRM 정보로 쓰기로 결정했다. **개선 과제:** 폼에 `Target market(s)` 항목을 추가하면 이 정책을 다시 검토한다.
- 국가 입력은 국가로, 권역 입력은 권역으로. 대소문자 무시.

| 기존 선택지 | 입력 |
|---|---|
| `미국` | United States, United States of America, USA, U.S.A., US, U.S., America |
| `캐나다` | Canada |
| `인도` | India |
| `프랑스` | France |
| `필리핀` | Philippines, The Philippines |
| `스위스` | Switzerland, Swiss Confederation |
| `노르웨이` | Norway |
| `UAE` | United Arab Emirates, UAE, U.A.E., Emirates |
| `북미`(권역) | North America |
| `유럽`(권역) | Europe, EU, European Union |
| `중동`(권역) | Middle East |
| `중남미`(권역) | Latin America, LATAM, Central and South America |

- 기존 `독일 (DACH: 독일·오스트리아·스위스 타겟)`은 자동화에서 쓰지 않고 수정·삭제하지 않는다. 입력 `DACH`는 새 선택지 `DACH`.
- 기존에 없는 국가: 실무에서 쓰는 짧은 한국어 국가명 하나로 고정(한국, 호주, 영국, 일본, 중국, 대만, 홍콩, 베트남, 태국, 싱가포르, 말레이시아, 인도네시아, 독일, 오스트리아, 네덜란드, 이탈리아, 스페인, 스웨덴, 덴마크, 핀란드, 폴란드, 튀르키예, 사우디아라비아, 카타르, 쿠웨이트, 이스라엘, 남아공, 뉴질랜드, 브라질, 멕시코 등). 전체 변환표는 코드 상수로 만들고 배포 전에 검토받는다.
- 기존에 없는 명확한 권역: Asia → `아시아`, Southeast Asia·SEA → `동남아시아`, South America → `남미`, East Asia → `동아시아`, Africa → `아프리카`, Oceania → `오세아니아`.
- 넣지 않음(원문만): Global, Worldwide, International, Online, 빈칸·오타, 범위가 다른 권역(APAC, Asia Pacific, MENA, GCC, Nordics, Scandinavia), 도시·주, `US`·`UK`·`UAE` 외 두 글자 코드.
- 복수 입력(`,` `/` `&` `and` `;`)은 모든 부분이 명확할 때만 복수 저장, 하나라도 불명확하면 비움.
- List 필드는 없는 값을 보내면 선택지가 자동 생성된다. 그래서 이름은 변환표의 고정값만 보낸다.

## 5. 태그와 테스트·내부 판정

- 자동화의 고객 태그는 `dup-candidate` 하나. 쓰기 직전 최신 태그 조회 후 merge(PATCH는 전체 교체). 20개 제한이면 추가를 포기하고 동기화 기록에 남긴다. 담당자가 지운 동일 조합에는 다시 붙이지 않는다.
- 상담 태그(`응대상태`: 고객회신대기 / 리마인드필요 / 보류 / 회신필요 / 후속회신필요)는 절대 건드리지 않는다. 문의 출처 표시가 필요하면 상담 description을 우선 검토한다.

### 판정과 표시

| `isTest` | 허용 테스트 이메일 | 내부 계정 | 결과 | 첫 줄 표시 |
|---|---|---|---|---|
| true | 아님 | 무관 | 연동 제외 | — |
| 무관 | 예 | (항상 내부 도메인) | 정상 연동 | `[TEST]`만(`[내부]` 중복 표시 안 함) |
| false | 아님 | 예 | 정상 연동 | `[내부]` |
| false | 아님 | 아님 | 정상 연동 | — |

`isTest`와 내부 계정은 따로 판단한다. 내부 계정이라는 이유로 연동을 건너뛰지 않는다.

### 내부 계정 (확정 2026-10-02)

- 이메일 도메인이 정확히 `techasset.co.kr`, `medidakoslabs.com`, `medidakos.com` 중 하나면 내부 계정이다. 대소문자 무시, 하위 도메인(`mail.techasset.co.kr` 등)은 제외.
- 예: `kimbm@techasset.co.kr`은 내부 계정 → `[내부]`.
- 직원 개인 gmail은 이 판정에 넣지 않는다(개인 이메일을 저장소에 더 퍼뜨리지 않기 위해서. 놓쳐도 표시만 빠지고 연동은 된다).
- 도메인 목록은 비밀이 아니므로 `functions/.env`에 둔다.
- 기존 내부 계정 코드·목록(`src/lib/internal-staff.ts`, `functions/lifecycle.js`의 개인 gmail 3개, `functions/web-message-materializer.js`, `functions-ingest`)은 삭제·수정하지 않는다. 통합은 기존 시스템 정리 단계에서 판단한다.

### 허용 테스트 이메일 (확정 2026-10-02, 도메인 전체 + 형식 검사)

모두 만족해야 허용한다. 소문자로 정규화한 뒤 판정한다.

1. 도메인이 정확히 `techasset.co.kr`(테스트 허용은 이 도메인만. `medidakoslabs.com`·`medidakos.com`은 내부 계정 판정에만 쓴다).
2. local part가 `{기준 이름}+chtest` 또는 `{기준 이름}+chtest-{문자}`.
   - 기준 이름과 뒤 문자는 영문·숫자·`.`·`_`·`-`만.
   - `+` 태그는 `chtest` 하나만.

| 이메일 | 결과 |
|---|---|
| `kimbm+chtest@techasset.co.kr` | 허용 |
| `kimbm+chtest-20261001@techasset.co.kr` | 허용 |
| `KIMBM+CHTEST@TECHASSET.CO.KR` | 허용 |
| `someone+chtest@gmail.com` | 거부(외부 도메인) |
| `kimbm+chtest@medidakos.com` | 거부(테스트 허용 도메인 아님) → 내부 계정 `[내부]` |
| `kimbm+test@techasset.co.kr` | 거부(형식 아님) → 내부 계정 `[내부]` |
| `kimbm+chtest+x@techasset.co.kr` | 거부(`+` 태그 2개) |
| `kimbm@techasset.co.kr` | 테스트 아님 → 내부 계정 `[내부]` |

**알려진 한계:** 코드만으로는 실제 존재하는 회사 계정인지 확인할 수 없어 없는 주소(`nobody+chtest@techasset.co.kr`)도 통과한다. 받아들인 이유:

- 운영 폼에서는 원래 누구나 아무 이메일로 제출할 수 있어 차이는 `[TEST]` 표시뿐이다.
- 유일한 실질 차이는 미리보기·`?qa`(`isTest=true`) 제출이 연동된다는 것인데, 생겨도 `[TEST]` 상담 하나다.
- 우리는 고객에게 메일·메시지를 보내지 않으므로 외부 발송이나 고객 데이터 노출 경로가 없다.

더 엄격하게 할 필요가 생기면 명시적 계정 목록 방식으로 바꾼다(판정 함수 한 곳과 설정 한 줄).

## 6. 내부대화 작성 봇

- 연동 전용 봇 `웹 접수`. 용도는 웹 자동 접수의 내부대화 작성과 상담 열기로 한정.
- 구현 테스트 직전에 봇 생성 API(`POST /open/bots`)로 정확한 이름으로 한 번만 생성하고 봇 목록으로 확인. 자동 생성에 맡기지 않는다(이름이 다르면 봇이 새로 생김).
- 기존 `Channel-bot`, `Shara KIM`(고객용 페르소나), `Tutorial-bot`은 수정·삭제·사용하지 않는다.

## 7. Functions와 Secret

- 기존 `functions/` 코드베이스에 Channel Talk 전용 함수를 **새로 추가**한다. 기존 트리거 4개(`onUserSignup`, `onContactCreated`, `onOrderCreated`, `onLandingRequestCreated`)는 수정·재배포하지 않는다. 운영 배포본과 저장소 소스가 다를 수 있기 때문이다.
- 새 함수(리전 `asia-northeast3`): `channelTalkOnUserCreated`, `channelTalkOnContactCreated`, `channelTalkOnLandingCreated`, `channelTalkOnOrderCreated`, `channelTalkRetry`(10분).
- 비밀: 웹 접수 전용 키를 새로 발급해 Secret Manager `CHANNELTALK_INTAKE_ACCESS_KEY`, `CHANNELTALK_INTAKE_ACCESS_SECRET`. 발급·등록은 구현 테스트 직전에 담당자가 직접 입력. 기존 `CHANNELTALK_ACCESS_KEY`·`CHANNELTALK_ACCESS_SECRET`(수집기)과 0단계 테스트 키는 쓰지 않는다.
- 일반 설정(`functions/.env`): API 버전 `2026-06-01`, 봇 이름, 내부 계정 도메인 3개, 테스트 허용 도메인 `techasset.co.kr`(5장).
- 회원 해시 비밀값은 기존대로 Vercel.

## 8. Firestore 스키마 (승인됨)

### `channelTalkIdentities/{정규화 이메일의 URL 인코딩}`

| 필드 | 타입 | 내용 |
|---|---|---|
| `email` | string | 정규화 이메일 |
| `channelUserId` | string \| null | 대표 Channel 고객 |
| `channelUserOrigin` | string | `member` / `browser` / `server_lead` / `imported` |
| `uid` | string \| null | 회원이면 Firebase uid |
| `memberId` | string \| null | 우리가 uid로 boot·upsert한 회원일 때만(= uid) |
| `otherChannelUserIds` | string[] | 같은 이메일의 다른 Channel 고객 |
| `dupPairs` | map | `{id1}_{id2}` → `{ state: tagged \| tag_limit \| dismissed, at }` |
| `firstSource` | string \| null | 처음 넣은 `firstSource` |
| `createdAt`, `updatedAt` | timestamp | |

### `channelTalkSync/{source}_{docId}`

| 필드 | 타입 | 내용 |
|---|---|---|
| `source`, `docId` | string | `users` / `contact` / `landingRequests` / `orders` |
| `email`, `uid` | string \| null | |
| `identitySource` | string | `member` / `browser` / `email_mapping` / `server_lead` |
| `channelUserId` | string \| null | |
| `userChatId` | string \| null | 생성 즉시 기록 |
| `chatCreateStartedAt` | timestamp \| null | 상담 생성 의도 기록 |
| `extraChatIds` | string[] | 복구 조회에서 2건 이상 발견된 나머지(삭제하지 않음) |
| `leadCreateStartedAt` | timestamp \| null | 서버 리드 생성 의도 기록 |
| `possibleOrphanLead` | bool | 리드 생성 응답 유실 후 재시도로 빈 리드가 남았을 수 있음 |
| `noteMessageIds` | string[] | 내부대화 id(분할 시 순서대로) |
| `noteParts` | number | |
| `steps` | map | `identity`, `profile`, `chat`, `note`, `open`, `dupTag` → `pending` / `done` / `skipped` / `error`. `chat`은 `creating`, `identity`는 `creating_lead` 추가 |
| `status` | string | `pending` / `processing` / `success` / `error` / `skipped` |
| `skipReason` | string \| null | 예: `is_test` |
| `flags` | map | `{ test, internal }` |
| `profileResult` | map | `{ applied: string[], skipped: { 필드: 사유 } }` |
| `attempts` | number | |
| `lastError` | string \| null | 비밀값 제외 |
| `nextRetryAt` | timestamp \| null | 성공 시 null. 재시도 조회는 이 단일 필드로(복합 인덱스 불필요) |
| `leaseUntil` | timestamp \| null | 트리거·재시도 동시 실행 방지 |
| `createdAt`, `updatedAt` | timestamp | |

### 중복 방지

- 처음 처리 시 sync 문서를 없을 때만 생성해 처리 권한을 잡고, 단계마다 `steps`를 갱신한다. `leaseUntil`로 동시 실행을 막는다.
- **상담 생성:** `steps.chat=creating`과 `chatCreateStartedAt`을 먼저 기록 → 생성 API 호출 → 성공 응답이면 즉시 `userChatId`. 4xx는 미생성 확정. 시간 초과·5xx·함수 종료로 `creating`이 남으면 재시도는 바로 만들지 않고 `GET /open/user-chats?state=initial`에서 해당 고객의 `chatCreateStartedAt` 이후 상담을 찾는다. 1건이면 채택, 0건이면 생성, 2건 이상이면 가장 먼저 생긴 것을 채택하고 나머지는 `extraChatIds`에 남긴다.
  - **미검증 전제:** `state=initial` 조회가 API로 만든 상담을 고객 id와 함께 돌려주는지 구현 테스트 첫 항목으로 확인한다. 성립하지 않으면 대체 방식을 임의로 확정하지 않고 대안을 정리해 승인받는다.
- **내부대화:** 보내기 전에 상담 메시지에서 `기록: {source}/{docId}`(분할 시 `(n/m)` 포함)를 확인한다.
- **열기:** 이미 열린 상담이면 건너뛴다. 프로필·태그는 같은 값 재전송이 무해하다(태그는 조회 후 merge).
- **서버 리드 생성:** API에 이메일 검색이 없어 완전한 멱등성을 보장할 수 없다. `steps.identity=creating_lead`와 `leadCreateStartedAt`을 먼저 기록하고, 응답 유실 후 재시도한 경우 `possibleOrphanLead=true`로 남겨 중복 후보 흐름에서 확인한다.

### 기존 컬렉션 변경

| 컬렉션 | 추가 필드 | 쓰는 쪽 |
|---|---|---|
| `contact` | `channelUserId`(선택, 64자 이하), `uid`(선택, 로그인 시) | 브라우저 |
| `landingRequests` | `channelUserId`(선택, 64자 이하) | 브라우저 |

### Rules

```
match /channelTalkIdentities/{id} { allow read, write: if false; }
match /channelTalkSync/{id}       { allow read, write: if false; }

// contact create에 추가
&& (!('uid' in request.resource.data)
    || (isSignedIn() && request.resource.data.uid == request.auth.uid))
&& validLandingOptionalString('channelUserId', 64)

// landingRequests: catalog·dashboard·korea hasOnly에 'channelUserId' 추가
//                   + validLandingOptionalString('channelUserId', 64)
```

`contact`는 허용 필드 목록이 없어서, 규칙 없이는 누구나 남의 `uid`를 넣을 수 있다. 그래서 본인 `uid`만 허용한다. `channelUserId`는 서버가 이메일로 검증한다.

### 에뮬레이터 테스트

1. 클라이언트(로그인·비로그인)는 두 새 컬렉션을 읽고 쓸 수 없다.
2. `contact`: 비로그인 + `uid` 거부, 남의 `uid` 거부, 본인 `uid` 허용, `uid` 없음 허용.
3. `contact`·`landingRequests`의 `channelUserId`: 64자 이하 허용, 초과·비문자열 거부.
4. `landingRequests` 세 variant 모두 `channelUserId` 허용, 다른 새 필드는 거부 유지.
5. 기존 규칙 테스트 전부 통과.

저장하지 않는 것: Channel 자동 UUID `memberId`, Channel 프로필 사본, 고객별 주문 수(매번 `orders`에서 계산), `lastContactAt` 캐시(2차에서 설계).

## 9. 배포 순서와 제약

1. **Firestore rules 먼저.** 웹이 `landingRequests.channelUserId`를 쓰기 시작했는데 규칙이 옛것이면 `hasOnly`에 걸려 랜딩 제출이 실패한다. 규칙 배포는 파일 전체 교체이므로 운영 규칙과 저장소 규칙이 같은지 먼저 확인한다. `--dry-run`도 승인 없이 실행하지 않는다.
2. 새 Functions만 좁혀 배포(`--only`), 기존 함수 재배포 금지.
3. 웹(Vercel)은 1·2 이후 병합.

각 배포, `웹 접수` 봇 생성, 운영 키 발급·Secret 등록, Desk 필드 생성은 그 시점에 따로 승인받는다.

## 10. 웹 수정

- 회원 boot는 신원만(`memberId`, `memberHash`) 보낸다. 지금 boot는 방문마다 `name`·`email`·`mobileNumber`를 덮어쓰고, `onAuthStateChanged`가 Firestore `users`를 읽지 않아 회사·전화·국가가 null로 전송된다. 키도 Desk와 다르다(`companyName`·`country`).
- 제출 시 브라우저 SDK `updateUser`로 이메일·이름을 붙이고 Channel id를 제출 문서에 저장한다(1장 순서 1).
- 브리프 제출 후 `refreshBrief()`가 `briefStep=1`을 보내는 문제를 막고 "완료"를 표시한다.

## 11. 2차·후속 과제

- **`lastContactAt` (2차):** 자동 관리 필드. 갱신 대상은 고객의 채팅·연동 이메일, 담당자의 고객응대·연동 이메일, Contact·Landing·Brief 제출. 내부대화·봇·시스템 로그·팀챗은 제외(Webhook `messageCreatedUserChat`의 `personType`, `options`, `log`로 판정). 연동되지 않은 별도 Gmail은 제외. 기존 고객 이관은 상담 기록의 마지막 실제 연락 시점으로 **비어 있을 때만** 채운다. 구현 직전 C6(고객 직접 메시지) 테스트 계획을 따로 세운다. 수신 함수 위치·HMAC 검증도 그때 확정.
- **C5(수동 병합)**는 하지 않는다. 다른 기기 중복은 `dup-candidate` 예외 흐름.
- **폼 개선:** `Target market(s)` 항목 추가 시 `marketCountry` 재검토.
- **기존 시스템 정리(새 연동 안정 후 판단):** `functions-ingest` 채널톡 수집(현재 내부대화까지 백오피스로 복사. 유지/내부대화 제외/종료), Gmail·Outlook 수집, `web-message-materializer`, 백오피스 답장 경로, Notion 동기화, 관리자 알림 메일, `lifecycleScan`.

## 12. 이관 전 확인 (읽기 전용 dry-run, 별도 승인)

- 테스트 데이터 정리 후 진행.
- 매핑 출처: Desk 고객 내보내기 가능 여부, 수집기 `messages`의 이메일↔Channel id.
- number·datetime·list 필드에 타입이 틀린 값이 있는 기존 고객(다른 필드 갱신 시 변환될 수 있음). 승인 없이 수정하지 않는다.
- 예전 키 `companyName`·`country` 값의 처리.
- boot null 덮어쓰기로 지워졌을 수 있는 회원 값.
- 태그 20개 한도 근접 고객.
- `lastContactAt` 이관용 과거 상담 조회 범위(`listUserChats` 기간 최대 30일, `managedAt`은 2026-01-01부터).
- 이관은 상담을 만들지 않고 프로필 빈 칸만 채운다.

---

## 부록 A. 0단계 운영 채널 검증 결과 (2026-10-01)

운영 채널 `medidakos`(id 248070)에서 전용 테스트 API 키와 테스트 고객만 사용했다. 등록된 Webhook 0개, 회원 해시 검증 켜짐.

### A. 프로필 (테스트 리드 `6abdefb2a059ac3264bb`, `kimbm+chtest-20261001@techasset.co.kr`)

| # | 결과 |
|---|---|
| A1 | `POST /open/users`로 `memberId` 없는 리드 생성. 기존 고객과 통합 제안 없음 |
| A2 | `profileOnce`는 기존 값 유지 |
| A3 | List 필드는 배열로 저장, 칩으로 표시. `profile`로 보내면 리스트 전체 교체 |
| A4 | 선택지에 없는 값(`테스트국가`)이 저장되고 **선택지가 자동 생성** |
| A5 | number 필드에 문자열이 거부되지 않고 저장(Desk 필터에서는 0) |
| A6 | datetime은 밀리초로 저장·정상 표시. 다른 필드 PATCH 때 **문자열 `moq`가 `0`으로 변환** |
| A7 | 태그 병합 동작. 이후 **datetime이 분 단위로 정규화**. 태그는 **전체 교체** 확정 |

### B. 상담·내부대화 (상담 `6abdfa1c2223f6eff2b8`, 봇 `Channel-bot`)

- 생성 직후 `initial`(Desk `준비중`)이라 받은편지함 목록에 보이지 않음. 자동 메시지·배정 없음.
- `private` + `silentToUser` 내부대화는 Desk에서 내부대화로 표시, 여러 줄 정상, URL 링크 미리보기 카드 생성.
- `PUT /open/user-chats/{id}/open` 후 `opened`로 진행중 목록에 노출. 비공개 로그(`log.action=open`, `private`, `silentToUser`) 1건.
- 열린 상담에 내부대화 추가: 맨 위로 올라가지만 **unread 없음**. 새 상담 없음.
- 응답 없이 약 10분 후 기존 팀 대기 알림 메일 발송.
- 고객별 상담 목록 API(`GET /open/users/{id}/user-chats`, 필터 없음)에 우리가 만든 상담이 나오지 않음. 전체 opened 목록(`state=opened`, limit 100)은 108건 기준 2페이지·2호출·0.3초로 찾음.
- 존재하지 않는 `botName`을 쓰면 봇이 자동 생성된다(명세).

### C. 고객 관점 (Chrome 시크릿 창, `localhost:3000` 화이트리스트)

| 단계 | 결과 |
|---|---|
| C1 | 새 익명 사용자 `6abe09fe96c07cc647f8`, `member=false`, 자동 별명, **자동 UUID `memberId` 부여** |
| C2 | `updateUser`로 같은 id가 리드로 전환. 자동 UUID 유지. 새 고객·통합 없음 |
| C3 | 상담 `6abe0c7935aa79cd22c2` 생성 → 내부대화 → open. Desk 진행중 상단 + unread 1. **고객 메신저에는 상담·내부대화·open 로그가 보이지 않음.** 배지·팝업·고객 메일 없음(지연 발송은 계속 관찰) |
| C4 | 같은 브라우저에서 `shutdown` → identity-only member boot. **같은 id가 회원으로 전환**, 자동 UUID는 사라지고 `zz-test-member-20261001`로 교체. `unifiedId` 없음. 이메일·이름·상담·내부대화 유지. Desk 고객 1명 |

참고:

- 화이트리스트(`medidakos.com`, `localhost:3000`) 밖인 `127.0.0.1:8765`에서는 boot가 403. `www.medidakos.com`은 실제 브라우저에서 정상 동작.
- 앱 내장 브라우저에서는 사전 저장소가 비어 있었는데도 다른 사용자(`1b881fba…`)로 연결됐다. 이전에 만들어진 익명 세션일 가능성이 있다는 추정만 기록한다(실제 회원으로 확정하지 않음, 추가 조회 없음).
- 테스트 도구 이슈: 테스트 페이지의 중복 실행 방지가 페이지 메모리에만 있어 새로고침 후 C2가 한 번 더 실행됐다. 같은 값이라 결과에 영향은 없다. 이후 테스트 도구는 실행 여부를 페이지 밖에 남긴다.

### 남아 있는 테스트 데이터 (정리 별도 승인)

- B 리드 `6abdefb2a059ac3264bb`, 상담 `6abdfa1c2223f6eff2b8`, 태그 `zz-integration-test`, `marketCountry` 선택지 `테스트국가`
- C 회원 `6abe09fe96c07cc647f8`(`zz-test-member-20261001`), 상담 `6abe0c7935aa79cd22c2`
- `functions-ingest`가 복사했을 수 있는 Firestore 문서(예상): `threads/channeltalk:main:{상담 id}`, `messages/channeltalk:main:{메시지 id}`, 고객 식별 문서. 미확인
- 0단계 테스트 API 키(로컬 `.env.local`). 폐기 예정
