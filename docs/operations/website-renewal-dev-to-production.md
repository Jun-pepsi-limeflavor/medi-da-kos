# 신규 홈페이지 dev → 운영 전환 마스터 문서

- 목적: dev Firebase(`dev-medidakos-b9b4f`)·Vercel staging에서 개발·검증한 기능을 운영 Firebase(`medidakos`)·Vercel Production으로 안전하게 옮기기 위한 설정·검증 기록
- 작성: 2026-11-12 (첫 작업 기록: Firebase Authentication 검증)
- 갱신 방법: 기능을 dev에서 검증할 때마다 C장의 해당 표와 맨 아래 "작업 기록"에 한 줄씩 추가한다. 확인한 사실은 날짜·확인 방법과 함께, 확인하지 않은 것은 **미확인**으로 적는다.
- 기록 금지: Secret·API Key·비밀번호·토큰·서비스 계정 키의 실제 값. 이름과 설정 여부만 적는다.
- 전제: 운영 Firestore의 기존 고객·회원 데이터는 그대로 보존한다. 운영 설정이 dev와 같다고 가정하지 않는다.

관련 문서(중복 작성하지 않고 여기서 참조):

| 문서 | 다루는 내용 |
|---|---|
| [website-renewal-production-cutover.md](../plans/website-renewal-production-cutover.md) | 운영 Functions·Scheduler·Secret·Rules의 단계별 전환·삭제·복구 절차(가장 상세) |
| [firebase-functions-deployment.md](firebase-functions-deployment.md) | Functions 선택 배포 명령과 금지 명령 |
| [firebase-collections-and-mail.md](firebase-collections-and-mail.md) | Firestore 컬렉션과 알림 메일 구조 |
| [channeltalk-v2.md](../integrations/channeltalk-v2.md) | Channel Talk 연동 설계 |
| [meta-pixel.md](../integrations/meta-pixel.md) | Meta Pixel |
| 「medidakos dev 베타 서버 인수인계」(2026-11-09, Notion) | dev 환경 구축 배경·dev 전용 권한 |

---

## A. 환경 구분

| 구분 | 로컬 (feature 브랜치) | Vercel staging | Vercel Preview | Vercel Production |
|---|---|---|---|---|
| 브랜치 | `feat/website-renewal` 등 | `dev` (Custom Environment `staging`) | 그 밖의 브랜치 | `main` |
| 도메인 | `localhost:3000` | `dev.medidakos.com` (Vercel 팀 로그인 보호) | `*.vercel.app` | `www.medidakos.com`, `medidakos.com` |
| Firebase | `dev-medidakos-b9b4f` (`.env.development.local`) | `dev-medidakos-b9b4f` | `dev-medidakos-b9b4f` | `medidakos` |
| 테스트 데이터 표시 | `isTest: true` | `isTest: true` | `isTest: true` | `isTest: false` (`?qa=1`이면 true) |

- `isTest`는 `isNonProductionEnv()`(`src/lib/utils/env-flags.ts`)가 **도메인**으로 판정한다(www 유무 무관, 운영 도메인이 아니면 테스트).
- 로컬 명령과 연결 프로젝트: `npm run dev`·`build:local`·`start:local` → dev(운영이면 시작 차단), `npm run build` → `.env.local` 기준(운영). 자세한 내용은 CLAUDE.md "실행 환경".
- Firebase CLI: `.firebaserc`의 `default`·`dev` = `dev-medidakos-b9b4f`, `prod` = `medidakos`. 운영 작업은 항상 `-P prod`를 명시한다.

**코드 배포와 Firebase 배포는 별개다.**

| 종류 | 반영 방법 | 반영 대상 |
|---|---|---|
| 웹 코드(Next.js) | Git push → Vercel 자동 빌드 (`dev` → staging, `main` → Production) | 화면·브라우저 SDK 동작·Next.js 서버 라우트 |
| Vercel 환경변수 | Vercel 설정 변경 **후 재배포** (`NEXT_PUBLIC_*`는 빌드 때 코드에 박힘) | 해당 환경의 다음 배포부터 |
| Firestore Rules·Indexes | `firebase deploy --only firestore:rules -P <dev\|prod>` (승인 후) | Firebase 프로젝트 전체, 브랜치와 무관 |
| Functions·Scheduler·Secret | `firebase deploy -P <dev\|prod> --only functions:<이름>` 선택 배포 (승인 후) | 지금 로컬 폴더의 소스가 그대로 올라감(브랜치 무관) |
| Firebase Auth·Console 설정 | Firebase Console에서 프로젝트별로 직접 설정 | 해당 프로젝트 |

---

## B. 환경별 설정 현황

| 항목 | 로컬 | staging | Preview | Production | 확인일·방법 |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (6개) | dev 값 | dev 값 | dev 값(staging과 같은 1벌) | 운영 값(별도 1벌) | 2026-11-11 Vercel API — 로컬 dev 값과 staging 값 6개 일치 확인 |
| `FIREBASE_SERVICE_ACCOUNT_B64` | 없음 | 있음(Sensitive) | 있음(Sensitive) | 있음(Sensitive) | 2026-11-12 Vercel API(이름·환경만). 값이 해당 프로젝트 키인지는 **미확인** |
| `NEXT_PUBLIC_USE_MOCK_AUTH` | 실행 명령으로 지정 | 없음(실제 인증) | 있음(Sensitive, 값 **미확인**) | 있음(Sensitive, 값 **미확인**) | 2026-11-12 Vercel API |
| `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY` | `.env.local` 운영 채널 키 | 있음(staging 전용, Config) — **다음 배포부터 적용** | 있음(Production과 공용) | 있음 | 2026-11-12 Vercel API. 사용자 등록 11-12 16:16 KST |
| `CHANNEL_TALK_MEMBER_HASH_SECRET` | `.env.local`에 있음 | 있음(staging 전용, Sensitive) — **다음 배포부터 적용** | 있음(Production과 공용) | 있음 | 2026-11-12 Vercel API. 사용자 등록 11-12 16:19 KST |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | `.env.local` | 모든 환경 같은 1벌 | 〃 | 〃 | 2026-11-11 Vercel API. dev/운영 분리는 이사님 결정 대기 |
| Vercel Node 버전 | (로컬 Node 22) | 24.x | 24.x | 24.x | 2026-11-11 Vercel API. 저장소에 `engines`·`.nvmrc` 없음 |
| 최근 배포 | — | `dev` dc6a449 READY (11-06) | `feat/website-renewal` 29f588b **ERROR** (11-09, `next/font/google`) | `main` a8c15e6 READY (11-06) | 2026-11-12 Vercel API |
| Auth 승인 도메인 | dev: `localhost`, `dev-medidakos-b9b4f.firebaseapp.com`, `dev-medidakos-b9b4f.web.app`, `dev.medidakos.com` | | `*.vercel.app` 없음 | 운영 **미확인** | 2026-11-12 Identity Toolkit API(dev, 읽기 전용) |
| Auth 로그인 방식(Email/Password·Google) | dev: Email/Password 사용, Google 사용(클라이언트 설정 있음), 이메일 열거 보호 켜짐, 비밀번호 정책 없음(앱이 8자 검사), 차단 함수 없음 | | | 운영 **미확인** | 2026-11-12 Identity Toolkit API(dev, 읽기 전용) |
| Firestore Rules 배포본 | dev 배포본(2026-11-06)이 레포 `firestore.rules`와 동일 | | | 운영에 `channelTalkControl` 규칙 미배포(인수인계 문서), 운영 배포본 비교 **미확인** | 2026-11-12 Firebase Rules API(dev, 읽기 전용) |
| Functions | dev 5개 배포(webhook 제외) | | | 운영 13개 | 2026-11-11 `firebase functions:list` |
| Secret 이름 | dev: Channel Talk 5개 | | | 운영: Channel Talk 5개 + `NOTION_API_KEY` | 2026-11-11 `gcloud secrets list` |

