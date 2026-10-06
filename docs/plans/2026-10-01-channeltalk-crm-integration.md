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
- Channel Talk API로는 이메일 검색이 안 된다. 그래서 매핑은 우리가 갖는다. 리드끼리는 통합되지 않는다. **Open API로 회원에게 기존 리드와 같은 이메일을 넣으면 그 리드가 회원에 통합된다**(T8 S8, 채널톡 지원팀 안내와 일치).
- **같은 브라우저 자동 통합(T4·X12 확인).** 리드가 있는 브라우저에서 회원으로 boot하면, 서버가 그 회원을 먼저 만들었어도 Channel이 리드를 회원에 합친다. **이메일이 달라도 합친다.** 옛 리드는 `type: "unified"` + `unifiedId`(회원 id)로 남고 `profile`은 비며, 회원 프로필은 빈 칸만 리드 값으로 채워진다. 태그는 회원 태그 + 리드 태그로 합쳐진다.
- **통합 처리 원칙.** `unifiedId`를 따라가 최종 고객을 찾되(최대 3단계), 최종 고객의 이메일이 **비어 있거나 같을 때만** 그 고객을 이 이메일의 고객으로 쓴다. 다르면 통합 사실만 `unifiedChannelUserIds`에 기록하고 그 고객에는 PATCH·상담·중복 후보 판정을 하지 않는다. `unifiedId`가 없거나 순환·단계 초과면 진행하지 않고 재시도한다(`unified_unresolved`, 12회째 `failed`).

### Contact·Landing 식별 순서 (fallback 포함)

| 순서 | 상황 | 사용할 고객 | `identitySource` |
|---|---|---|---|
| 0 | 로그인 회원 | `@uid`. 이미 있는 회원이면 `PUT @memberId`를 보내지 않고 그대로 쓴다. 없을 때(404)만 `{ profile: { firebaseUid } }`로 만든다 | `member` |
| 1 | 브라우저 Channel 사용자가 있고(boot 미완료면 최대 1~2초 대기) 그 이메일이 비었거나 폼 이메일과 같음 | 브라우저 사용자(이메일이 비었으면 채움) | `browser` |
| 2 | 브라우저 id 없음, 또는 브라우저 사용자에 다른 이메일 | 폼 이메일로 매핑 검색. 브라우저 사용자의 이메일은 덮어쓰지 않음 | `email_mapping` |
| 3 | 매핑도 없음 | 서버가 `memberId` 없는 리드 생성 | `server_lead` |

- 서버는 브라우저가 보낸 Channel id를 그대로 믿지 않는다. 그 고객의 이메일이 비었거나 제출 이메일과 같을 때만 연결한다(남의 메신저에 메시지를 띄우는 경로 차단).
- 경로별 통합 처리:
  - **브라우저:** id가 통합됐으면 최종 고객을 브라우저 고객으로 보고 위 이메일 조건을 그대로 적용한다. 이메일이 다르거나 따라갈 수 없으면 브라우저 id가 없는 것으로 보고 2·3으로 간다.
  - **매핑:** 대표가 통합됐고 최종 고객 이메일이 맞으면 그 고객을 쓰고 대표를 바꾼다. 다르면 새 서버 리드를 만들어 대표로 바꾸고, 그 고객은 이 이메일의 `otherChannelUserIds`에 넣지 않는다. 통합 대상이 실제 404면 그 id가 매핑에 있을 때만 `missingChannelUserIds`로 옮기고 새 리드로 간다. `memberId` 매핑은 지금처럼 `@uid`로 찾는다.
  - **회원(uid):** 지금처럼 `@uid` 회원을 쓴다(통합 추론이 아님). upsert 결과가 `unified`면 `member_unified`로 실패해 사람이 확인한다.
  - **식별 뒤 통합:** 프로필 단계(PATCH 전), 또는 재시도의 상담 단계(생성 전)에서 고객이 `unified`면 식별·프로필부터 다시 한다. 한 실행에 한 번만이고(두 번째면 `user_unified_again`), `attempts`는 늘지 않으며 `reidentified=true`를 남긴다.
- Channel Talk 처리 실패가 Firestore 저장이나 고객 제출을 실패시키지 않는다. 서버/API 오류는 `channelTalkSync`에 남기고 재시도한다.
- `server_lead`일 때만 내부대화 3번째 줄에 `[연동 참고] 브라우저 고객 식별 없이 접수된 문의입니다.`
- 다른 기기 가입 등으로 같은 이메일의 다른 Channel 고객이 발견되면 `dup-candidate`(5장) → 담당자 수동 확인·병합. Channel이 이미 같은 고객으로 통합한 쌍은 중복이 아니다.

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
- 한 메시지에 다 담을 수 없으면 섹션 경계에서 나누고 각 부분 첫 줄에 `(n/m)`, 각 부분에 `기록:` 줄을 넣어 **같은 상담**에 순서대로 등록한다. 분할 기준은 Desk 가독성을 위해 **4,000자**(`CHANNELTALK_NOTE_MAX_LENGTH`). T2에서 API는 최소 32,000자까지 저장함을 확인했지만 기준은 올리지 않는다(운영 후 필요하면 설정값으로 조정).

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

