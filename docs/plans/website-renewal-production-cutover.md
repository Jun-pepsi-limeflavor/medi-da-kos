# 신규 홈페이지 운영 전환 체크리스트

- 작성일: 2026-11-05 (운영 상태는 같은 날 gcloud 읽기 전용 조회 기준)
- 갱신: 2026-11-05 — `lifecycleScan`·Notion 삭제 승인 반영(로컬 소스 삭제 완료), 폴더 구조 정리·문서 경로 변경 반영
- 대상: Medidakos 신규 홈페이지 최종 운영 전환
- 원칙
  - 신규 홈페이지 완성·최종 검증 전에는 `dev → main` 병합을 하지 않는다.
  - Firebase Functions·Cloud Scheduler·Secret·환경변수·Firestore Rules 운영 변경은 이 문서의 전환 단계에서만, 단계별 승인 후 진행한다.
  - 기존 Firestore 고객 데이터는 삭제하지 않는다.
  - Contact 문의는 **Firestore 저장 → Channel Talk 상담 생성 → 내부 대화(Internal Note) 등록 → 관리자 알림 메일**이 모두 되어야 정상이다. 상담만 생기고 내부 대화가 없으면 실패로 본다.
- 이 문서의 명령은 모두 예시다. 실행 전 승인과 대상 확인이 필요하다. 프로젝트 `medidakos`, 리전 `asia-northeast3`.

---

## 1. 현재 코드와 운영 환경의 차이

### 1.1 브랜치별 상태

| 구분 | `main` (현재 운영 홈페이지) | `chore/renewal-cleanup` → `dev` (정리본) |
|---|---|---|
| 웹 페이지 | Home, About Us, Process, Compare, Contact, Login, Dashboard, Landing(Catalog·Dashboard·Korea), Admin, `/test` | Home, About Us, Contact, Login만 남음(기존 디자인, 이미지 파일 없음) |
| 리디렉션 | `/how-it-works`→`/process`, `/pricing`→`/compare`, `/business`→`/about-us`, `/korea`→`/landing/korea` | 모두 제거 |
| `functions/index.js` | 11개 함수 export(+ Notion 이력 동기화 정의) | `onUserSignup`, `onContactCreated`, `channelTalkOnContactCreated`, `channelTalkOnUserCreated`, `channelTalkRetry`, `channelTalkLastContactWebhook` 6개 |
| `functions/lifecycle.js` | 있음(`lifecycleScan`) | 삭제 |
| `functions-ingest/` | 있음 (`ingest` 코드베이스) | 소스·`firebase.json` 설정 삭제 |
| 이미지·favicon·OG | 있음 | 전부 삭제(신규 브랜치에서 새로 적용) |
| Firestore Rules 파일 | 기존 | 변경 없음 |
| 폴더 구조 | 기존 | `src/components`·`src/lib`·`tests`·`docs`를 기능별로 재배치(`docs/README.md`). Functions 폴더 구조는 그대로 |

### 1.2 로컬에서 삭제한 기능

- Admin 백오피스(`/admin`, `/api/admin`), `src/proxy.ts`
- Dashboard(`/dashboard` 브리프 위저드·주문·추적)
- Landing Catalog·Dashboard·Korea, `/korea`
- Process, Compare, Business·Pricing·How it works 리디렉션, `/test`
- Admin Inbox 적재(`web-message-materializer`), Landing 알림 메일, Notion 주문 동기화·이력 동기화 소스
- 육성 트랙 일일 알림(`lifecycleScan`, `functions/lifecycle.js`) — 삭제 승인됨
- 메일 수집기 `functions-ingest/`(`ingestGmail`)와 백필·이전 스크립트
- 기존 이미지·favicon·OG·manifest 아이콘

### 1.3 소스는 수정했지만 운영에 아직 배포하지 않은 함수