---

## C. 기능별 운영 전환 체크리스트

각 표의 "배포 상태"는 `미구현 / dev 코드만 / staging 반영 / 운영 반영` 중 하나로 적는다.

### C-1. Firebase Authentication

| 항목 | 내용 |
|---|---|
| dev 구현·설정 | 기존 `src/lib/auth/auth-context.tsx` 그대로: Email/Password(`createUserWithEmailAndPassword`·`signInWithEmailAndPassword`), Google(`signInWithPopup`, 가입·로그인 겸용), `onAuthStateChanged`로 상태 유지(기본 브라우저 로컬 저장), Navbar Log out(`signOut`). 로그인·가입 후 Home으로 이동, 로그인 상태로 `/login`·`/signup`에 오면 Home으로 이동. 가입 시 `users/{uid}` 저장(`saveUserProfile`) |
| 입력 규칙 | Sign Up 필수: Full name·Email·Password(8자 이상). 선택: Phone number·Country·Company name(빈 문자열로 저장). Log In 필수: Email·Password. 오류 문구는 `auth-errors.ts`(이메일 열거 방지 시 `invalid-credential` 하나로 안내) |
| 검증 결과 (2026-11-12) | 코드 분석 + 단위 테스트(`tests/auth/*`) + Mock 화면 검증(가입·필수 오류·선택 항목 공란 가입). 사용자 문서 규칙은 Emulator 테스트(`tests/rules/users.test.mjs`·`user-profile.test.mjs`) 통과. **실제 dev Firebase 가입·로그인·Google 로그인은 미실행**(테스트 계정 미준비) |
| dev 실제 테스트 (2026-11-12) | **이메일 가입 성공**(로컬 `npm run dev` → `dev-medidakos-b9b4f`, Channel Talk·GA·Meta 키는 비우고 실행). 테스트 주소 `kimbm+chtest-20261112-auth01@techasset.co.kr`, 선택 항목 3개 공란. Auth: provider `password`, uid `ydpAt…`(이메일 미인증 상태 — 인증 메일 흐름 없음). Firestore `users/{uid}`: 허용 키 9개, `isTest: true`, `phone`·`country`·`companyName` = 빈 문자열, `provider: email`. `onUserSignup`: `mail/signup_member_*`(수신 1)·`mail/signup_admin_*`(수신 4) 모두 `SUCCESS`, 사용자가 환영 메일·관리자 알림 4건 실제 수신 확인. 함수 로그 오류 없음. 가입 후 Home 이동·Log out 표시 확인(사용자) |
| dev 이메일 로그인 테스트 (2026-11-12) | 사용자 실행: 새로고침 후 로그인 유지 ✓, Log out → Log in ✓, 틀린 비밀번호 → 버튼 위 `Invalid email or password.` ✓, 올바른 비밀번호 재로그인 → Home·Log out ✓. dev Auth `lastLoginAt` 2026-11-12T06:04:02Z로 갱신 확인(읽기 전용). 미가입 주소 `kimbm+chtest-20261112-nouser@techasset.co.kr` → 형식 오류 없이 버튼 위 `Invalid email or password.`(틀린 비밀번호와 같은 문구, 이메일 열거 보호) ✓ — 첫 시도의 `Enter a valid email address.`는 입력값 차이(형식 검사에서 Firebase 요청 전에 막힘)로 확인. 이메일 형식 규칙은 기존 HTML `type=email` 규칙 그대로(공백·@ 두 개·끝 마침표·한글·전각 ＠·쉼표는 오류) |
| 발견·수정 (2026-11-12) | 기존 사용자가 Google로 다시 로그인하면 `users` 문서의 전화번호·국가·회사명을 빈 값으로 덮어쓰던 문제 → 기존 문서에는 빈 값을 쓰지 않도록 수정(`src/lib/firebase/user-profile-write.ts`, 테스트 `tests/auth/user-profile-write.test.ts`). 새 문서 모양·규칙은 그대로. **아직 미커밋·미배포** |
| 운영에 동일하게 적용 | 같은 코드. 운영 Firebase Console의 Email/Password·Google 사용 설정 |
| 운영에서 다르게 | Auth 승인 도메인: `www.medidakos.com`, `medidakos.com`(+ `medidakos.firebaseapp.com`). 운영 회원은 운영 Auth에만 있고 dev와 공유되지 않음 |
| 환경변수 | `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`, `NEXT_PUBLIC_USE_MOCK_AUTH`(운영은 없음 또는 `false`) |
| 주의 | 가입하면 `onUserSignup`이 **가입자 환영 메일 + 관리자 알림 메일을 실제로 발송**(dev 포함, `isTest`와 무관). Google 첫 로그인도 가입과 같음. 운영 Production에 `NEXT_PUBLIC_USE_MOCK_AUTH` 값 확인 필요. Mock 관리자 테스트 비밀번호가 클라이언트 번들에 포함되는 문제(E장) |
| 검증 방법 | 아래 "dev 실제 인증 테스트 절차" |
| 배포 상태 | 인증 코드: 운영 반영(기존 기능). 리뉴얼 화면·선택 입력·덮어쓰기 수정: dev 코드만 |

dev 실제 인증 테스트 절차(승인 후, 테스트 계정 준비 뒤):