### 어느 요청으로 쓰는가 (T3·T7 실제 검증, 2026-10-02)

- **`PUT /open/users/@{memberId}`는 기존 프로필을 보낸 내용으로 통째로 바꾼다(T8).** T3에서 upsert의 `profileOnce`가 이미 있는 이름·이메일을 덮어쓴 것도 같은 동작이다. T8 S9·S10에서 `{ profile: { firebaseUid } }`만 보낸 PUT 뒤 `firstSource`·`businessType`·`referralSource`가 지워졌다. 그래서 이미 있는 회원에게는 PUT을 보내지 않고, 없을 때(404)만 `{ profile: { firebaseUid } }`로 만든다. `firebaseUid` 갱신은 이어지는 프로필 `PATCH`가 한다.
- **처음 한 번만 채우는 값은 `PATCH /open/users/{id}`의 `profileOnce`로만 보낸다.** T7에서 회원 `PATCH`의 `profileOnce`가 기존 이름·회사를 지키고 빈 `moq`만 채웠다(리드는 A2에서 같은 동작 확인). 같은 요청의 `profile`(`briefStep`)은 정상 갱신됐다.
- **태그는 회원 `PATCH`에서도 전체 교체다(T7).** 반드시 최신 태그 `GET` → 병합 → `PATCH` 원칙을 지킨다.
- 단위 테스트가 회원가입·주문·로그인 회원 Contact에서 upsert 본문이 `{ profile: { firebaseUid } }`뿐이고 처음 한 번만 값이 `PATCH profileOnce`로만 가는지 확인한다.
- **`mobileNumber`는 별도 `PATCH`로 보낸다(T8).** Channel은 번호 자체를 검사해 유효하지 않으면 `422 VALIDATION_FAILED`(`profile.mobileNumber: 올바른 휴대폰 번호가 아닙니다`)로 거부하고, 같은 요청의 다른 필드도 함께 거부된다. 그래서 나머지 필드를 먼저 보내고 번호는 `profileOnce: { mobileNumber }`만 담아 따로 보낸다. 번호 요청이 **422**로 거부되면 번호만 포기하고 `profileResult.skipped.mobileNumber = "rejected_by_channel"`로 남긴 뒤 다음 단계로 간다(원문은 주문 내부대화 고객 정보와 Firestore `users`에 남음). 429·5xx·시간 초과와 422가 아닌 거부는 지금처럼 프로필 단계 오류로 재시도한다. 다른 필드의 422는 무시하지 않는다.

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
| `미국` | United States, United States of America, USA, U.S.A., US, U.S. (`America` 단독은 불명확한 값으로 넣지 않음) |
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
- 기존에 없는 국가: 실무에서 쓰는 짧은 한국어 국가명 하나로 고정(한국, 호주, 영국, 일본, 중국, 대만, 홍콩, 베트남, 태국, 싱가포르, 말레이시아, 인도네시아, 독일, 오스트리아, 네덜란드, 이탈리아, 스페인, 스웨덴, 덴마크, 핀란드, 폴란드, 튀르키예, 사우디아라비아, 카타르, 쿠웨이트, 이스라엘, 남아공, 뉴질랜드, 브라질, 멕시코 등. `KSA`는 사우디아라비아). 홍콩은 별도 시장 `홍콩`. 전체 변환표는 `functions/channeltalk/market-country.js` 상수이며 2026-10-02 목록 검토 완료.
- 기존에 없는 명확한 권역: Asia → `아시아`, Southeast Asia·SEA → `동남아시아`, South America → `남미`, East Asia → `동아시아`, Africa → `아프리카`, Oceania → `오세아니아`.
- 넣지 않음(원문만): Global, Worldwide, International, Online, 빈칸·오타, 범위가 다른 권역(APAC, Asia Pacific, MENA, GCC, Nordics, Scandinavia), 도시·주, `US`·`UK`·`UAE` 외 두 글자 코드.
- 복수 입력(`,` `/` `&` `and` `;`)은 모든 부분이 명확할 때만 복수 저장, 하나라도 불명확하면 비움.
- List 필드는 없는 값을 보내면 선택지가 자동 생성된다. 그래서 이름은 변환표의 고정값만 보낸다.

## 5. 태그와 테스트·내부 판정

