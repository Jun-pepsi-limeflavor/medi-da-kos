# Channel Talk V2 기술 문서

기준일: 2026-10-21. 이 문서는 현재 코드와 운영에서 확인한 결과만 적는다. 배포 절차의 세부는 [Firebase Functions 운영 배포 가이드](firebase-functions-deployment.md), 설계 근거는 [V1 설계](plans/2026-10-01-channeltalk-crm-integration.md)와 [V2 계획](plans/2026-10-19-channeltalk-v2.md)을 본다. 두 계획 문서의 "상태" 표기는 작성 당시 기준이며, 현재 상태는 이 문서를 따른다.

## 1. 목적과 운영 범위

Channel Talk을 고객 관리의 중심으로 쓴다. 웹사이트 제출과 고객 정보는 Channel Talk 고객 프로필·상담에 연결하고, 고객별 마지막 실제 연락일을 `lastContactAt`에 유지한다.

- **운영 중심:** Contact 문의(신규·재문의)
- **Dashboard(Brief·Order):** 앞으로 쓰지 않는다. 코드와 함수는 유지하며 삭제하지 않는다. 이 경로는 업무 검증 대상이 아니다.
- **백오피스·Notion·수집기(`functions-ingest`):** V2에서 바꾸지 않았다.

### 상태 구분

| 구분 | 기능 |
|---|---|
| 운영 검증 완료 | Contact 신규 문의 → Channel Talk 연동<br>기존 고객 이관(연결 96명·신규 생성 18명, 사후 재조회 비교·Desk 표본 확인)<br>`lastContactAt` 실시간 갱신(고객 메시지·담당자 답변 반영, 내부대화·봇·시스템 로그 제외)<br>과거 기록 백필 135명 |
| 코드 구현·배포, 운영 미검증 | Channel 연동 이메일의 **실시간** 반영(백필에서는 실제 이메일 상담 구조로 판정)<br>일괄 발송(`broadcastedMsg`) 제외 |
| 코드 구현, 업무 검증 안 함 | Landing·Order·회원가입 연동(`channelTalkSync` 성공 기록: Landing 1·Order 1·회원가입 2)<br>Dashboard Brief 단계 표시 |

## 2. V1과 V2

| | V1(2026-10-12 운영 시작) | V2(2026-10-19~21) |
|---|---|---|
| 역할 | 웹 제출이 생길 때마다 고객 식별 → 상담 생성 → 내부대화(원문) → 상담 열기, 프로필 빈 칸 채우기 | 기존 고객 이관 도구, `lastContactAt` 실시간 갱신 웹훅, 과거 기록 백필 |
| 실행 | Firestore 트리거 4개 + 재시도 스케줄(운영 Functions) | 웹훅 1개(운영 Functions) + 로컬 실행 스크립트(이관·백필·점검) |
| 쓰는 값 | `profileOnce`(빈 칸만), 자동 관리 필드(`briefStep`·`orderCount` 등) | 이관·백필은 `profileOnce`만, 웹훅은 `lastContactAt` 하나 |

V2는 V1 처리 코드를 바꾸지 않았다. `functions/index.js`에는 웹훅 내보내기 한 줄만 추가했다.

## 3. 코드와 운영 Functions

리전은 `asia-northeast3`, 프로젝트는 `medidakos`, 런타임은 Node.js 22다.

| 운영 함수 | 코드 | 트리거 |
|---|---|---|
| `channelTalkOnContactCreated` | `functions/channeltalk/triggers.js` → `processor.js` | `contact` 문서 생성 |
| `channelTalkOnLandingCreated` | 같음 | `landingRequests` 생성 |
| `channelTalkOnOrderCreated` | 같음 | `orders` 생성(Dashboard) |
| `channelTalkOnUserCreated` | 같음 | `users` 생성(회원가입) |
| `channelTalkRetry` | 같음 | 10분마다 실패 건 재시도 |
| `channelTalkLastContactWebhook` | `functions/channeltalk/last-contact-trigger.js` → `last-contact.js` | Channel Talk 웹훅(HTTP) |

V1 모듈 역할:
- `identity.js`: 고객 식별·통합 처리
- `profile.js`·`field-types.js`·`market-country.js`: 프로필 값과 타입 규칙
- `notes.js`: 내부대화
- `store.js`·`sync-state.js`: Firestore 기록·처리권·재시도
- `api.js`: Channel 클라이언트

V2 모듈 역할:
- `last-contact.js`: 판정·보호·처리기
- `last-contact-control.js`: 중단 플래그
- `last-contact-backfill.js`: 백필
- `migration-plan.js`·`migration-collect.js`·`migration-apply.js`: 이관