1. (2026-11-12 확인 완료) dev Email/Password·Google 사용 중, 승인 도메인에 `localhost`·`dev.medidakos.com` 포함
2. 승인 받은 테스트 메일 주소만 사용(실제 고객 주소 금지). Channel Talk까지 볼 때만 `이름+chtest-날짜@techasset.co.kr`
3. 로컬 `npm run dev`(시작 메시지가 `dev-medidakos-b9b4f`인지) 또는 `dev.medidakos.com`에서 가입 → dev Auth 사용자와 dev Firestore `users/{uid}`(`isTest: true`) 생성 확인
4. 환영·관리자 메일 수신 확인, `firebase functions:log -P dev --only onUserSignup`
5. 로그아웃 → 재로그인, 틀린 비밀번호·미가입 주소 오류 문구 확인
6. Google: 새 계정 가입, 같은 이메일 계정 재로그인 시 전화·국가·회사명이 유지되는지(위 수정 확인)
7. Preview(`*.vercel.app`)에서는 Google 로그인이 승인 도메인 오류로 실패하는 것이 정상(Email 로그인은 가능)

### C-2. Firestore Rules·Indexes

| 항목 | 내용 |
|---|---|
| dev 구현·설정 | 레포 `firestore.rules`가 기준. 기본 전부 거부, `users`·`contact`·Channel Talk 장부 등. `firestore.indexes.json`은 레포에 없음 |
| 검증 결과 | Emulator 규칙 테스트(`npm test`) 통과(2026-11-12). dev 배포본 = 레포(2026-11-12 확인). 운영 배포본 일치 여부 **미확인** |
| 운영에 동일하게 적용 | 승인된 규칙 변경을 dev 확인 후 `-P prod`로 배포 |
| 운영에서 다르게 | 없음(같은 파일). 단 운영에는 기존 고객 데이터가 있으므로 규칙 강화 시 기존 쓰기 경로 영향 확인 |
| 주의 | `contact` 생성 규칙이 `message`를 필수(길이 1 이상)로 요구 → 리뉴얼 Contact(Message 선택 입력)와 충돌. Contact 연동 때 규칙 변경 + Emulator 테스트 필요. `--dry-run`도 실제 반영된 사례가 있어 승인 없이 실행하지 않음 |
| 배포 상태 | `channelTalkControl` 규칙: 운영 미배포(인수인계 문서) |

### C-3. Firebase Functions·Scheduler·Secrets

운영 절차는 [website-renewal-production-cutover.md](../plans/website-renewal-production-cutover.md)를 따른다. 요약:

| 항목 | 내용 |
|---|---|
| dev | 5개 배포(`onUserSignup`, `onContactCreated`, `channelTalkOnUserCreated`, `channelTalkOnContactCreated`, `channelTalkRetry`). `channelTalkLastContactWebhook`은 운영 서비스 계정 고정 때문에 미배포 |
| 운영 | 13개(리뉴얼 소스에 없는 7개 포함 — 삭제는 별도 승인) |
| 다르게 설정 | `functions/.env.medidakos` / `.env.dev-medidakos-b9b4f`(Git 제외, 로컬 전용). `CHANNELTALK_INTAKE_API_VERSION` 값이 로컬 두 파일에서 서로 다름(운영 `2026-06-01`, dev `2026-10-01`) — 운영 배포값·로그 확인 필요 |
| 주의 | 전체 배포 금지, 함수 이름을 지정한 선택 배포만. dev 메일은 운영 `mail-ingest@medidakos` 계정으로 실제 발송 |

#### Functions 환경변수(파라미터) 관리 — 2026-11-12 확인

- 배포 구조: Firebase CLI는 배포하는 순간 **배포하는 사람의 로컬 파일** `functions/.env`(공통) + `functions/.env.<프로젝트 ID>`(`.env.dev-medidakos-b9b4f` / `.env.medidakos`)의 값을 각 함수의 환경변수로 넣는다. 함수마다 마지막 배포 때의 값이 남으므로 같은 프로젝트 안에서도 함수별로 값이 다를 수 있다.
- Git 공유: `functions/.env`만 추적한다(비밀 아님). `functions/.env.dev-medidakos-b9b4f`·`functions/.env.medidakos`는 `functions/.gitignore`의 `.env.*` 규칙으로 **추적되지 않는다** → 한 사람이 로컬에서 고쳐도 GitHub·다른 사람 PC에 공유되지 않는다.
- 아래 세 변수를 실제로 읽는 함수: `channelTalkOnUserCreated`, `channelTalkOnContactCreated`, `channelTalkRetry`(`functions/channeltalk/triggers.js`). API 버전은 `channelTalkLastContactWebhook`도 읽는다. `onUserSignup`·`onContactCreated`는 값이 들어 있어도 읽지 않는다.

배포된 값(`gcloud functions describe`, 읽기 전용):

| 함수 | 프로젝트 | 배포일 | TEST_DOMAIN | INTERNAL_DOMAINS | INTAKE_API_VERSION |
|---|---|---|---|---|---|
| channelTalkOnUserCreated·OnContactCreated·Retry | dev | 2026-11-06 | `(techasset.co.kr)` ✗ | `(techasset.co.kr,medidakoslabs.com,medidakos.com)` ✗ | `2026-10-01` |
| onUserSignup·onContactCreated (값 미사용) | dev | 2026-11-06 | 괄호 ✗ | 괄호 ✗ | `(2026-10-01)` ✗ |
| channelTalkOnUserCreated·OnContactCreated·Retry | 운영 | 2026-10-14 | `techasset.co.kr` ✓ | `techasset.co.kr,medidakoslabs.com,medidakos.com` ✓ | `2026-06-01` |
| channelTalkLastContactWebhook | 운영 | 2026-10-21 | ✓ | ✓ | `2026-06-01` |
| onUserSignup·onContactCreated (값 미사용) | 운영 | 2026-10-15 | 괄호 ✗ | 괄호 ✗ | `(2026-10-01)` ✗ |

- 로컬 파일(이 PC, 2026-11-12): `.env.dev-medidakos-b9b4f`(수정일 11-09)·`.env.medidakos`(10-21) 모두 **괄호 없음**. 즉 dev 배포본의 괄호 값은 이 PC가 아닌 다른 PC의 로컬 파일에서 왔다(인수인계 문서의 배포 기록도 다른 PC).
- 괄호가 생긴 경위(**추정**): 배포 중 CLI가 값을 물을 때 기본값 표시 `(값)`을 그대로 입력해 파일에 저장된 것으로 보인다. API 버전 괄호 사례와 모양이 같다.
- 운영 영향: 운영 Channel Talk 함수는 올바른 값이라 현재 정상. 운영 `onUserSignup`·`onContactCreated`의 괄호 값은 읽히지 않아 동작 영향 없음.

dev 선택 재배포(승인 후, 이 PC에서):