- 자동화의 고객 태그는 `dup-candidate` 하나. 쓰기 직전 최신 태그 조회 후 merge(PATCH는 리드·회원 모두 전체 교체, A7·T7 확인). 20개 제한이면 추가를 포기하고 동기화 기록에 남긴다. 담당자가 지운 동일 조합에는 다시 붙이지 않는다.
- **중복 후보 판정.** 이번 고객과 매핑의 다른 고객을 각각 최종 고객까지 따라가 판단한다. 같은 최종 고객으로 이어지면 쌍을 `unified`로 기록하고 태그를 붙이지 않는다(이미 붙은 태그는 지우지 않음). 서로 다른 살아 있는 고객이면 기존 규칙(`tagged`·`dismissed`·`tag_limit`) 그대로다. 최종 고객 이메일이 다르면 후보가 아니다. 이번 고객이 다른 이메일의 회원에 합쳐졌으면(공용 브라우저) 관계만 기록하고 판정을 건너뛴다. `unifiedChannelUserIds`의 키는 후보에서 빼고 값은 후보로 쓰지 않는다. 대표가 살아 있고 이메일이 맞는 최종 고객으로 통합됐으면 이 판정에서 대표를 바로 바꾼다.
- **회원가입 직후에는 판정을 미룬다.** 웹은 가입 직후 회원 boot를 하고 Channel은 그 순간 같은 브라우저 리드를 합친다. 가입 처리에 후보가 있으면 `steps.dupTag=deferred`, `status=pending`, `pendingReason=dup_check_delayed`, `nextRetryAt=지금+10분`(재시도 주기)으로 두고, `channelTalkRetry`가 그 뒤 첫 실행(가입 후 10~20분)에 판정한다. 그 전에는 같은 이벤트가 다시 와도 처리하지 않는다. 미루기는 실패가 아니어서 `afterFailure`를 거치지 않고, 다시 잡을 때 `attempts`가 1 늘어난다(가입 건은 처리 시도 2회 사용).
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
- `functions/index.js`에는 새 트리거를 내보내는 줄만 추가한다(`functions/channeltalk/triggers.js`). 기존 함수 로직은 바꾸지 않는다.
- 실행 시간 제한 2분, lease 5분. 재시도는 한 번 실행에 최대 50건(설정 가능한 상수)이며, 2분 안에 끝나도록 남은 시간이 부족하면 새 건을 잡지 않고 다음 실행으로 넘긴다.
- **연동 스위치 `CHANNELTALK_INTAKE_ENABLED`(기본 `false`)**
  - 꺼져 있으면 트리거는 실제 연동 대상 제출을 `status=pending`, `pendingReason=intake_disabled`, `nextRetryAt=제출 시각`, `attempts=0`으로 기록하고 Channel Talk을 호출하지 않는다. 일반 `isTest` 제출은 지금처럼 `skipped`(`skipReason=is_test`)로 확정한다.
  - 꺼져 있으면 `channelTalkRetry`는 아무것도 읽거나 바꾸지 않고 끝난다. 대기 건과 `error` 건의 `attempts`를 소모하지 않는다.
  - 켜면 다음 재시도부터 기간 제한 없이 `nextRetryAt`이 오래된 순으로 처리한다. 처음 처리권을 잡을 때 `pendingReason`을 지우고 그때부터 `attempts` 1회로 센다.
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
| `otherChannelUserIds` | string[] | 같은 이메일의 다른 Channel 고객. 통합된 id와 사라진 id는 넣지 않는다 |
| `missingChannelUserIds` | string[] | Channel 조회에서 **실제 404**로 확인된 id(삭제 등). 대표가 사라졌으면 새로 식별한 고객을 대표로 바꾸고 사라진 id를 여기로 옮긴다. 다음 같은 이메일 문의는 새 대표를 재사용해 리드를 반복 생성하지 않는다. 통합된 id는 넣지 않는다 |
| `unifiedChannelUserIds` | map | `{ 옛 Channel id: 최종 고객 id }`. Channel이 `type: unified`로 통합했다고 확인한 관계. 고객을 찾는 데 쓰지 않는 기록이며(항상 API로 다시 확인), 키는 중복 후보에서 빠진다. 살아 있는 고객으로 다시 확인된 id는 지운다. 없던 문서는 `{}`로 본다 |
| `dupPairs` | map | `{id1}_{id2}` → `{ state: tagged \| tag_limit \| dismissed \| unified, at }`. `unified`는 Channel이 같은 고객으로 통합한 쌍(태그를 붙이지 않음) |
| `firstSource` | string \| null | 처음 넣은 `firstSource` |
| `createdAt`, `updatedAt` | timestamp | |

### `channelTalkSync/{source}_{docId}`