### Firestore 컬렉션(모두 클라이언트 접근 차단, 서버만 사용)

| 컬렉션 | 내용 |
|---|---|
| `channelTalkIdentities/{정규화 이메일}` | 이메일 → 대표 Channel 고객 id, 출처(`member`·`browser`·`server_lead`·`imported`), 회원 uid, 중복 쌍 상태. 현재 118건 |
| `channelTalkSync/{source}_{docId}` | V1 제출별 처리 기록(단계, 재시도, 보류). 현재 20건: 성공 10, OFF 기간 보류 10 |
| `channelTalkControl/lastContact` | `lastContactAt` 쓰기 중단 플래그. 현재 문서 없음(중단 아님) |

## 4. 고객 식별과 매핑

규칙의 원본은 V1 설계 1장이다.

- **사람 키:** 정규화 이메일(소문자·trim)이며, `+` 별칭은 다른 이메일로 본다. 회원은 Firebase uid가 기준이다.
- **Contact 식별 순서**
  1. 로그인 회원(`@uid`)
  2. 브라우저 Channel 고객: 이메일이 비었거나 같을 때만
  3. 이메일 매핑
  4. 서버 리드 생성
- **운영 기록 분포(10-12 이후 성공 건):** 브라우저 4, 회원 4, 이메일 매핑 1, 서버 리드 1
- **재문의:** 같은 이메일이면 매핑으로 기존 Channel 고객에 연결하고, 제출마다 새 상담을 만든다. 기존 open 상담을 재사용하지 않는다.
- **Channel이 통합한 고객:** `unifiedId`를 최대 3단계까지 따라간다. 최종 고객의 이메일이 비었거나 같을 때만 그 고객을 쓴다.
- **다른 기기 등으로 같은 이메일 고객이 둘 이상:** 자동 병합하지 않는다. `dup-candidate` 태그와 담당자 확인으로 처리한다.
- **로그인하지 않은 문의:** 브라우저 고객이나 매핑이 없으면 서버 리드를 만든다. Channel 처리가 실패해도 Firestore 저장과 고객 제출은 실패하지 않으며, `channelTalkRetry`가 다시 시도한다.
- **매핑이 없는 Channel 고객:** `lastContactAt` 웹훅은 매핑을 읽지 않고 Channel 고객 id로만 처리한다. 매핑 여부와 관계없이 동작한다.

## 5. Contact 문의 흐름

1. 웹이 `contact` 문서를 만든다. 브라우저 Channel 고객 id와 로그인 uid는 선택 필드다.
2. `channelTalkOnContactCreated`가 처리권을 잡는다. 같은 제출은 `channelTalkSync` 트랜잭션으로 한 번만 처리된다.
3. 고객을 식별하거나 리드를 만들고 프로필 빈 칸을 채운다.
4. 상담을 만들고, 봇 `웹 접수`가 내부대화(`private`·`silentToUser`)로 원문을 남긴 뒤 상담을 연다.
5. 고객에게는 메시지·알림을 보내지 않는다.

위 내부대화·봇·상담 열기 기록은 웹훅에 들어와도 `lastContactAt`을 바꾸지 않는다(운영 로그로 확인). 즉 **폼 제출 자체는 마지막 연락일이 아니다.**

## 6. 기존 고객 이관(V2, 로컬 스크립트, 완료)

- **방식:** 읽기 전용 dry-run → Pilot → 전체 순서. 결과는 저장소 밖 비공개 폴더에만 남겼다.
  - `functions/scripts/channeltalk-migration-dry-run.mjs`
  - `functions/scripts/channeltalk-migration-apply.mjs`
- **결과**
  - 기존 Channel 고객 연결 96명(빈 칸만 `profileOnce`)
  - 신규 생성 18명: 회원 10명은 `@uid`로 만들고 이메일은 보내지 않았음, 리드 8명은 Desk 이메일 검색으로 중복이 없음을 확인
  - 모두 쓰기 후 다시 조회해 비교했고 다른 필드 변경 0건
- **이관 제외(정책 파일, 비공개):** 보류 4명(회원·리드 이메일 충돌, 계정 하나에 이메일 여러 개, 이름 일치), `buyers`에만 있는 12명
  - 실행 스크립트는 정책 파일(`--policy-exclude`) 없이는 실행하지 않는다.
  - 이 정책은 과거 데이터 이관에만 적용하며, V1 실시간 연동은 막지 않는다.