- 대상: dev의 `channelTalkOnUserCreated`, `channelTalkOnContactCreated`, `channelTalkRetry` 3개만. 명령 형식은 [firebase-functions-deployment.md](firebase-functions-deployment.md)의 선택 배포(`-P dev`, 함수 이름 지정)를 따른다. 전체 배포·`-P` 생략 금지.
- 영향: dev 프로젝트의 이 3개 함수만 갱신된다(소스 = 이 PC의 `functions/` 현재 파일, 환경변수 = 이 PC의 `.env` + `.env.dev-medidakos-b9b4f`). Secret은 이름으로 연결돼 그대로. 운영(`medidakos`)은 프로젝트가 달라 영향 없음.
- 배포 전 확인: functions 소스가 `origin/dev`와 같은지(2026-11-12 기준 차이 없음), 두 로컬 env 파일 값.
- 배포 후 확인: `gcloud functions describe <함수> --gen2 --region asia-northeast3 --project dev-medidakos-b9b4f`로 두 변수에 괄호 없음, `+chtest` 가입 1건으로 `channelTalkSync`가 `skipped`가 아닌지.

**실행 결과 — 2026-11-12 15:30 KST (06:30 UTC)**

- 실행: 사용자가 이 PC 터미널에서 직접 실행(Claude 실행은 프로젝트 보호 hook이 모든 `firebase deploy`를 차단 — 우회하지 않음). 대상 `dev-medidakos-b9b4f`(`-P dev`), 함수 3개만 지정. CLI 출력 "Loaded environment variables from functions/.env, functions/.env.dev-medidakos-b9b4f", 3개 모두 `Successful update operation`.
- 사전 점검: 회사 계정 dev `roles/editor`, `functions/` 미커밋 변경 0·`origin/dev`와 차이 0, 배포값 대비 바뀌는 값은 괄호 제거 3개뿐(아래).

| 값 | 재배포 전(dev) | 재배포 후(dev) | 운영(참고) |
|---|---|---|---|
| `CHANNELTALK_TEST_DOMAIN` | `(techasset.co.kr)` | `techasset.co.kr` | `techasset.co.kr` |
| `CHANNELTALK_INTERNAL_DOMAINS` | `(techasset.co.kr,medidakoslabs.com,medidakos.com)` | `techasset.co.kr,medidakoslabs.com,medidakos.com` | 같음(괄호 없음) |
| `CHANNELTALK_INTAKE_BOT_NAME` | `(웹 접수)` | `웹 접수` | `웹 접수` |
| `CHANNELTALK_INTAKE_API_VERSION` | `2026-10-01` | `2026-10-01` (변경 없음) | `2026-06-01` |

- 배포 후 확인(읽기 전용): 3개 함수 `ACTIVE`, 갱신 06:30:04–08 UTC. dev `onUserSignup`·`onContactCreated`는 11-06 그대로(괄호 값 남음, 미사용), dev 함수 수 5개 그대로. 운영 13개 함수 갱신 시각 모두 그대로(10-14·10-15·10-21) → **운영 변경 없음**. 새 버전 기동 정상, 배포 후 오류·경고 로그 없음(`channelTalkRetry` 다음 정기 실행은 배포 후 첫 10분 주기에 확인 필요).
- 남은 확인: `+chtest` 주소로 가입 1건 → `channelTalkSync`가 `[TEST]` 라벨로 처리되는지(다음 단계, 운영 Channel Talk에 `[TEST]` 고객이 생김).

이사님(다른 PC에서 배포하는 사람)과 맞출 것:

1. 각자 `functions/.env.dev-medidakos-b9b4f`·`.env.medidakos`에 아래 값이 **괄호 없이** 들어 있는지 확인(값은 비밀 아님): `CHANNELTALK_TEST_DOMAIN=techasset.co.kr`, `CHANNELTALK_INTERNAL_DOMAINS=techasset.co.kr,medidakoslabs.com,medidakos.com`, `CHANNELTALK_INTAKE_API_VERSION` = dev `2026-10-01` / 운영 `2026-06-01`
2. 괄호가 있는 파일로 배포하면 올바른 값이 다시 괄호 값으로 **덮어써진다**. 배포 전에 서로 파일을 맞추고, 누가 언제 어떤 함수를 배포했는지 기록한다.
3. 배포 중 값 입력 프롬프트가 나오면 괄호 없이 값만 입력한다.
4. 장기: 이 비밀 아닌 값들을 추적되는 `functions/.env` 또는 문서로 단일화할지 결정한다(CLAUDE.md "클론만으로 배포 설정 재현" 원칙).

### C-4. Contact Form

| 항목 | 내용 |
|---|---|
| dev 구현 | 리뉴얼 폼은 **Mock 제출만**(Firestore·Channel Talk·메일 호출 없음). 11/11·11/12 확정: Desired launch date·Message 선택, Launch date 자유 문자열 |
| 연동 때 정할 것 | 전체 필드 저장 구조, `contact` 규칙의 Message 필수 조건, 출시일 문자열, 프로모션 관심 여부, Brief 첨부 정보, Channel Talk 메모(`functions/channeltalk/notes.js`)·관리자 메일의 새 필드 표시 |
| 환경변수 | Firebase 6개(공통) |
| 배포 상태 | 미구현(연동) |

### C-5. Channel Talk

| 항목 | 내용 |
|---|---|
| 구조 | 브라우저 SDK(`NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY`)가 있으면 boot, 없으면 Mock 런처. 로그인 회원은 `memberId = Firebase uid`, `/api/channel-talk/member-hash`가 ID 토큰을 Admin SDK로 검증(`FIREBASE_SERVICE_ACCOUNT_B64`)한 뒤 `CHANNEL_TALK_MEMBER_HASH_SECRET`으로 memberHash 발급. 비회원은 익명 boot. 커스텀 물방울 런처·미읽음 점(`onBadgeChanged`) |
| 팀 결정 (2026-11) | staging도 기존 운영 Channel Talk 채널 사용. Channel Talk 허용 도메인에 `dev.medidakos.com` 등록 완료(사용자 확인) |
| dev Functions 연동 실제 상태 (2026-11-12) | 가입 테스트에서 `channelTalkOnUserCreated` 실행 → `channelTalkSync/users_{uid}` `status: skipped`, `skipReason: is_test`, `flags.test: false`(테스트 도메인 값 괄호 문제, E장). 운영 Channel Talk에 고객·상담 생성 없음 |
| 현재 상태 (2026-11-12) | staging: 플러그인 키·member hash secret **없음** → dev.medidakos.com은 Mock 런처. Preview: 둘 다 있음 → 기능 브랜치 Preview는 dev Firebase 회원으로 운영 채널에 boot |
| CRM 영향 | staging 방문자·회원이 운영 채널에 고객으로 생성됨(회원 ID는 dev uid라 운영 회원과 겹치지 않음). Functions 연동(가입·문의 → 상담·메모)은 dev에서 `isTest` 제출을 건너뛰고 `+chtest` 주소만 `[TEST]` 라벨로 전송 |
| 환경변수 | `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY`, `CHANNEL_TALK_MEMBER_HASH_SECRET`, (회원 검증용) `FIREBASE_SERVICE_ACCOUNT_B64` |
| 배포 상태 | 운영: 기존 위젯 반영. 리뉴얼 런처: dev 코드만 |