| 필드 | 타입 | 내용 |
|---|---|---|
| `source`, `docId` | string | `users` / `contact` / `landingRequests` / `orders` |
| `email`, `uid` | string \| null | |
| `identitySource` | string | `member` / `browser` / `email_mapping` / `server_lead` |
| `identityNote` | string \| null | 식별 사유 코드만(고객 원문·개인정보 금지). 겹치면 앞의 것이 우선: `mapping_user_unified_other_email`(매핑 대표가 다른 이메일 고객에 통합돼 새 리드로) / `mapping_user_missing`(매핑 대표 또는 그 통합 대상이 404라 정정) / `mapping_user_unified`(매핑 대표가 통합돼 최종 고객으로) / `browser_email_mismatch`(브라우저 고객 이메일이 폼과 달라 쓰지 않음) / `browser_user_unified_other_email`(브라우저 고객이 다른 이메일 고객에 통합돼 쓰지 않음) / `browser_user_unified`(브라우저 고객이 통합돼 최종 고객으로) / `browser_user_unresolved`(브라우저 고객 통합 대상을 따라갈 수 없음) / `browser_user_missing`(폼의 브라우저 id 고객이 없음) |
| `channelUserId` | string \| null | |
| `userChatId` | string \| null | 생성 즉시 기록 |
| `chatCreateStartedAt` | timestamp \| null | 상담 생성 의도 기록(처음 시도 시각 유지) |
| `possibleOrphanChat` | bool | 이전 상담 생성 요청의 성공 여부를 확인할 방법이 없어 다시 만든 경우 true. 실제 중복이 확인됐다는 뜻이 아니라, 메시지 없는 빈 `initial` 상담이 남아 있을 **가능성**을 나타낸다. 정상적인 최초 생성은 false |
| `leadCreateStartedAt` | timestamp \| null | 서버 리드 생성 의도 기록 |
| `possibleOrphanLead` | bool | 리드 생성 응답 유실 후 재시도로 빈 리드가 남았을 수 있음 |
| `reidentified` | bool | 식별 뒤 고객이 통합돼 다시 식별했으면 true |
| `noteMessageIds` | string[] | 내부대화 id(분할 시 순서대로) |
| `noteParts` | number | |
| `steps` | map | `identity`, `profile`, `chat`, `note`, `open`, `dupTag` → `pending` / `done` / `skipped` / `error`. `chat`은 `creating`, `identity`는 `creating_lead`, `dupTag`는 `deferred`(가입 직후 판정 미룸) 추가 |
| `status` | string | `pending` / `processing` / `success` / `error` / `skipped` / `failed`. `error`는 자동 재시도 대상, `failed`는 자동 재시도 종료·사람 확인 필요(재시도 스캔에서 제외) |
| `skipReason` | string \| null | 예: `is_test` |
| `pendingReason` | string \| null | 처리 대기 이유. 스위치가 꺼져 있어 대기 중이면 `intake_disabled`, 가입 직후 중복 판정을 미룬 중이면 `dup_check_delayed`. 처리권을 잡을 때 지운다. `skipped`(영구 제외)와 구분된다 |
| `flags` | map | `{ test, internal }` |
| `profileResult` | map | `{ applied: string[], skipped: { 필드: 사유 } }` |
| `attempts` | number | 최초 처리를 포함한 자동 처리 시도 횟수. **12회**에 도달한 시도가 실패하면 `failed`로 바꾸고 `nextRetryAt`을 비운다 |
| `lastError` | string \| null | 비밀값 제외 |
| `nextRetryAt` | timestamp \| null | 성공·`failed` 시 null. 재시도 조회는 이 단일 필드로(복합 인덱스 불필요). 처리 중 함수가 멈춘 `pending`·`processing` 건도 잠금이 풀리면 다시 집는다 |
| `leaseUntil` | timestamp \| null | 트리거·재시도 동시 실행 방지 |
| `createdAt`, `updatedAt` | timestamp | |

### 중복 방지