| 함수 | 변경 내용 |
|---|---|
| `onContactCreated` | Admin Inbox 적재 호출 제거. 관리자 알림 메일은 동일 |
| `onUserSignup` | 환영 메일에서 Process·Compare 링크와 "Start a brief" 단락 제거. **새 CTA 문구·URL은 미정** |
| `channelTalkRetry` | 재시도 대상 중 `landingRequests`·`orders` 기록은 상담을 만들지 않고 `status: skipped`, `pendingReason: source_retired`로 닫음. OFF 기간 보류 기록(`intake_disabled`)은 건드리지 않음 |

`channelTalkOnContactCreated`·`channelTalkOnUserCreated`·`channelTalkLastContactWebhook`의 처리 로직은 바뀌지 않았다. 같은 코드베이스라 함께 배포해도 동작은 같다.

### 1.4 소스는 삭제했지만 운영에 여전히 배포된 함수

`onOrderCreated`, `onLandingRequestCreated`, `onSampleRequestCreated`, `channelTalkOnLandingCreated`, `channelTalkOnOrderCreated`, `ingestGmail`, `lifecycleScan`

> `notionEmailHistorySync`는 운영에 **배포된 적이 없다**(함수·Scheduler 모두 없음). 삭제 대상 아님.
> 반면 운영 `onOrderCreated`는 `NOTION_API_KEY`·`NOTION_DATABASE_ID`가 설정되어 **Notion 주문 동기화가 실제로 동작 중**이다.

### 1.5 신규 홈페이지에서도 유지할 함수

`onUserSignup`, `onContactCreated`, `channelTalkOnContactCreated`, `channelTalkOnUserCreated`, `channelTalkRetry`, `channelTalkLastContactWebhook`

### 1.6 기타

- `lifecycleScan`: 삭제 승인됨. **로컬 소스 삭제 완료 / 운영 Function·Scheduler는 최종 전환 시 삭제 확정**.
- Notion: 삭제 승인됨. 로컬 소스는 모두 삭제했다. 운영 `onOrderCreated`의 Notion 주문 동기화와 `NOTION_API_KEY`는 최종 전환 시 중단·삭제한다.
- 기존 `orders` 문서의 `notionSync` 필드명은 `functions/channeltalk/notes.js`의 필드 목록에 남아 있다(기존 데이터 구조 표시용, Notion 기능 아님).
- 운영 함수 대부분에 `NOTION_*`, `NOTION_HISTORY_MAILBOXES` 환경변수가 붙어 있다. 저장소에는 없는 값으로, 마지막 배포 PC의 로컬 env 파일에서 들어간 것으로 보인다(출처 미확인). 저장소 기준으로 재배포하면 해당 함수에서는 빠진다.

---

## 2. Firebase Functions 정리 목록 (운영 13개, 모두 ACTIVE·2세대·nodejs22)

공통 방법
- 선택 배포(예): `firebase deploy --project medidakos --only functions:default:onContactCreated,functions:default:channelTalkRetry`
- 삭제(예): `firebase functions:delete <함수명> --region asia-northeast3 --project medidakos`
- 전체 배포(`firebase deploy --only functions`)는 금지. 소스에 없는 운영 함수가 지워진다.
- 상태 확인: `gcloud functions list --project medidakos`, 로그: `firebase functions:log --only <함수명>`
- 복구 기준점: 전환 직전 `main` 커밋에 태그(예: `pre-renewal-cutover`)를 남긴다. 삭제한 함수는 이 태그 소스로 다시 배포해 복구한다(관련 Secret이 남아 있어야 함).