staging Channel Talk 연결 절차(다음 단계, 승인 후):

1. Vercel → `medi-da-kos` → Settings → Environment Variables에서 `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY`, `CHANNEL_TALK_MEMBER_HASH_SECRET`에 **staging** 환경을 추가(운영 채널과 같은 값, 값은 문서에 기록하지 않음)
2. staging `FIREBASE_SERVICE_ACCOUNT_B64`가 dev 프로젝트 키인지 확인(아니면 member-hash가 401·500)
3. `NEXT_PUBLIC_*`는 빌드 때 박히므로 **staging 재배포 필요**: `dev` 브랜치에 push 또는 Source가 `dev`인 최신 배포를 Build Cache 없이 Redeploy(Source가 `main`인 배포를 누르지 않도록 주의)
4. dev.medidakos.com에서 익명 boot → 상담 열기·닫기, 미읽음 점, 회원 로그인 후 boot(member hash) 확인
5. 테스트 상담은 운영 CRM에 남으므로 `[TEST]`로 표시하고 확인 뒤 정리

**staging 사전 점검 결과 — 2026-11-12 (Vercel API 읽기 전용, 값 미출력)**

| 항목 | 결과 |
|---|---|
| staging 환경 | Custom Environment `staging`(`env_IjLx…`), Branch Tracking `dev`(equals), 도메인 `dev.medidakos.com` verified |
| staging 배포 코드 | 최신 staging 배포 = `dev` dc6a449 (2026-11-05 `chore/renewal-cleanup` 병합, 배포 11-06 READY). **리뉴얼 코드 미반영** — `feat/website-renewal`이 `origin/dev`보다 24커밋 앞섬. dc6a449에는 리뉴얼 페이지·커스텀 런처가 없고, Channel Talk는 SDK 기본 버튼으로 boot, member-hash API는 있음 |
| staging Firebase 변수 | `NEXT_PUBLIC_FIREBASE_*` 6개 = Preview와 공용 1벌, `PROJECT_ID` = `dev-medidakos-b9b4f`, `AUTH_DOMAIN` = dev 도메인. Production은 별도 1벌(`medidakos`) ✓ |
| staging `FIREBASE_SERVICE_ACCOUNT_B64` | staging 전용 항목 있음(Sensitive). **값을 API로 읽을 수 없어 dev 서비스 계정인지 미확인** → 연결 후 회원 boot(member-hash 200) 성공으로 간접 확인 |
| Channel Talk 변수 | `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY`·`CHANNEL_TALK_MEMBER_HASH_SECRET` = Production+Preview **공용 1개 항목**(Sensitive, 값 조회 불가), staging 없음 |
| Channel Talk 허용 도메인 | `dev.medidakos.com` 등록 — 사용자 확인(Claude는 Channel Talk 관리자 접근 없음) |

변경하지 않은 이유(2026-11-12): Sensitive 값은 API로 읽을 수 없어 staging 전용 항목을 새로 만들 수 없고, 값 없이 가능한 방법(기존 Production+Preview 공용 항목에 staging 추가)은 Production이 쓰는 항목을 수정하는 일이라 승인 범위 밖. → 아래를 사용자가 직접 진행.

1. Vercel → `medi-da-kos` → Settings → Environment Variables → **Add New**
2. Key `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY`, Environments에서 **staging만** 선택(Production·Preview 체크 해제), Sensitive 선택, Value = 운영 채널 플러그인 키(Channel Talk 관리자 또는 원래 Production 값을 등록한 사람에게서 받음)
3. 같은 방식으로 `CHANNEL_TALK_MEMBER_HASH_SECRET`(Channel Talk 관리자 → 보안 → 회원 정보 암호화 키) staging만
4. 저장 후 목록에서 두 변수가 `staging` 전용 새 항목으로 추가되고, 기존 Production+Preview 항목은 그대로인지 확인
5. 재배포(별도 승인): 환경변수는 다음 배포부터 적용. Redeploy 대상은 Source `dev`(dc6a449) → **이전 정리본 코드에 Channel Talk 기본 버튼이 켜지는 것**이고 리뉴얼 런처는 아님. 리뉴얼 화면에서 확인하려면 `feat/website-renewal`을 `dev`에 반영(push·PR·merge, 별도 승인)한 뒤 그 배포로 확인

테스트 전 주의: 연결되면 dev.medidakos.com 방문자(Vercel 팀 로그인 사용자)가 운영 Channel Talk 채널에 익명 고객으로 생기고, 로그인 회원은 dev Firebase uid가 회원 ID로 등록된다(운영 회원과 uid 공간이 달라 충돌 없음). `+chtest` 주소 가입·문의만 Functions가 `[TEST]` 라벨로 상담·메모를 만든다(2026-11-12 재배포로 활성). 테스트 기록은 운영 CRM에 남으므로 확인 뒤 정리.

운영 Vercel에 별도로 할 일: 없음(Production은 기존 값 사용). 단 Preview가 운영 채널 키를 계속 쓸지는 결정 필요(E장).

**staging 변수 등록 결과 — 2026-11-12 (사용자가 Vercel UI에서 등록, Claude는 읽기 전용 확인)**

| 변수 | 적용 환경 | 유형 | 등록 시각(UTC) | 확인 |
|---|---|---|---|---|
| `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY` | staging만 | Config(`encrypted`) | 07:16 | 값이 로컬 `.env.local`과 같음(일치 여부만 대조). 이 값은 운영 홈페이지 공개 스크립트에 들어 있는 플러그인 키와도 같음(2026-11-12 대조) |
| `CHANNEL_TALK_MEMBER_HASH_SECRET` | staging만 | Secret(`sensitive`) | 07:19 | 값 조회 불가라 대조 불가. 운영 값과 같은지는 회원 boot 성공으로 확인 |

- 유형 적절성: 플러그인 키는 `NEXT_PUBLIC_`이라 빌드 때 브라우저 코드에 그대로 들어가는 공개 값 → Config로 충분. member hash secret은 서버(`/api/channel-talk/member-hash`)만 읽는 비밀 값 → Secret(Sensitive)이 맞음.
- 기존 항목 무변경: Production+Preview 공용 Channel Talk 항목 2개(2026-07-30), Firebase 변수 Production·staging/Preview(2026-11-06), `FIREBASE_SERVICE_ACCOUNT_B64` 3개(Production 08-27, staging·Preview 11-06), `NEXT_PUBLIC_USE_MOCK_AUTH`(05-25), GA·Meta(11-06)의 갱신 시각이 모두 그대로. staging Firebase 프로젝트 ID는 여전히 `dev-medidakos-b9b4f`.
- 배포 상태: 새 배포 없음. staging은 여전히 `dev` dc6a449(11-06) → **두 변수는 아직 실제 사이트에 적용되지 않음**.