- 처음 처리 시 sync 문서를 없을 때만 생성해 처리 권한을 잡고, 단계마다 `steps`를 갱신한다. `leaseUntil`로 동시 실행을 막는다.
- 처리권 잡기(트랜잭션): 문서가 없으면 만든다. `success`·`skipped`·`failed`이거나 lease가 유효하거나, `dup_check_delayed`인데 `nextRetryAt` 전이면 처리하지 않는다. `attempts >= 12`이면 API를 부르지 않고 `failed`로 바꾼다. 그 밖에는 `processing`, `attempts+1`, `leaseUntil=지금+5분`, `nextRetryAt=지금+10분`(함수가 멈췄을 때의 안전망), `pendingReason=null`.
- 성공: `success`, `leaseUntil`·`nextRetryAt`·`lastError` 비움. 실패: 11회째까지 `error` + `nextRetryAt=지금+10분`, 12회째 `failed` + `nextRetryAt` 비움. 둘 다 `leaseUntil` 비움. 함수가 멈추면 `processing`이 남고 lease 만료 후 안전망 시각에 재시도가 다시 집는다.
- **오류 처리 경계(2026-10-02 확정).** 처리 기록을 만들기 전(처리권을 잡기 전: 원본·회원 문서 읽기, 설정 읽기, 처리권 잡기 트랜잭션)의 오류만 트리거 밖으로 던져 Firebase 자동 재실행(`retry: true`)을 안전망으로 쓴다. 기록이 없으면 `channelTalkRetry`가 그 제출을 모르기 때문이다. 다시 실행돼도 처리권 잡기 트랜잭션이 중복을 막는다. 처리 기록을 만들기 전 오류가 24시간(v2 재시도 기간) 넘게 이어지면 그 제출은 Firebase 재시도가 끝나 Channel에 반영되지 않을 수 있다. v1에서는 보완 기능을 두지 않고, 장애 뒤에는 원본 제출과 `channelTalkSync`를 대조해 누락을 확인한다.
- 처리 기록을 만든 뒤의 오류는 던지지 않고 `channelTalkSync`에 남기며, 재시도는 `channelTalkRetry`만 한다(Firebase 재실행에 의존하지 않음). 마지막 `success` 기록만 실패한 경우도 던지지 않고, lease 만료 후 재시도가 남은 단계 없이 `success`로 마무리한다.
- 재시도 묶음에서 한 건이 처리권 잡기 전에 실패해도 다음 건을 계속 처리하고, 실패한 건은 기록이 그대로라 다음 실행이 다시 집는다.
- **상담 생성(대안 A, 2026-10-02 확정):** `steps.chat=creating`과 `chatCreateStartedAt`을 먼저 기록 → 생성 API 호출 → 성공 응답이면 즉시 `userChatId`. 4xx는 미생성 확정이라 단계를 `error`로 두고 다음 시도에 다시 만든다(`possibleOrphanChat=false`). 시간 초과·5xx·함수 종료로 `creating`이 남은 채 다시 들어오면 **조회하지 않고 새로 만들고** `possibleOrphanChat=true`를 남긴다.
  - 근거(T1 실제 검증): API로 만든 `initial` 상담은 메시지가 0개든 내부대화가 있든 `GET /open/user-chats`(state·기준 시각·기간·정렬 6가지 조건)와 고객별 목록 어디에도 나오지 않았다. 이전 요청의 결과를 확인할 방법이 없다.
  - 남을 수 있는 상담은 메시지 없는 `initial` 상담이라 받은편지함·고객 메신저에 보이지 않고 고객 프로필 상담 목록에만 `준비중`으로 남는다. 응답이 유실될 때만 생긴다.
  - 이전 설계의 `initial` 목록 복구, `extraChatIds`, `resolveChatRecovery`, 웹 접수 API 클라이언트의 상담 목록 조회는 제거했다(`functions-ingest`의 별도 클라이언트는 그대로).
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

**Firestore 문서 트리거의 `retry: true` 재실행 기간:** 2세대(v2) 함수는 공식 문서상 재시도 기간이 24시간(1세대는 7일)이며, 간격은 10~600초로 늘어난다(2026-10-06 확인). 처리권을 잡기 전 실패의 마지막 안전망이므로 별도 시간 제한은 두지 않는다(2026-10-02 결정).

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

### 실제 API 검증 T1·T2 (2026-10-02, 테스트 리드 1명)

- **T5 리드 생성:** `POST /open/users`(form, `profile` JSON 문자열) → 200, 응답 `user.id`, `type: lead`, `memberId: null`. 구현과 일치.
- **T1 `initial` 상담 조회: 전제 불성립.** 상담 생성 직후(메시지 0개)와 비공개 내부대화 추가 후 모두 `state=initial`(기본), `state=initial`+`deskUpdatedAt` 기간, `state=initial`+`managedAt` 기간, 상태 생략+`managedAt` 기간, `state=initial`+오래된 순, 고객별 목록에서 나오지 않았다. `state=initial`은 채널 전체 0건. 상담 자체는 생성 직후에도 `deskUpdatedAt`이 채워져 있었고, 내부대화 뒤 `deskUpdatedAt`·`deskMessageId`만 바뀌고 상태는 `initial` 그대로였다. → 대안 A로 변경.
- **T2 내부대화 길이:** 같은 상담에 `private`+`silentToUser`로 4,000 / 8,000 / 16,000 / 32,000자(한국어, 최대 약 86KB) 모두 200, 잘림 없이 저장(끝 공백만 제거됨). 상한은 확인하지 않았다. 운영 분할 기준은 가독성을 위해 4,000자 유지.
- API 호출 누적 26회. 고객에게 보이는 메시지·알림 없음. 상담은 열지 않았다.

