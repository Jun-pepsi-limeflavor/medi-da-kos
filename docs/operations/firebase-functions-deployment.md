# Firebase Functions 운영 배포 가이드

## 1. 목적

Medidakos Firebase Functions의 Node.js 20 → 22 업그레이드를 안전하게 배포하기 위한 운영 절차다.

- 코드 변경은 dev에서 검증한 뒤 main에 병합한다.
- 운영 배포는 main 병합 후 별도로 진행한다.
- 기존 Notion·메일·Channel Talk 기능을 보호한다.
- 승인된 함수만 선택적으로 배포한다.
- 배포 후 런타임과 실제 기능을 검증한다.

## 2. 현재 운영 환경 (2026-10-13 기준)

- Firebase Functions: 총 12개
- Functions 버전: v2
- 리전: asia-northeast3
- 메모리: 256MB
- 운영 런타임: nodejs20
- 로컬 코드 런타임 설정: nodejs22
- Firebase 프로젝트 별칭: default
- 코드베이스: default / ingest

실제 프로젝트 ID는 배포 직전에 확인한다.

### default 코드베이스: 운영 함수 11개

Channel Talk V1:
- channelTalkOnContactCreated
- channelTalkOnLandingCreated
- channelTalkOnOrderCreated
- channelTalkOnUserCreated
- channelTalkRetry

기존 함수:
- lifecycleScan
- onContactCreated
- onLandingRequestCreated
- onOrderCreated
- onSampleRequestCreated
- onUserSignup

### ingest 코드베이스: 운영 함수 1개

- ingestGmail

### 배포 제외 함수

`notionEmailHistorySync`

로컬 코드에는 정의되어 있지만 2026-10-13 운영 함수 목록에는 없다.

이 함수는 10분마다 Notion CRM의 이메일 이력을 동기화한다. 별도 검토와 승인 전까지 신규 배포하지 않는다.

## 3. 배포 전 필수 확인

- [ ] dev의 변경 사항이 main에 병합되었는지 확인
- [ ] main의 최신 커밋으로 작업 중인지 확인
- [ ] Git 작업 디렉터리가 깨끗한지 확인
- [ ] 두 코드베이스의 Node.js 22 설정 확인
- [ ] 로컬 테스트 및 문법 검사 통과
- [ ] Firebase CLI 로그인 계정과 대상 프로젝트 ID 확인
- [ ] 운영 중인 Functions 목록과 런타임 확인
- [ ] .env 파일의 필수 설정 및 Firebase Secret 접근 상태 확인
- [ ] lastContactAt 웹훅 설정 점검 통과: `node functions/scripts/check-last-contact-config.mjs --compare-deployed` (아래 3-1)
- [ ] 기존 Notion·메일·Channel Talk 기능의 현재 정상 상태 확인
- [ ] npm audit의 High/Critical 취약점 영향 검토
- [ ] 배포 대상, 순서, 작업 시간 및 담당자 승인
- [ ] 문제 발생 시 복구에 사용할 이전 정상 커밋 확보

API 키, Secret 값, 고객 개인정보를 터미널 출력이나 문서에 기록하지 않는다.

### 3-1. lastContactAt 웹훅 운영 설정

`channelTalkLastContactWebhook`의 운영값은 **`functions/.env`(Git 추적) 한 곳**에서 관리한다. 비밀이 아닌 배포 파라미터라 클론만으로 같은 설정이 배포돼야 한다.

| 키 | 운영값 | 의미 |
|---|---|---|
| `CHANNELTALK_LAST_CONTACT_MODE` | `on` | `off`(아무것도 안 함) · `observe`(판정만 로그) · `on`(쓰기) |
| `CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS` | `*` | `""`(쓰기 없음) · `*`(전체 고객) · 쉼표 구분 고객 id |

- `functions/.env.medidakos`(추적 안 함)에는 이 두 키를 넣지 않는다. 넣으면 저장소 값보다 우선해 사람마다 배포 결과가 달라진다.
- 에뮬레이터·로컬 실험은 `functions/.env.local`(추적 안 함)에 `CHANNELTALK_LAST_CONTACT_MODE=off`를 둔다. 에뮬레이터에는 웹훅 토큰 Secret이 없어 인증이 모두 거부되므로, 실수로 켜도 고객 정보는 바뀌지 않는다.
- 운영을 잠시 멈추려면 `MODE=observe`로 바꿔 커밋하고 이 함수만 다시 배포한다. 이상이 감지돼 멈춘 경우의 확인·해제는 `node functions/scripts/channeltalk-last-contact-control.mjs`(관리자 수동 해제만 가능)로 한다.
- 배포 전 점검 스크립트는 다음 경우 실패한다.
  - 값 형식 오류
  - 로컬 파일이 운영값을 덮어씀
  - 운영 함수 설정과 다름(`--compare-deployed`)
  - `functions/.env`에 커밋하지 않은 변경이 있으면 경고한다.