| 함수 | 현재 운영 기능 | 트리거·주기 | 신규 필요 | 처리 | 의존성 | 변경 시점 | 배포·삭제 방법 | 검증 | 복구 |
|---|---|---|---|---|---|---|---|---|---|
| `onUserSignup` | 가입 환영 메일 + 관리자 알림 | `users/{userId}` 생성, 재시도 없음 | 필요 | 수정 재배포(환영 메일 문구 확정 후) | `gmail-notify`(mail 큐), `ADMIN_EMAILS` | 4단계 | 선택 배포 | 내부 계정 가입 1건 → 환영·관리자 메일 수신 | 태그 소스로 재배포 |
| `onContactCreated` | Contact 관리자 알림 + Admin Inbox 적재 | `contact/{contactId}` 생성, 재시도 없음 | 필요 | 수정 재배포 | `gmail-notify`, `ADMIN_EMAILS` | 4단계 | 선택 배포 | 내부 테스트 문의 → 관리자 메일 수신 | 태그 소스로 재배포 |
| `channelTalkOnContactCreated` | Contact → 상담 생성·내부 대화 등록 | `contact/{docId}` 생성, 재시도 있음 | **필수** | 유지(같은 버전으로 함께 재배포 권장) | INTAKE Secret 2개, `channelTalkSync`·`channelTalkIdentities` | 4단계 | 선택 배포 | 상담 생성 + 내부 대화 내용 확인 | 태그 소스로 재배포 |
| `channelTalkOnUserCreated` | 회원가입 → Channel 고객 식별·프로필 | `users/{docId}` 생성, 재시도 있음 | 필요 | 유지 | INTAKE Secret | 4단계(선택) | 선택 배포 | 가입 1건 → `channelTalkSync/users_*` success | 태그 소스 |
| `channelTalkRetry` | Channel Talk 연동 재시도 | Scheduler 10분 | **필수** | 수정 재배포 | INTAKE Secret, 위 트리거 전부 | 4단계 | 선택 배포 | 로그 `channelTalkRetry: N건 처리`, 오류 없음 | 태그 소스 |
| `channelTalkLastContactWebhook` | 상담 메시지 → 고객 마지막 접촉일 | HTTP webhook | 필요 | 유지(재배포 불필요) | `CHANNELTALK_WEBHOOK_TOKEN`, INTAKE Secret, `channelTalkControl` | 변경 없음 | — | 로그 정상 | — |
| `channelTalkOnLandingCreated` | Landing 제출 → 상담 | `landingRequests/{docId}` 생성 | 불필요 | 삭제 | `landingRequests` 쓰기 규칙 | 5단계 | `functions:delete` | 목록에서 사라짐 | 태그 소스로 재배포 |
| `channelTalkOnOrderCreated` | 주문 → 상담 | `orders/{docId}` 생성 | 불필요 | 삭제 | `orders` 쓰기 규칙 | 5단계 | `functions:delete` | 목록에서 사라짐 | 태그 소스로 재배포 |
| `onOrderCreated` | 주문 관리자·고객 메일, Inbox 적재, **Notion 주문 동기화** | `orders/{orderId}` 생성 | 불필요 | 삭제 | `NOTION_API_KEY` | 6단계 | `functions:delete` | 목록에서 사라짐, Notion에 새 행 생성 중단 | 태그 소스로 재배포(`NOTION_API_KEY` 필요) |
| `onLandingRequestCreated` | Landing 관리자 알림, Inbox 적재 | `landingRequests/{requestId}` 생성 | 불필요 | 삭제 | — | 6단계 | `functions:delete` | 목록에서 사라짐 | 태그 소스 |
| `onSampleRequestCreated` | Inbox 적재 | `sampleRequests/{id}` 생성 | 불필요 | 삭제 | — | 6단계 | `functions:delete` | 목록에서 사라짐 | 태그 소스 |
| `ingestGmail` | Gmail·Channel Talk 메일 수집 → Admin Inbox | Scheduler 5분 (`ingest` 코드베이스) | 불필요 | 삭제 | `CHANNELTALK_ACCESS_KEY/SECRET`, Gmail 도메인 위임 | 7단계 | `functions:delete`(Scheduler 함께 삭제) | 함수·Scheduler 사라짐 | 태그 소스의 `functions-ingest/`로 재배포 |
| `lifecycleScan` | 육성 트랙 일일 메일(대시보드 브리프 기반) | Scheduler 매일 09:00 | 불필요(대시보드 없음) | **삭제 확정**(로컬 소스 삭제 완료) | `users`·`cmBriefs`·`orders`·`sampleRequests`·`lifecycleContacts` 읽기, `lifecycleQueue` 쓰기 | 8단계 | `functions:delete`(Scheduler 함께 삭제) | 함수·Scheduler 사라짐, 다음 날 09:00 메일 미발송 | 태그 소스로 재배포 |