### 실제 API 검증 T3·T7 (2026-10-02, 테스트 회원 1명)

- **T3 회원 upsert:** `PUT /open/users/@zz-test-member-20261002-t3` → 200, `member: true`, `type: member`, `memberId` 일치. 같은 요청을 다시 보내자 **`profileOnce`의 이름·이메일이 기존 값을 덮어썼다**(빈 `brandCompanyName`은 채움, `profile.briefStep`은 갱신). → upsert에는 `profileOnce`를 쓰지 않는다.
- **T7 회원 PATCH:** 같은 회원에게 `PATCH /open/users/{id}` → `profileOnce`의 이름·회사(기존 값과 다른 값)는 바뀌지 않고, 빈 `moq`는 5000으로 채워지고, `profile.briefStep`은 3으로 갱신됐다. 태그 `["zz-t7-a"]` 반영 → 병합 `["zz-t7-a","zz-t7-b"]` → `["zz-t7-b"]`만 보내면 `zz-t7-a`가 지워짐(전체 교체).
- API 호출 T3 3회 + T7 7회. 상담·메시지 없음.

### 실제 검증 T4·X12 (2026-10-02, 같은 브라우저 리드 → 서버가 먼저 만든 회원으로 boot)

- 방법: Chrome 시크릿 창 `localhost:3000`에서 익명 boot → `updateUser`로 이메일·이름(리드 L). 서버가 `PUT /open/users/@{memberId}`(`firebaseUid`만)로 회원 M을 먼저 만든 뒤, 같은 페이지에서 `shutdown` → memberId·memberHash로 boot. 상담·메시지는 만들지 않았고 숫자 배지·팝업·알림은 없었다.
- **T4**(M 프로필이 `firebaseUid`뿐): boot 결과는 M. L은 `type: "unified"`, `unifiedId=M`, `memberId: null`, `profile: {}`. L의 자동 UUID 조회는 404. M에 L의 이메일·이름이 옮겨옴. Desk 검색 1명(회원, `[TEST] T4 리드`), 통합 이력 표시 없음.
- **X12**(L: 이메일 A·태그 `zz-x12-l`, M: PATCH로 넣은 이메일 B·이름·태그 `zz-x12-m`): **이메일이 달라도 통합됐다.** M의 이메일·이름은 B·M 값 그대로이고 **A는 어디에도 남지 않았다**(Desk에서 A 검색 0명). 태그는 M에 `["zz-x12-m", "zz-x12-l"]`로 합쳐지고 L은 `tags: null`. L은 `unified`(`unifiedId=M`), 자동 UUID 404. boot 29초 뒤 첫 조회에서 이미 통합돼 있었다.
- 반영: 1장 통합 처리 원칙과 이메일 조건, 5장 중복 후보 판정과 가입 직후 지연, 8장 `unifiedChannelUserIds`·`dupPairs.unified`·`reidentified`.
- API 호출 T4 12회(쓰기 1회), X12 16회(쓰기 3회).

### T8 종합 테스트 (2026-10-02~10-06 종료, Firestore 에뮬레이터 + 실제 처리 코드 + 새 `웹 접수` 키)

- 방법: `demo-medidakos` 에뮬레이터에 제출 문서를 쓰고 트리거와 같은 처리 함수를 직접 호출. 기존 Functions·운영 Firestore는 쓰지 않음. 쓰기 감시로 T8에서 만든 고객·상담에만 쓰기 허용. 새 키는 첫 쓰기부터 권한 문제 없음.
- **배치 A(Contact) 통과.** S1 서버 리드, S2 같은 이메일 매핑 재사용·새 상담, S3 실제 브라우저 익명 고객(이메일 없음)에 이메일 채움, S4 브라우저 고객 이메일이 달라 새 리드(`browser_email_mismatch`, 브라우저 고객에는 쓰기 없음). 내부대화는 모두 `웹 접수` 비공개, 고객 노출 0건, 상담 열림. Desk 확인 이상 없음.
  - S2 분할 판정 기준: 조각 수는 고정하지 않는다. 모든 조각 4,000자 이하, `(n/m)` 순서, 조각마다 `기록:` 줄 1개, 저장 내용이 처리 코드 결과와 일치. 7,409자 입력 → 나누기 전 7,925자 → 섹션 경계 분할로 3개(3,979 / 3,879 / 358자), 누락·중복 없음(문의 내용 끝 공백만 양식이 다듬음).
  - API로 이메일 없는 리드는 만들 수 없다(`POST /open/users`에 이름만 보내면 422). 처리 코드는 항상 이메일을 보내므로 영향 없음.