다음 순서(각각 별도 승인):

1. 어떤 코드로 확인할지 결정 — (A) 지금 `dev`(dc6a449, 정리본)를 Build Cache 없이 Redeploy → 기존 화면 + Channel Talk 기본 버튼으로 연결만 확인, (B) `feat/website-renewal`을 `dev`에 반영(push → PR → merge) → 그 merge로 staging 자동 배포 → 리뉴얼 화면·커스텀 런처·미읽음 점까지 확인
2. (B)를 택하면 먼저 Vercel Preview 빌드 성공 여부 확인(11-09 `next/font/google` 오류 기록 — `feat/website-renewal` push 때 Preview가 자동 빌드됨)
3. 배포 후 테스트(C-5 4~5번): 익명 boot, 회원 로그인 boot(member hash 200 = staging 서비스 계정 키·secret 정상), `+chtest` 가입 1건으로 `[TEST]` 동기화

### C-6. Contact Brief·Firebase Storage

| 항목 | 내용 |
|---|---|
| dev | 업로드 UI만(파일은 브라우저 밖으로 나가지 않음). Storage SDK·`storage.rules`·`firebase.json` storage 설정 없음 |
| 정할 것 | 저장 위치·용량·보관 기간·접근 규칙·Channel Talk/메일 전달 방식 |
| 배포 상태 | 미구현 |

### C-7. Instagram API

| 항목 | 내용 |
|---|---|
| dev | 피드 UI·Post Modal·카드 구현, 게시물은 서버 피드에서 받는 구조(현재 빈 목록). 개발 서버 `?socialTest=1` 테스트 게시물(운영 빌드 제외) |
| 정할 것 | 토큰 발급·갱신 방법과 저장 위치(Secret), 캐시·갱신 주기 |
| 배포 상태 | 미구현(1차 연동 예정). TikTok은 2차, 1차는 공식 계정 링크 |

### C-8. Cookie Consent

| 항목 | 내용 |
|---|---|
| dev | 배너·Cookie Settings UI와 동의 저장(6개월) 구현 |
| 미구현 | 동의에 따른 GA4·Meta Pixel·Channel Talk 실행 제어 — 현재는 동의와 무관하게 로드 |
| 배포 상태 | UI: dev 코드만. 실행 제어: 미구현(우선 개발 항목) |

### C-9. GA4·Meta Pixel

| 항목 | 내용 |
|---|---|
| 현재 | GA ID·Pixel ID가 모든 환경에 같은 값. GA 사용자 이벤트에는 `is_test`, Meta는 운영 도메인에서만 전송. GA 페이지뷰에는 `is_test` 없음 |
| 정할 것 | dev/운영 속성 분리 여부(이사님 확인 후 결정) |
| 환경변수 | `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` |

### C-10. SEO·도메인

| 항목 | 내용 |
|---|---|
| 현재 | Production: `www.medidakos.com`·`medidakos.com`(둘 다 200, 리다이렉트 없음), staging: `dev.medidakos.com`(팀 로그인 보호) |
| 운영 전환 때 | 페이지별 metadata·canonical·OG, `robots`·`sitemap`, apex↔www 정책, staging이 검색에 노출되지 않는지 |
| 배포 상태 | 페이지별 SEO 최종안 미정 |

---

## D. 운영 전환 절차

1. **사전 점검**: C장 각 기능의 dev 검증 완료, B장의 미확인 항목 해소, Vercel Preview 빌드 성공(현재 `next/font` 오류 기록 있음), CLI 재인증
2. **백업·롤백 준비**: 전환 직전 `main` 커밋 태그, 운영 Firestore 내보내기(승인 후), 운영 Vercel 환경변수 목록(이름·환경) 기록, 운영 Functions 목록 기록
3. **운영 설정 반영**: 운영 Firebase Console(Auth 로그인 방식·승인 도메인), 운영 Vercel 환경변수(다르게 설정할 항목만), Secret
4. **Functions·Rules 선택 배포**: [website-renewal-production-cutover.md](../plans/website-renewal-production-cutover.md)의 단계 순서대로, 함수 이름을 지정해 `-P prod`
5. **main 배포**: `dev → main` 병합(승인 후) → Vercel Production 빌드 → 실제 배포 커밋·상태 확인
6. **배포 후 검증**: 가입·로그인·Google(운영 테스트 계정), Contact 저장 → Channel Talk 상담·내부 메모 → 관리자 메일, 쿠키 동의, GA4·Meta 이벤트, 도메인·SEO

---

## E. 미해결·보류

| 항목 | 상태 | 필요한 결정·작업 |
|---|---|---|
| 운영 Auth 설정(로그인 방식·승인 도메인) 실제 확인 | 미확인(dev는 2026-11-12 확인 완료) | 운영 전환 준비 때 읽기 전용 조회 또는 Console 확인 |
| dev 실제 가입·로그인·Google 테스트 | 미실행 | 테스트 계정·메일 수신 승인 |
| dev 배포 함수의 `CHANNELTALK_INTERNAL_DOMAINS`도 괄호 포함 → `[내부]` 라벨 누락(dev는 어차피 `is_test`로 건너뜀) | **해결(2026-11-12 dev 3개 함수 재배포)**. 운영 Channel Talk 함수는 원래 정상 | 다른 PC에서 배포할 때 괄호 값으로 되돌아가지 않도록 env 파일 맞추기 |
| dev 배포 함수의 `CHANNELTALK_TEST_DOMAIN` 값이 `(techasset.co.kr)`(괄호 포함) → `+chtest` 주소도 테스트로 인식되지 않아 Channel Talk 전송을 건너뜀(`skipReason: is_test`). 로컬 `functions/.env.dev-medidakos-b9b4f`는 괄호 없음(미배포) | **해결(2026-11-12 dev 3개 함수 재배포)**. 원인은 다른 PC의 로컬 env 파일(추정) | `+chtest` 가입 1건으로 `[TEST]` 동기화 확인(다음 단계). 이사님 PC env 파일 값 확인 결과 회신 대기 |
| 가입 시 Auth 계정 생성 후 `users` 저장이 실패하면 문서 없이 계정만 남음(이후 로그인으로 복구되지 않음) | 기존 동작 | 처리 방식 결정 |
| `contact` 규칙 Message 필수 | 충돌 확인 | Contact 연동 때 규칙 변경 승인 |
| Mock 관리자 테스트 비밀번호가 클라이언트 번들에 포함 | 미결정 | 제거 또는 개발 빌드 한정 |
| staging Channel Talk 환경변수 | **등록 완료(2026-11-12, 사용자, staging 전용)**, 배포 전이라 미적용 | 재배포 방식 (A)/(B) 결정(C-5) |
| staging 리뉴얼 코드 미반영 | `dev` = dc6a449(정리본), `feat/website-renewal`이 24커밋 앞섬 | `dev` 반영(push·PR·merge) 승인 |
| staging `FIREBASE_SERVICE_ACCOUNT_B64`가 dev 키인지 | 미확인(Sensitive) | 연결 후 회원 boot 성공으로 간접 확인 |
| Preview에 운영 Channel Talk 키 | 설정됨 | 유지 여부 결정 |
| Vercel 빌드 실패(`next/font/google` Noto Serif) — Preview 11-09, staging Redeploy 11-12 | 원인 분석 완료. **① 적용(2026-11-12, `feat/website-renewal` 로컬, 미커밋)** — Vercel 빌드 확인 전 | 커밋 → push → Preview 빌드 성공 확인(각 승인). `dev`·`main`(이전 코드)은 그대로라 Redeploy하면 여전히 실패 |
| GA4·Meta dev/운영 분리 | 결정 대기 | 이사님 확인 |
| `webhook-sa@medidakos`의 dev Secret 읽기 권한 | 회수 예정 | 인수인계 문서 남은 작업 |
| `NEXT_PUBLIC_USE_MOCK_AUTH`(Production·Preview) 값 | 미확인 | Vercel에서 확인(운영은 없음 또는 `false`) |