주의
- 저장소의 `firebase.json`에는 `ingest` 코드베이스가 없다. `default` 코드베이스를 배포해도 `ingestGmail`은 남아 있으므로 반드시 따로 삭제한다.
- `channelTalkRetry`·`onContactCreated`를 사이트 전환 **전에** 배포하면, 아직 운영 중인 Landing·주문 리드의 재시도가 닫히고 Admin Inbox 적재가 멈춘다. 반드시 사이트 전환 뒤에 배포한다.

---

## 3. Cloud Scheduler 정리

| Job | 주기 | 처리 | 정리 방법 |
|---|---|---|---|
| `firebase-schedule-channelTalkRetry-asia-northeast3` | 10분마다 | **유지** | 없음. Contact 상담 생성 실패 시 재시도에 필요 |
| `firebase-schedule-ingestGmail-asia-northeast3` | 5분마다 | 함수 삭제에 따라 함께 정리 | 자동 |
| `firebase-schedule-lifecycleScan-asia-northeast3` | 매일 09:00 | 함수 삭제에 따라 함께 정리(삭제 확정) | 자동 |

- `firebase functions:delete`로 예약 함수를 지우면 Scheduler Job도 함께 삭제된다(firebase-tools 15.28.1 `deleteScheduleV2` 확인).
- **콘솔이나 `gcloud functions delete`로 함수를 지운 경우에는 Job이 남는다.** 그때만 수동 삭제: `gcloud scheduler jobs delete <job> --location asia-northeast3 --project medidakos`
- 삭제 후 확인: `gcloud scheduler jobs list --location asia-northeast3 --project medidakos`

---

## 4. Secret 및 환경변수 정리

값은 조회·기록하지 않는다. 사용처는 2026-11-05 운영 함수 설정 기준.

### 4.1 Secret Manager

| Secret | 사용 함수 | 처리 | 시점·조건 |
|---|---|---|---|
| `CHANNELTALK_INTAKE_ACCESS_KEY` | channelTalkOn*Created, `channelTalkRetry`, `channelTalkLastContactWebhook` | **유지(삭제 금지)** | Contact 상담·내부 대화에 필수 |
| `CHANNELTALK_INTAKE_ACCESS_SECRET` | 위와 같음 | **유지(삭제 금지)** | 위와 같음 |
| `CHANNELTALK_WEBHOOK_TOKEN` | `channelTalkLastContactWebhook` | 유지 | — |
| `NOTION_API_KEY` | `onOrderCreated` | 삭제 | `onOrderCreated` 삭제 후 관찰 기간이 끝난 뒤(복구에 필요) |
| `CHANNELTALK_ACCESS_KEY` | `ingestGmail`, Channel Talk V2 이전 스크립트(로컬 실행) | 삭제 | `ingestGmail` 삭제 + V2 이전 작업 종료 확인 후 |
| `CHANNELTALK_ACCESS_SECRET` | 위와 같음 | 삭제 | 위와 같음 |

예: `gcloud secrets delete NOTION_API_KEY --project medidakos` (승인 후)

### 4.2 Functions 환경변수

| 변수 | 위치 | 처리 |
|---|---|---|
| `ADMIN_EMAILS`, `NOTIFY_FROM_EMAIL`, `CHANNELTALK_INTAKE_*`, `CHANNELTALK_INTERNAL_DOMAINS`, `CHANNELTALK_TEST_DOMAIN`, `CHANNELTALK_NOTE_MAX_LENGTH`, `CHANNELTALK_LAST_CONTACT_*` | `functions/.env`·코드 기본값 | **유지** |
| `NOTION_DATABASE_ID`, `NOTION_PROP_*`, `NOTION_EMAIL_PROPERTY_TYPE` | 운영 함수 설정(배포 PC 로컬 env에서 유입) | 저장소 기준 재배포 시 자동 제거, 삭제 함수와 함께 제거 |
| `NOTION_HISTORY_MAILBOXES` | 운영 함수 설정(저장소 이력에 없음) | 위와 같음. 배포 담당 PC의 `functions/.env.*` 로컬 파일에서 Notion 항목 정리 |
| `INGEST_MAILBOXES`, `INGEST_INITIAL_AFTER` | `ingestGmail` | 함수 삭제와 함께 제거 |