- **배치 B(Landing 3종) 통과.** korea: `businessType` List, `referralSource`, `firstSource=landing-korea`, 범위 물량이라 `moq` 비움, 국가 항목 없음. catalog: `marketCountry=["미국"]`, `product`, `moq=3000`. dashboard: `marketCountry=["캐나다"]`, `product`(브리프 제품명), `moq=5000`.
- **배치 C(가입·주문).**
  - **S8 가입, 휴대폰 번호 발견:** 회원 프로필 `PATCH`가 `422 VALIDATION_FAILED`(`mobileNumber` 유효하지 않음, 테스트 번호 `+1 555 010 0000`)로 거부되고 이름·이메일·회사·국가도 함께 들어가지 않았다. 그대로면 이 회원의 가입은 12회 재시도 후 `failed`, 주문은 프로필 단계에서 막혀 상담·내부대화가 생기지 않는다. → `mobileNumber` 별도 `PATCH`로 수정(4장, `85f6e1a`).
  - **S8 재시도:** 번호만 422 → `rejected_by_channel`, 나머지 프로필 반영. 가입 직후 중복 판정은 `deferred`, 지연 중 같은 이벤트는 `none`. 10분 뒤 판정 시점에 S1 리드가 회원에 통합돼 있어(회원 이메일 `PATCH` 시점에 통합) 쌍을 `unified`로 기록, `dup-candidate` 없음, 대표 고객을 회원으로 바로 정리. 처리 코드는 설계대로 동작했다.
  - **S9·S10 주문, PUT 덮어쓰기 발견:** 주문마다 보내던 `PUT @memberId`가 회원 프로필을 통째로 바꿔 `firstSource`·`businessType`·`referralSource`가 지워졌다(내부대화 프로필 반영 줄이 이미 있던 값까지 "반영"으로 표시해 발견). → 이미 있는 회원이면 PUT을 보내지 않도록 수정(4장, `8676a35`). 주문 처리 자체는 통과: 회원 상담, `orderCount`·`lastOrderId`·`briefStatus`·`briefStep`·`briefStepLabel`, 두 번째 주문 안내 줄, 번호 거부 표시.
  - **S10b 수정 확인:** 세 번째 주문에서 `GET @memberId` 1회, PUT 0회, 기존 프로필 필드 13개 그대로, 처음 한 번만 넣는 값은 모두 `이미 값 있음`, `orderCount=3`, 회원 상담 1개.
- **배치 D 통과.** S11: X12 실제 데이터(이메일 B 회원에 통합된 리드)를 브라우저 id로, 이메일 A로 제출 → `browser_user_unified_other_email`, X12 리드·회원은 조회만 하고 쓰지 않음, 이메일 A로 새 리드. S13: 스위치 꺼짐 → `pending`/`intake_disabled`/`attempts=0`, API 호출 0회 → 켠 뒤 재시도로 1건만 `success`. S14: 성공한 제출의 이벤트 재전달 → `none`, API 호출 0회. S12(기존 T4 회원에 쓰기)는 제외했다.
- **S15 최종 조회(읽기만).** 고객 11명의 유형·통합 관계, 상담 13개의 연결 고객·열림 상태, 내부대화 수·작성자(`웹 접수`), 고객 노출 메시지 0건, 봇 목록 모두 예상대로.
- **Desk 확인 1·2·배치 D 모두 통과.** 새 필드 7개도 정한 타입(문자열·숫자·List)으로 보였다.
- **수동 병합(X3)은 하지 않았다.** 리드끼리는 통합할 수 없고(채널톡 안내), Desk 고객 화면에 병합 메뉴가 없었다.
- **Channel 측 확인 필요.** Channel 안내상 유니피케이션 시 상담도 통합되어야 하나, 테스트에서는 회원 재 boot 후에도 기존 상담이 최종 회원 고객 화면에 나타나지 않음을 확인하여 Channel 측 확인 필요.
  - 관찰: S8(Open API 이메일 입력으로 통합)과 별도 확인 (a)(같은 브라우저에서 회원 boot로 통합) 모두, 회원 재 boot 뒤에도 상담 `userId`가 통합 전 고객 id 그대로였고 Desk 회원 화면 상담 목록에 없었다. 상담 화면의 통합 전 이름을 누르면 통합 전 고객 화면으로 이동했다. 상담과 내부대화는 받은편지함·검색에 남아 있다.
- **후속 확인사항(이번 범위 밖).**
  - 웹 회원 boot로 먼저 생긴 회원은 가입 처리 전까지 `firebaseUid`가 비어 있을 수 있다(로그인 회원 Contact는 PUT도 `firebaseUid`도 보내지 않음).
  - 같은 회원의 첫 이벤트 두 개가 동시에 "없음"을 보면 PUT이 두 번 나가 첫 번째 `PATCH` 값이 지워질 수 있다.
  - 서로 다른 살아 있는 고객에게 실제 `dup-candidate`가 붙는 경로는 T8에서 재현되지 않아 단위 테스트로만 확인됐다.
  - S10b의 에뮬레이터 기록은 에뮬레이터 복원 때 빠졌다(결과는 실행 기록에 있음).