### Vercel 빌드 실패 분석 — 2026-11-12

| 항목 | 내용 |
|---|---|
| 실패 배포 | staging Redeploy `dpl_8SYz…` (2026-11-12 07:33 UTC, Source `dev` dc6a449, Build Cache 미사용) — ERROR. 같은 오류: Preview `dpl_9Eej…` (2026-11-09, `feat/website-renewal` 29f588b) |
| 오류 | `Turbopack build failed with 24 errors` — 24개 모두 `[next]/internal/font/google/noto_serif_704521a6.module.css`의 `@font-face src`에서 `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` / `next/font/google queries have exactly one entry`. Geist·Geist Mono·Instrument Sans는 오류 없음 |
| 성공 배포와 비교 | 11-06 staging READY(`dpl_DU8k…`)와 **같은 커밋 dc6a449**, 같은 설정(Next.js 16.2.6 Turbopack, Vercel Node 24.x, Standard 4코어 빌드 머신, iad1, 캐시 미사용, 의존성 1053개 동일). 코드·의존성 차이 없음 |
| 레포 설정 | `src/app/layout.tsx` `Noto_Serif({ subsets: ["latin"], weight: ["500","600","700"] })` — `dev`·`feat/website-renewal`·`main` 동일. `package-lock.json` 브랜치 간 동일, `next.config.ts`에 글꼴·Turbopack 설정 없음 |
| 로컬 재현 | 2026-11-12 dc6a449를 프로젝트 밖 임시 폴더로 내보내 캐시 없이 `next build`(Node 22, dev Firebase 값, Channel Talk·GA·Meta 공란) → **성공**(Google에서 글꼴 새로 받음). 이 PC(한국)에서 받은 Google Fonts CSS도 정상(Noto Serif `@font-face` 24개, 일반 `fonts.gstatic.com/s/...woff2` 주소, 쿼리 문자 없음) → **이 PC에서는 재현 불가** |
| 판단 | 코드가 아니라 **Vercel 빌드 서버가 11-06~11-09 사이부터 받는 Noto Serif용 Google Fonts 응답**을 Turbopack 글꼴 처리기가 해석하지 못하는 것으로 판단. 오류 문구(쿼리 항목이 1개가 아님)로 보아 글꼴 주소에 `&`·`=` 같은 쿼리 문자가 들어간 형태로 추정 — Vercel 로그가 주소를 잘라 표시해 **직접 확인은 불가** |
| 현재 staging | `dev.medidakos.com`은 여전히 11-06 READY 배포(`dpl_DU8k…`, dc6a449)를 제공(실패 배포는 도메인을 바꾸지 않음). staging Channel Talk 변수는 그래서 아직 미적용 |
| 리뉴얼 코드의 Noto Serif | `feat/website-renewal`에서 `font-serif`(Noto Serif)를 쓰는 곳은 이전 사이트 컴포넌트(`layout/Header`·`layout/Footer`·`contact/ContactForm`, `(marketing)` 레이아웃)뿐이고, `(marketing)` 그룹에 페이지가 없어 실제로 렌더링되지 않음. 리뉴얼 화면은 Instrument Sans(`--font-mdk`) 사용 |

해결 방안(모두 승인 필요, 아직 적용 안 함):

| 방안 | 내용 | 장점 | 주의 |
|---|---|---|---|
| ① 리뉴얼 브랜치에서 Noto Serif 제거(권장) | `layout.tsx`의 `Noto_Serif` 로드와 `globals.css`의 `--font-serif` 연결만 삭제(사용처 없음) | Google 요청 자체가 없어져 재발 없음, 변경 최소, 화면 변화 없음 | 이전 사이트 코드(`dev` dc6a449)는 그대로라, staging은 리뉴얼을 `dev`에 반영한 뒤부터 해결. 운영 `main`도 같은 글꼴을 쓰므로 다음 운영 빌드 전에 함께 해결돼야 함 |
| ② `next/font/local`로 Noto Serif 자체 호스팅 | woff2를 레포에 두고 로컬 글꼴로 로드 | 이전 사이트 화면 유지 | 글꼴 파일 추가, `dev`·`main`에도 같은 변경 필요 |
| ③ 시간을 두고 다시 Redeploy | 변경 없음 | Google 쪽이 원래대로 돌아오면 해결 | 11-09·11-12 연속 실패라 일시 현상이 아닐 가능성. 원인 불명으로 남음 |
| ④ webpack 빌드로 전환(`next build --webpack`) | Turbopack 글꼴 처리기 회피 | 코드 변경 없음 | 운영 빌드 방식 자체를 바꾸는 일이라 영향 범위가 큼 — 비권장 |

**운영 경고**: `main`(운영)도 같은 `Noto_Serif` 설정이라, 지금 운영을 Build Cache 없이 다시 빌드하면 같은 오류가 날 가능성이 높다. 현재 운영 배포(11-06 READY)는 영향 없음 — 운영 Redeploy는 원인 해결 전까지 하지 않는다.

**① 적용 결과 — 2026-11-12 (`feat/website-renewal`만, 미커밋, `dev`·`main` 미반영)**