배포 PC 확인: `functions/.env.local`은 에뮬레이터 전용이라 배포에 쓰이지 않는다. `functions/.env.medidakos`·`.env.default` 같은 파일이 있으면 내용(Notion 항목)을 확인하고 정리한다.

### 4.3 Vercel 환경변수 (실제 목록 **확인 필요**)

| 변수 | 처리 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY`, `CHANNEL_TALK_MEMBER_HASH_SECRET`, `FIREBASE_SERVICE_ACCOUNT_B64`, `GOOGLE_SITE_VERIFICATION` | 유지 |
| `BACKOFFICE_ADMIN_EMAILS` (Admin) | 삭제 |
| `CHANNELTALK_ACCESS_KEY`, `CHANNELTALK_ACCESS_SECRET`, `CHANNELTALK_CHANNEL_VERSION` (Admin 답장·수집) | 삭제 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BEDROCK_MODEL_ID` (Admin 메시지 파싱) | 삭제 |

Vercel 변수는 신규 홈페이지 Production 배포가 안정된 뒤 삭제한다(롤백 시 기존 `main` 배포가 다시 쓸 수 있으므로).

KakaoWork Git 알림의 `KAKAOWORK_*` 값은 Vercel이 아니라 GitHub 저장소 Actions Secret에 있다. 유지한다.

---

## 5. Firestore Rules 및 데이터

원칙: **데이터는 삭제하지 않는다.** 신규 홈페이지에서 쓰지 않는 컬렉션은 클라이언트 쓰기만 막는다. 규칙 변경은 데이터 모양·규칙안을 먼저 문서로 승인받고 배포한다.

| 컬렉션 | 현재 규칙(저장소 기준) | 신규 사용 | 전환 후 처리 |
|---|---|---|---|
| `contact` | 검증된 create만 허용 | 사용 | **유지** |
| `users` | 본인 create·update, 읽기 | 사용(회원가입) | **유지** |
| `landingRequests` | 비로그인 create 허용 | 미사용 | create 차단(`allow create: if false`) |
| `orders` | 본인 create·read | 미사용 | create 차단. read는 Dashboard V2 계획에 따라 결정 |
| `sampleRequests` | 본인 create·read | 미사용 | create 차단 |
| `cmBriefs` | 본인 read·write | 미사용 | write 차단 |
| `tracking/{uid}/entries` | 본인 read·write | 미사용 | write 차단 |
| `test` | 로그인 사용자 read·write | 미사용 | 규칙 삭제(전부 거부) |
| `koreaLeads` | 별도 규칙 없음 → 이미 전부 거부 | 미사용 | 변경 없음 |
| Admin Inbox(`buyers`, `suppliers`, `deals`, `messages`, `threads`, `conversations`, `conversationIdentities`, `intakeReviews`, `ingestState`) | 클라이언트 전부 거부 | 미사용 | 변경 없음(데이터 보존) |
| `channelTalkSync`, `channelTalkIdentities`, `channelTalkControl` | 클라이언트 전부 거부 | 서버 사용 | **유지** |
| `mail`, `lifecycleQueue`, `lifecycleContacts` | 규칙 없음 → 전부 거부(서버 전용) | `mail`만 사용 | 유지(데이터 보존. `lifecycle*`은 `lifecycleScan` 삭제 후 쓰이지 않음) |

- 배포된 규칙이 저장소 규칙과 같은지 **확인 필요**(Firebase 콘솔 → Firestore → 규칙 → 게시 이력).
- 규칙 배포 예: `firebase deploy --project medidakos --only firestore:rules` (승인 후. `--dry-run`도 실제 반영된 사례가 있어 쓰지 않는다.)
- 규칙 변경 시 `tests/rules/*`, `tests/firestore-landing-requests.test.ts`를 함께 고치고 `npm test`로 에뮬레이터 검증한다.