- **OFF 기간 보류 10건:** V1 기록(`pendingReason: intake_disabled`)은 그대로 두었다. V1이 다시 처리하지 않는다.

## 7. lastContactAt

Channel Talk 고객별 마지막 실제 연락일이다. 상담방별 값이 아니라 고객 단위이며, 분 단위로 저장한다.

### 반영 조건(웹훅·백필 공통, `classifyEvent`)

| 메시지 | 처리 |
|---|---|
| 고객 메시지, 담당자 일반 답변(`chatType=userChat`, `personType` user·manager) | 반영 |
| Channel 연동 이메일(`writingType=email`) | 반영(실시간 경로는 운영 미검증) |
| 내부대화(`options`에 `private`·`silentToUser`) | 제외 |
| 봇(`personType=bot`), 시스템 로그(`log`), 팀챗(`chatType=group`) | 제외 |
| 일괄 발송(`broadcastedMsg`) | 제외 |
| 확인되지 않은 작성 유형, 고객 참조 불일치, 시각 형식 오류 | 반영하지 않음(보류) |

- **여러 상담방:** 고객의 모든 상담방에서 가장 최근 유효 메시지 시각을 쓴다. 저장된 값보다 새로울 때만 쓰므로 늦게 온 이벤트나 같은 분의 이벤트로 되돌아가지 않는다.
- **동시 처리:** 함수는 최대 인스턴스 1·동시 처리 1이고, 처리기 안에서도 쓰기 구간을 직렬화한다.

### 고객 정보 보호

- **보내는 값:** `{ profile: { lastContactAt } }` 하나뿐이다.
- **쓰기 전 검사**
  - 다시 조회해 고객이 없거나 통합됐으면 쓰지 않는다.
  - 타입이 정해진 필드(`moq`·`orderCount`·날짜 필드·`businessType`·`marketCountry`)에 타입 이상이 있으면 쓰지 않는다.
- **쓰기 후 검사:** 다시 조회해 고객 전체를 비교한다.
  - Channel이 방문·메신저 활동으로 스스로 바꾸는 필드는 이름만 로그(`auto`)에 남긴다. 대상은 `city`·`latitude`·`longitude`·`popUpChatId`·`profile.analyticsId`·`profile.gaClientId`·`web`의 `browser`/`lastSeenAt`/`sessionsCount`이며, 같은 타입으로 바뀐 경우만 해당한다.
  - 그 밖의 변화(업무 필드, 고객 정보, 의미를 모르는 `managedKey` 등)는 **이상**으로 본다.
- **이상 감지 시:** Firestore 중단 플래그를 기록하고 이후 쓰기를 모두 멈춘다. 플래그를 읽지 못해도 쓰지 않는다(fail-closed). 재시작 뒤에도 유지된다.
- **해제:** 관리자가 원인을 확인한 뒤 수동으로만 한다(8장).
- **인증:** 수신 URL의 토큰(`?auth=`, Secret `CHANNELTALK_WEBHOOK_TOKEN`)이 맞지 않으면 401을 돌려주고 처리하지 않는다. Channel 측 서명 헤더는 확인하지 않았다.

### 과거 기록 백필(완료)

- **스크립트:** `functions/scripts/channeltalk-last-contact-backfill.mjs`(예측 → 계획 → Pilot → 전체)
- **상담 수집:** 종료 상담 전체 목록은 최근 100개까지만 나온다(확인함). 그래서 전체 상담 목록과 고객별 상담 목록(v5)을 상담 id로 합친다.
  - 대상 고객 id 217명: 전체 상담 목록 156명, Firestore 기록에서만 76명
  - 상담 312개: 고객별 목록에만 82개, 전체 목록에만 8개
- **쓰기:** `profileOnce`로 **비어 있는 고객만** 채운다. 그 사이 웹훅이 더 최신 값을 넣었으면 그 값이 유지된다.
- **결과(2026-10-21)**
  - 반영 135명: Pilot 3명 + 전체 132명. 오류·건너뜀·다른 필드 변경 0건
  - 반영하지 않음: 유효 연락 없음 76명, 삭제 3명, 이미 값 있음 1명, 다른 이메일 고객과 통합돼 검토 필요 2명
- **사전 타입 점검:** 고객 212명을 점검해 타입 이상 0건이었다.

## 8. 운영 설정·배포·모니터링

### 환경변수와 Secret