## 4. 배포 명령어 원칙

전체 배포 명령어를 사용하지 않는다.

사용 금지:
- `firebase deploy --only functions`
- `firebase deploy --force`

함수별 선택 배포 형식:

`firebase deploy --project <PROJECT_ID> --only functions:default:<FUNCTION_NAME>`

`firebase deploy --project <PROJECT_ID> --only functions:ingest:ingestGmail`

`<PROJECT_ID>`는 실제 운영 프로젝트 ID로 대체한다.

여러 함수를 쉼표로 지정할 수 있으나, 실제 배포 대상과 순서는 별도 검토 후 확정한다.

배포 전 dry-run 예시:

`firebase deploy --project <PROJECT_ID> --only functions:default:channelTalkRetry --dry-run`

dry-run은 실제 함수를 배포하지 않지만 프로젝트의 API를 활성화할 수 있으므로 대상 프로젝트와 권한을 확인한 뒤 실행한다.

dry-run 성공만으로 운영 배포의 안전성이 보장되지는 않는다.

## 5. Node.js 22 운영 배포 절차

1. main 병합과 대상 커밋을 확인한다.
2. 운영 함수 목록을 다시 조회한다.
3. 배포 대상 함수와 코드베이스를 명시한다.
4. 환경변수·Secret·권한 및 의존성을 점검한다.
5. 선택한 함수에 대해 dry-run을 실행한다.
6. 승인된 순서에 따라 함수를 선택 배포한다.
7. 각 배포 결과와 오류 로그를 확인한다.
8. 운영 런타임 및 실제 기능을 검증한다.

`notionEmailHistorySync`는 배포 대상에 포함하지 않는다.

운영 중인 다른 함수의 삭제 또는 신규 생성 요청이 나타나면 배포를 중단하고 원인을 확인한다.

## 6. 배포 후 검증

조회 명령어:

`firebase functions:list`

확인 항목:
- [ ] 배포 대상 함수의 Runtime이 nodejs22로 표시됨
- [ ] 기존 운영 함수가 누락되지 않음
- [ ] 승인되지 않은 신규 함수가 생성되지 않음
- [ ] Firestore 신규 문의 → Channel Talk 연동 정상
- [ ] 대시보드 주문 → Channel Talk 연동 정상
- [ ] Channel Talk 재시도 스케줄 정상
- [ ] lastContactAt 웹훅: 설정 점검(`--compare-deployed`)이 통과하고, 로그(`channelTalkLastContact`)에 `alert`·`halt_check_failed`가 없음
- [ ] 기존 이메일 발송 및 Notion 관련 기능 정상
- [ ] ingestGmail 스케줄 정상
- [ ] 함수 실행 로그에 새로운 오류 없음
- [ ] 실제 고객 데이터의 중복 처리나 예상치 못한 변경 없음

운영 검증은 기존 기록 및 로그를 우선 사용한다. 신규 테스트 데이터 생성이나 실제 메일 발송은 별도 승인 후 진행한다.

## 7. 장애 대응 및 복구

문제가 발견되면 추가 배포를 중단한다.

1. 영향을 받은 함수와 배포 시각을 기록한다.
2. Firebase 및 Cloud Logging에서 오류를 확인한다.
3. 고객 데이터와 외부 시스템에 미친 영향을 파악한다.
4. 이전 정상 커밋과 당시 런타임·설정을 확인한다.
5. 담당자 승인 후 해당 함수만 선택적으로 복구한다.
6. 복구 후 로그와 실제 기능을 다시 검증한다.

Git revert만으로 운영 함수가 자동 복구되지는 않는다.
이전 코드 재배포 역시 런타임 지원 여부, 환경변수, Secret, 권한을 확인해야 한다.

## 8. 후속 작업

- npm audit High/Critical 취약점 별도 검토 및 대응
- 배포 결과, 담당자, 대상 함수, 커밋 기록
- 운영 점검 결과 문서화
- V1 운영 안정화 확인 후 V2 개발 진행