- 사전 확인: dev 서버(`dev-medidakos-b9b4f`)에서 리뉴얼 10개 페이지(`/`, `/about-us`, `/services`, `/portfolio`, `/faq`, `/contact`, `/login`, `/signup`, `/privacy-policy`, `/terms-of-service`)의 글자 요소 실제 글꼴을 수집 → Instrument Sans·Geist만, Noto Serif 0개. `font-serif` 사용처는 페이지가 없는 `(marketing)` 그룹의 이전 컴포넌트(`layout/Header`·`layout/Footer`·`contact/ContactForm`)뿐
- 변경(2개 파일): `src/app/layout.tsx` — `Noto_Serif` import·설정·`<html>` 클래스 변수 제거(상단 주석 갱신). `src/app/globals.css` — `@theme`의 `--font-serif` 연결 1줄 제거(이전 컴포넌트의 `font-serif`는 Tailwind 기본 serif 글꼴로 대체되지만 렌더링되지 않음). Geist·Geist Mono·Instrument Sans 그대로
- 검증: `npm run typecheck` 통과, `src/app/layout.tsx` ESLint 통과, `npm test` 398/398, `npm run build:local`(dev Firebase, Channel Talk·GA·Meta 공란) 성공. 빌드 CSS의 `@font-face`는 Geist·Geist Mono·Instrument Sans(와 각 Fallback)뿐 — Noto Serif 없음(Google Fonts 요청 대상에서 빠짐). 제공 HTML에 Noto 언급 0. 변경 후 10개 페이지 글꼴 재수집 결과 화면 글꼴 동일(`/privacy-policy`의 개수 차이 1은 Next.js 데이터 `<script>` 조각 수 차이로 화면 글자 아님)
- 남은 확인: Vercel에서 실제로 빌드되는지(커밋 → push 후 Preview 빌드, 승인 필요). staging은 리뉴얼이 `dev`에 반영된 뒤 배포부터 해결. 운영 `main`은 리뉴얼 전환 때 함께 해결

---

## 작업 기록

| 날짜 | 기능 | 환경 | 내용 | 확인 방법 |
|---|---|---|---|---|
| 2026-11-12 | Firebase Authentication | 로컬(dev 설정) | 기존 인증 구현 분석, 선택 입력(Phone·Country·Company) 가입 구조 확인, Google 재로그인 시 프로필 빈 값 덮어쓰기 수정 + 단위 테스트 추가. 실제 dev 가입·로그인은 미실행 | 코드 분석, `tests/auth/*`, Emulator 규칙 테스트, Mock 화면 |
| 2026-11-12 | Channel Talk (사전 점검) | staging | staging에 플러그인 키·member hash secret 없음, Preview·Production에 있음 확인. 연결 절차 C-5에 기록 | Vercel API(이름·환경만) |
| 2026-11-12 | Firebase Authentication·Rules | dev | dev Auth 설정 확인(Email/Password·Google 사용, 승인 도메인 4개, 이메일 열거 보호, 비밀번호 정책 없음), dev 배포 규칙 = 레포 규칙 | Firebase CLI 자격으로 Identity Toolkit·Rules API 읽기 전용 조회 |
| 2026-11-12 | Firebase Authentication (이메일 가입) | dev | 실제 가입 성공, Auth·`users/{uid}`(`isTest: true`, 선택 항목 공란)·환영/관리자 메일 `SUCCESS`·실제 수신, Channel Talk 동기화는 `skipped`(테스트 도메인 괄호 문제 발견) | Auth·Firestore REST 읽기 전용 조회, `firebase functions:log -P dev`, 사용자 메일함 확인 |
| 2026-11-12 | Firebase Authentication (이메일 로그인·로그아웃) | dev | 상태 유지·로그아웃·틀린 비밀번호·미가입 주소 오류 문구·재로그인 모두 성공, `lastLoginAt` 갱신 확인 → **이메일 인증 dev 검증 완료** | 사용자 화면 확인, Auth REST 읽기 전용 조회 |
| 2026-11-12 | Functions 환경변수 | dev·운영 | 도메인 변수 괄호: dev Channel Talk 함수 3개 ✗, 운영 Channel Talk 함수 4개 ✓, dev·운영 `onUserSignup`·`onContactCreated`는 괄호지만 미사용. 로컬 env 파일 2개는 괄호 없음·Git 미추적 | `gcloud functions describe`(읽기 전용), `git check-ignore` |
| 2026-11-12 | Functions 재배포 | dev | `channelTalkOnUserCreated`·`channelTalkOnContactCreated`·`channelTalkRetry` 선택 재배포(사용자 실행) → TEST·INTERNAL 도메인·BOT 이름 괄호 제거, API 버전 그대로, 3개 `ACTIVE`·오류 없음. 다른 dev 함수·운영 함수 무변경. staging Channel Talk 연결 준비: Functions 쪽 완료, Vercel staging 변수는 미설정 | CLI 배포 출력, `gcloud functions describe`, `firebase functions:list`·`functions:log`(읽기 전용) |
| 2026-11-12 | Channel Talk (staging 연결 시도) | staging | 사전 점검 완료(staging = `dev` dc6a449, 리뉴얼 미반영, Firebase 변수 dev ✓). Channel Talk 변수 2개가 Sensitive(값 조회 불가)라 staging 전용 추가 불가 → **변경 없음**, 사용자 UI 절차 C-5에 기록. 서비스 계정 키 dev 여부 미확인 | Vercel API(이름·환경·공개 값 일치만) |
| 2026-11-12 | Channel Talk (staging 변수 등록) | staging | 사용자가 staging 전용으로 플러그인 키(Config)·member hash secret(Secret) 등록. 플러그인 키 = `.env.local` = 운영 공개 키 일치, Production·Preview·Firebase 항목 무변경, 새 배포 없음(미적용) | Vercel API 읽기 전용(갱신 시각·적용 환경, 공개 값 일치 여부) |
| 2026-11-12 | Vercel 빌드 실패 분석 | staging·Preview | 사용자 staging Redeploy(dc6a449) 실패 — Noto Serif `next/font/google` Turbopack 오류 24건(11-09 Preview와 동일). 같은 커밋 11-06 성공·설정 동일, 로컬 깨끗한 빌드 성공 → Vercel 빌드 서버가 받는 Google Fonts 응답 문제로 판단. staging은 11-06 배포 유지. 해결안 ①~④ 기록(① 리뉴얼에서 미사용 Noto Serif 제거 권장), 운영 Redeploy 주의 | Vercel 배포 이벤트·설정 API, 로컬 임시 폴더 재현 빌드, Google Fonts CSS 조회 |
| 2026-11-12 | 빌드 수정 ① Noto Serif 제거 | 로컬(`feat/website-renewal`) | 미사용 Noto Serif 로드 제거(`layout.tsx`·`globals.css`). 10개 페이지 화면 글꼴 동일, 빌드 CSS에 Noto Serif 없음, typecheck·lint·398 테스트·`build:local` 통과. 미커밋, Vercel 빌드 미확인 | 브라우저 글꼴 수집 전후 비교, 빌드 산출물 검사 |