운영값은 추적되는 `functions/.env` 한 곳에서 관리한다. 근거는 [배포 가이드 3-1](firebase-functions-deployment.md#3-1-lastcontactat-웹훅-운영-설정).

| 이름 | 종류 | 운영값 |
|---|---|---|
| `CHANNELTALK_INTAKE_ENABLED` | `functions/.env` | `true`(V1 접수) |
| `CHANNELTALK_LAST_CONTACT_MODE` | `functions/.env` | `on`(`off`·`observe`·`on`) |
| `CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS` | `functions/.env` | `*`(전체). `""`이면 쓰기 없음 |
| `CHANNELTALK_INTAKE_ACCESS_KEY` / `_SECRET` | Secret Manager | V1 접수와 웹훅 쓰기에 사용 |
| `CHANNELTALK_WEBHOOK_TOKEN` | Secret Manager | 웹훅 수신 URL 토큰 |

- 웹훅 실행 서비스 계정은 `webhook-sa`다. 필요한 권한은 Secret 3개 접근과 Firestore 읽기·쓰기(중단 플래그)다.
- 에뮬레이터·로컬 실험은 `functions/.env.local`에서 `MODE=off`로 둔다. `functions/.env.medidakos`에는 위 두 키를 넣지 않는다.

### 배포 전 점검(읽기 전용)

```bash
node functions/scripts/check-last-contact-config.mjs --compare-deployed
```

다음 경우 실패한다.
- 값 형식 오류
- 추적하지 않는 파일이 운영값을 덮어씀
- 운영 함수 설정과 다름

`functions/.env`에 커밋하지 않은 변경이 있으면 경고한다. 배포는 `--only`로 이 함수만 하며, 원칙은 배포 가이드를 따른다.

### 모니터링과 장애 대응

- **로그:** `channelTalkLastContact` 이름으로 남는다. 결과(`outcome`)는 `updated`·`observed`·`skip`·`alert`·`error`이고, `reason`·`skipReason`은 사유 코드다. 본문·이메일·id는 남기지 않는다.
- **즉시 확인할 로그:** `alert`(다른 필드 변화 감지 → 중단 플래그 기록), `halt_check_failed`(플래그를 읽지 못해 쓰기 중단), `rejected`(인증 실패)
- **중단 상태 확인·해제:** 해제는 원인을 확인한 뒤에만 한다.
  - 상태 확인: `node functions/scripts/channeltalk-last-contact-control.mjs`
  - 해제: `node functions/scripts/channeltalk-last-contact-control.mjs --resume --resumed-by <이름> --confirm-resume`
- **잠시 멈추기:** `MODE=observe`로 바꿔 커밋한 뒤 이 함수만 다시 배포한다.
- **1명 수동 검증:** `functions/scripts/channeltalk-last-contact-single-check.mjs`. 기본은 dry-run이며, 쓰기는 명시 옵션을 줬을 때 지정한 1명에게 1회만 한다.

## 9. 미검증·예외·알려진 한계

- **실시간 연동 이메일:** 운영 이벤트로 아직 확인하지 않았다. 백필에서는 실제 이메일 상담(`writingType=email`)을 같은 규칙으로 처리했다.
- **Landing·Order·회원가입·Brief:** 연동 업무 검증을 하지 않았다. Dashboard는 쓰지 않을 예정이다.
- **찾지 못한 Channel 고객:** Open API에는 전체 고객 목록이 없다. 그래서 상담이 없거나 오래된 종료 상담만 있는데 Firestore 기록도 없는 고객은 백필 대상에서 빠졌을 수 있다(Desk 약 228명, 확인된 고객 212명). 이 고객들도 새 메시지가 오면 웹훅이 갱신한다.
- **예외 고객**
  - 통합·이메일 불일치로 검토가 필요한 2명(백필), 이관 보류 4명, `buyers` 전용 12명은 자동 처리하지 않는다. 목록은 비공개 폴더에 있다.
  - 삭제된 고객은 건너뛴다.
- **Channel 측 확인이 필요한 동작:** 고객이 통합된 뒤 기존 상담이 회원 화면에 보이지 않는 현상(V1 단계 관찰)
- **오탐으로 멈출 수 있음:** 같은 순간 V1이나 담당자가 프로필을 고치면 이상으로 판단해 쓰기가 멈출 수 있다. 데이터는 손상되지 않으며, 확인 후 수동으로 해제한다.
- **배포 직후 겹침:** Cloud Run 최대 인스턴스 1은 배포 직후 잠깐 넘을 수 있다. 같은 고객 이벤트가 그 순간 겹치면 날짜가 역행할 가능성이 아주 작게 남는다.
- **비공개 자료:** 이관·백필 결과, 제외 정책, 백업은 저장소 밖 비공개 폴더에만 있다. 인수인계 방법은 별도로 정해야 한다.