- **감수한 부수 효과.** `functions-ingest`가 테스트 상담·비공개 내부대화를 운영 Firestore로 복사했을 수 있고, 열린 테스트 상담으로 팀 대기 알림이 갔을 수 있다.
- API 호출 누적 약 255회. 실행 스크립트·테스트 페이지·결과 기록은 저장소가 아닌 세션 scratchpad에만 있다.

### 남아 있는 테스트 데이터 (정리 별도 승인)

- B 리드 `6abdefb2a059ac3264bb`, 상담 `6abdfa1c2223f6eff2b8`, 태그 `zz-integration-test`, `marketCountry` 선택지 `테스트국가`
- C 회원 `6abe09fe96c07cc647f8`(`zz-test-member-20261001`), 상담 `6abe0c7935aa79cd22c2`
- `functions-ingest`가 복사했을 수 있는 Firestore 문서(예상): `threads/channeltalk:main:{상담 id}`, `messages/channeltalk:main:{메시지 id}`, 고객 식별 문서. 미확인
- T1·T2 리드 `6abf39cb127f2dc6f4f1`(`kimbm+chtest-20261002-t1@techasset.co.kr`), 상담 `6abf39cb47cb0a2dcc7a`(`initial`, 비공개 내부대화 6건)
- T3·T7 회원 `6abf3cebb40e1034b29d`(`zz-test-member-20261002-t3`, 이메일은 upsert가 덮어써 `kimbm+chtest-20261002-t3-x@techasset.co.kr`), 태그 `zz-t7-b`
- T6 리드 `6abf3ef5223f5dee06e0`(`kimbm+chtest-20261002-t6@techasset.co.kr`), 상담 `6abf3ef540fea9336064`(열림, `웹 접수` 봇 비공개 내부대화 1건)
- T4 리드 `6abf40b57e5935a2a90c`(unified), 회원 `6abf4193158d3381f6c9`(`zz-test-member-20261002-t4`, `kimbm+chtest-20261002-t4@techasset.co.kr`)
- X12 리드 `6abf461c17151786c431`(unified), 회원 `6abf465ebf1733c354f8`(`zz-test-member-20261002-x12`, `kimbm+chtest-20261002-x12b@techasset.co.kr`, 태그 `zz-x12-m`·`zz-x12-l`)
- T8 고객 11명·상담 13개. 상담은 모두 열림, `웹 접수` 비공개 내부대화
  - S1 리드 `6abf538b8575e64ac808`(unified → S8 회원, Desk 이름 Clover 901), 상담 `6abf538bbff7a8d7108a`(S1)·`6abf538c59964e192a81`(S2)
  - S3 브라우저 고객 `6abf5577af13436eb813`(`t8-c3`), 상담 `6abf60402e16abef20c6`
  - S4 리드 `6abf6040dd58809279de`(`t8-c4`), 상담 `6abf6041183ab5b24de9`
  - 랜딩 리드 `6abf64732e46b2047cac`(`t8-lk`)·`6abf647425d8338976b9`(`t8-lc`)·`6abf6474c98a36f4bfa4`(`t8-ld`), 상담 `6abf64737dbca25f0cce`·`6abf64744d0dd56141e7`·`6abf6474f294673fd9f1`
  - S8 회원 `6abf6566d43222ac5413`(`zz-test-member-20261002-t8`, 이메일 `t8-c1`), 주문 상담 `6abf7507936120675304`·`6abf75086728e584d393`·`6abf770ea52bbfc87904`. `firstSource`·`businessType`·`referralSource`는 수정 전 PUT으로 지워진 상태
  - (a) 브라우저 고객 `6abf6dac79de72f8c2e2`(unified → (a) 회원), 상담 `6abf6dc63c0a3b0a3291`
  - (a) 회원 `6abf6dc70ef55bc28127`(`zz-test-member-20261002-t8u`, 이메일 `t8-ua`)
  - S11 리드 `6ac45380e890c7f10d70`(X12 이메일 A `kimbm+chtest-20261002-x12a@techasset.co.kr`), 상담 `6ac453813c6966305f3c`
  - S13 리드 `6ac453820718cc8c8c2c`(`t8-off`), 상담 `6ac4538248634ab1cc1d`
- 봇 `웹 접수`(763292)는 운영용이라 정리 대상이 아니다
- 0단계 테스트 API 키(로컬 `.env.local`). 폐기 예정