### 5.1 `channelTalkSync`의 Landing·주문 기록

2026-11-05 읽기 전용 집계(건수만):

| source | success | pending | 그 외 |
|---|---|---|---|
| `landingRequests` | 1 | 0 | 0 |
| `orders` | 1 | 2 | 0 |
| `contact` | 14 | 3 | skipped 1 |
| `users` | 6 | 5 | 0 |

- pending 10건(orders 2·contact 3·users 5)은 모두 `pendingReason: intake_disabled`(OFF 기간 보류, 실제 고객, V2 이전 대상)다. 새 `channelTalkRetry`는 이 기록을 **건드리지 않는다**.
- 현재 재시도 대기 중인 Landing·주문 기록은 0건이다. 전환 시점에 다시 집계하고, 재시도 대기 기록이 있으면 새 `channelTalkRetry`가 `skipped`/`source_retired`로 닫는다(상담 미생성, 원본 데이터 보존).

---

## 6. Vercel 및 홈페이지 운영 배포

| 항목 | 상태 |
|---|---|
| Production Branch = `main` | 배포 이력상 사실상 확인(main 병합 커밋 → Production). Vercel 설정 화면 **확인 필요** |
| `dev` 브랜치 | Preview 배포(`medi-da-kos-git-dev-…vercel.app`, Vercel 로그인 필요) |
| `dev.medidakos.com` | 공개 접속됨. 연결 브랜치 **확인 필요** |
| Preview 환경의 Firebase | **확인 필요**(운영 Firestore 사용 가능성 높음. dev 테스트 문의도 관리자 메일 발송됨) |

### 6.1 삭제되는 URL과 SEO·광고

| URL | 처리 결정 필요 |
|---|---|
| `/process`, `/compare` (기존 sitemap 포함) | 신규 대응 페이지로 301 또는 404/410 |
| `/how-it-works`, `/pricing`, `/business` (기존 301) | 신규 페이지로 301 유지 여부 |
| `/korea`, `/landing/korea`, `/landing/catalog`, `/landing/dashboard` | 콜드메일·광고 URL. 신규 랜딩/Contact로 301 여부 |
| `/dashboard`, `/dashboard/orders`, `/dashboard/tracking` | 로그인 사용자 북마크. 홈으로 301 또는 404 |
| `/admin/*`, `/test` | 404 유지 |

체크
- [ ] Google Ads·Meta 광고·콜드메일 템플릿의 최종 URL 목록 확인 후 변경
- [ ] 리디렉션 정책 확정 → `next.config.ts`에 반영(신규 브랜치)
- [ ] 신규 `sitemap.xml`·`robots.txt` 확인, Search Console에 sitemap 재제출
- [ ] Search Console에서 404 증가 모니터링(전환 후 2주)
- [ ] 신규 favicon·Apple 아이콘·manifest 아이콘·OG·Twitter 이미지·JSON-LD 로고 적용 확인(정리 브랜치에서 기존 파일 전부 삭제됨)

---

## 7. 실제 운영 전환 순서

각 단계: **조건 → 작업 → 성공 확인 → 실패 시 대응**. 앞 단계가 성공해야 다음으로 간다.

### 0단계. 사전 준비 (전환 1주 전)
- 조건: 신규 홈페이지 `dev`에서 기능·디자인 검증 완료.
- 작업
  - [ ] 8장 승인 항목별 담당자·승인 확보
  - [ ] 리디렉션·SEO 정책, 환영 메일 새 문구 확정
  - [ ] Channel Talk V2 이전 작업 종료 여부(=`CHANNELTALK_ACCESS_*` 삭제 가능 여부) 확인
  - [ ] Vercel Production Branch·`dev.medidakos.com`·환경변수 목록 확인
- 성공: 위 항목이 문서로 확정됨. 실패: 미확정 항목은 해당 단계를 보류.

### 1단계. 운영 상태 재확인 (전환 당일, 읽기 전용)
- 작업
  - [ ] `gcloud functions list --project medidakos` → 2장 13개와 같은지
  - [ ] `gcloud scheduler jobs list --location asia-northeast3 --project medidakos` → 3개
  - [ ] `gcloud secrets list --project medidakos` → 6개
  - [ ] `channelTalkSync` source·status별 건수 재집계(5.1)
- 실패(차이 발견): 차이 원인을 확인하고 이 문서를 고친 뒤 진행.

### 2단계. 백업과 롤백 준비
- 작업
  - [ ] 현재 `main` 커밋에 태그: `git tag pre-renewal-cutover <main SHA>` 후 push(승인)
  - [ ] 현재 Vercel Production 배포 ID 기록(롤백 대상)
  - [ ] Firestore 내보내기(예): `gcloud firestore export gs://<백업 버킷>/pre-renewal-cutover --project medidakos`
  - [ ] 배포된 Firestore 규칙 사본 저장(콘솔 → 규칙 → 게시 이력)
- 성공: 태그·배포 ID·백업 경로가 기록됨. 실패: 백업 없이 다음 단계로 가지 않는다.

### 3단계. 신규 홈페이지 Production 배포
- 조건: 0~2단계 완료. 승인.
- 작업: `dev → main` PR 병합 → Vercel이 Production 배포.
- 성공
  - [ ] www.medidakos.com에 신규 홈페이지 표시, 콘솔 오류 없음
  - [ ] 로그인·회원가입·로그아웃, Channel Talk 위젯, GA4·Meta Pixel 이벤트 확인
  - [ ] 리디렉션 정책대로 동작, 기존 Landing·Dashboard 경로에서 폼 제출 불가
  - [ ] 이 시점 Functions는 기존 그대로이므로 Contact 문의는 기존 방식으로 계속 처리됨
- 실패: Vercel에서 이전 Production 배포로 즉시 롤백(Instant Rollback). Functions는 아직 바꾸지 않았으므로 영향 없음.

### 4단계. Contact 관련 Functions 선택 재배포
- 조건: 3단계 성공 후 최소 수 시간 관찰, 신규 `landingRequests`·`orders` 생성이 없는지 확인. 승인.
- 작업(예, `main` 최신 커밋에서): `firebase deploy --project medidakos --only functions:default:onContactCreated,functions:default:channelTalkOnContactCreated,functions:default:channelTalkRetry,functions:default:onUserSignup,functions:default:channelTalkOnUserCreated`
- 성공
  - [ ] `gcloud functions list`에서 해당 함수 UPDATE_TIME 갱신, ACTIVE
  - [ ] `firebase functions:log --only channelTalkRetry` 오류 없음

### 5단계. Contact 실제 연동 검증 (필수 게이트)
- 조건: 4단계 성공. **이 단계 통과 전에는 어떤 함수도 삭제하지 않는다.**
- 작업: 내부 테스트 도메인(`@techasset.co.kr`) 이메일로 운영 `/contact`에 문의 1건(승인 필요).
- 성공(모두 충족)
  - [ ] Firestore `contact`에 문서 저장
  - [ ] `channelTalkSync/contact_<id>` status `success`, steps 전부 done
  - [ ] Channel Talk에 `[TEST]` 상담 생성 **그리고** 내부 대화에 고객 정보·문의 내용 등록
  - [ ] `ADMIN_EMAILS`로 "[문의]" 알림 메일 수신
- 실패: 4단계 함수를 `pre-renewal-cutover` 태그 소스로 다시 배포해 원복하고 원인 분석. 테스트 상담은 Channel Desk에서 정리.

### 6단계. Landing·주문용 Functions 삭제
- 조건: 5단계 통과. 승인.
- 작업(예)
  - `firebase functions:delete channelTalkOnLandingCreated channelTalkOnOrderCreated --region asia-northeast3 --project medidakos`
  - `firebase functions:delete onLandingRequestCreated onSampleRequestCreated onOrderCreated --region asia-northeast3 --project medidakos`
- 결과: Landing·주문 상담 생성, 주문 메일, **Notion 주문 동기화가 중단**된다.
- 성공: 함수 목록에서 사라짐. Contact 연동 로그 정상.
- 실패: 태그 소스로 해당 함수 재배포(`NOTION_API_KEY`가 남아 있어야 `onOrderCreated` 복구 가능).

### 7단계. `ingestGmail` 정리
- 조건: Admin Inbox 데이터 수집 중단에 팀 동의. 승인.
- 작업(예): `firebase functions:delete ingestGmail --region asia-northeast3 --project medidakos`
- 성공: 함수와 `firebase-schedule-ingestGmail-…` Job 모두 사라짐. 남았으면 3장의 수동 삭제.
- 실패: 태그 소스의 `functions-ingest/`와 당시 `firebase.json`으로 재배포.

### 8단계. `lifecycleScan` 삭제 (삭제 확정, 소스는 이미 삭제됨)
- 조건: 6단계 완료. 승인.
- 작업(예): `firebase functions:delete lifecycleScan --region asia-northeast3 --project medidakos`
- 성공: 함수·Job 사라짐, 다음 날 09:00 "[육성 트랙]" 메일 미발송.
- 실패: 태그 소스로 재배포.

### 9단계. Firestore Rules 정리
- 조건: 5장 규칙안 승인, 에뮬레이터 테스트 통과.
- 작업: 규칙 PR → `firebase deploy --project medidakos --only firestore:rules`
- 성공: Contact 문의·회원가입 정상, `landingRequests` 등 쓰기 거부 확인(에뮬레이터·콘솔 Rules Playground).
- 실패: 콘솔 게시 이력에서 이전 규칙으로 되돌린다.

### 10단계. Secret·환경변수 정리
- 조건: 6~8단계 후 관찰 기간(권장 2주) 동안 문제 없음. 승인.
- 작업: 4장 표의 삭제 항목만 제거. **`CHANNELTALK_INTAKE_*`, `CHANNELTALK_WEBHOOK_TOKEN`은 삭제 금지.**
- 성공: `gcloud secrets list`·Vercel 설정에서 대상만 사라지고, Contact 연동 정상.
- 실패: Secret은 삭제 전 새 버전으로 대체 불가하므로, 삭제 전에 담당자가 값 보관 여부를 결정한다.

### 11단계. 최종 운영 검증
- [ ] 함수 6개(`onUserSignup`, `onContactCreated`, `channelTalkOnContactCreated`, `channelTalkOnUserCreated`, `channelTalkRetry`, `channelTalkLastContactWebhook`)만 ACTIVE, Scheduler는 `channelTalkRetry`만
- [ ] Contact 문의 → 상담 + 내부 대화 + 관리자 메일(5단계 기준) 재확인
- [ ] 회원가입 → 환영 메일, Channel 고객 식별
- [ ] GA4·Meta Pixel·KakaoWork Git 알림 정상
- [ ] 2주간 Functions 오류 로그, Search Console 404 모니터링
- [ ] 이 문서와 `docs/operations/firebase-functions-deployment.md`, `docs/operations/firebase-collections-and-mail.md`를 전환 결과에 맞게 갱신

---

## 8. 별도 승인 항목

| 승인 항목 | 해당 단계 | 승인자 | 승인일 |
|---|---|---|---|
| 신규 홈페이지 최종 Production 배포(`dev → main`) | 3 | | |
| Firebase Functions 수정 배포 | 4 | | |
| 운영 Contact 테스트 문의 1건 제출 | 5 | | |
| 기존 Functions 삭제(Landing·주문 5개) | 6 | | |
| Notion 주문 동기화 중단·Notion 리소스 삭제 | 6, 10 | | |
| `ingestGmail` 삭제(Admin Inbox 수집 중단) | 7 | | |
| Cloud Scheduler 삭제(함수 삭제에 따른 자동 삭제 포함) | 7, 8 | | |
| `lifecycleScan` 운영 Function·Scheduler 삭제 실행(삭제 자체는 승인됨) | 8 | | |
| Firestore Rules 변경·배포 | 9 | | |
| Secret 및 환경변수 제거 | 10 | | |
