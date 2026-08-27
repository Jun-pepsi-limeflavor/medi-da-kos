# Gmail 응답 구조 실측 (계획 3 Task 2 산출물)

**날짜:** 2026-08-27
**방법:** `mail-ingest@medidakos.iam.gserviceaccount.com` 도메인 전체 위임으로 `thomas@medidakoslabs.com`·`hally@medidakoslabs.com` 두 메일함을 가장해 `messages.list` → `messages.get(format=full)` → `profile` 순으로 호출.

## 1. 도메인 전체 위임 — 동작 확인됨

- 클라이언트 ID `113911968669628612692`(= `mail-ingest` SA의 `oauth2ClientId`/`uniqueId`, 둘이 같은 값), 범위 `gmail.readonly` + `gmail.send`로 `medidakoslabs.com` 관리콘솔에 등록.
- **등록 직후엔 `unauthorized_client`로 실패했다.** 원인은 위임 등록 문제가 아니라 **GCP 프로젝트에서 Gmail API 자체가 비활성 상태**였던 것 — `gcloud services enable gmail.googleapis.com --project medidakos`로 해결. (등록 화면의 클라이언트 ID·범위는 처음부터 정확했다.)
- 같은 위임 등록 하나로 `thomas@`·`hally@` **둘 다 동작**한다 — 사용자 단위가 아니라 도메인 단위로 걸리는 것을 확인.
- 서비스 계정 키 파일 없이 IAM Credentials API(`signJwt`)로만 토큰을 발급받았다 — 계획서의 "키 파일을 만들지 않는다" 제약을 그대로 지켰다.

## 2. 메시지 최상위 키

```
['id', 'threadId', 'labelIds', 'snippet', 'payload', 'sizeEstimate', 'historyId', 'internalDate']
```

`functions-ingest/gmail.js`의 `normalizeMessage()`가 기대하는 필드(`id`, `threadId`, `historyId`, `internalDate`, `payload`)와 정확히 일치한다. 추가 조정 불필요.

## 3. payload 구조

두 메일함 모두 실측한 메일이 `multipart/alternative`로, `text/plain` + `text/html` 두 파트였다.

```
mimeType: 'multipart/alternative'
partCount: 2
partMimeTypes: ['text/plain', 'text/html']
```

`text/plain` 파트가 항상 있었으므로 `functions-ingest/gmail.js`의 "plain 우선, 없으면 html에서 태그 벗기기" 전략이 실제 트래픽과 맞는다. **단, 표본이 메일함당 1통뿐이라 첨부파일이 있는 케이스·flat(파트 없는) 케이스는 이번 스파이크로 확인 못 했다** — 계획 6(파서) 착수 전 표본을 좀 더 늘려볼 것.

## 4. 헤더 이름 (실제 값 아님 — 이름만)

thomas@ 표본: `Received, Received, Content-Type, MIME-Version, to, from, subject, Date, Message-Id`
hally@ 표본: `MIME-Version, Date, References, In-Reply-To, Bcc, Message-ID, Subject, From, To, Content-Type`

두 표본에서 **대소문자 표기가 다르다** (`to`/`from`/`subject`/`Message-Id` vs `To`/`From`/`Subject`/`Message-ID`). `functions-ingest/gmail.js`의 `header()` 함수는 이미 `toLowerCase()`로 비교하므로 문제 없다. `References`/`In-Reply-To`는 답장 스레드에서만 나타나는 헤더로, 계획 4(회신 기능)에서 기존 대화에 답장을 이어붙일 때 이 값을 그대로 재사용하면 된다.

## 5. historyId / threadId / profile

```
thomas@: { historyId: '35431', threadId: '1a041bd68bdb6fac' }
         profile: { messagesTotal: 391, threadsTotal: 335, historyId: '35431' }

hally@:  { historyId: '38936', threadId: '1a032c436ec94bc0' }
         profile: { messagesTotal: 372, threadsTotal: 318, historyId: '39021' }
```

두 메일함 다 300통대 규모 — 초기 백필 시 `after:` 쿼리 페이지네이션이 여러 페이지에 걸칠 것을 전제로 짜야 한다(계획 3 Task 4가 이미 그렇게 돼 있다).

## 6. 계획 3이 답해야 하는 질문 (README 기준)

- **도메인 전체 위임이 동작했는가** — 동작함. 막혔던 원인은 위임 자체가 아니라 Gmail API 미활성화.
- **Gmail 응답 구조에서 예상과 달랐던 것** — 없음. 계획서가 가정한 구조와 실측이 일치했다.
- **5분 주기가 적절한가** — 이번 스파이크는 1회성 조회라 판단 보류. 실제 배포(Task 5) 후 `ingestState.processedCount` 추이로 판단할 것.
- **첨부가 실제로 얼마나 자주 오는가** — 표본 2통 모두 첨부 없음. 표본이 작아 결론 내리기엔 이르다.
- **두 페이지 이상 조회 시 동작** — 이번 스파이크는 `maxResults=3`으로 첫 페이지만 봤다. Task 4의 페이지네이션 단위 테스트로 별도 검증됨(코드 리뷰 완료, 실 데이터 다중 페이지는 미검증).

## 7. 실배포 확인 (Task 5, 2026-08-27)

`ingestGmail`을 `functions:ingest` 코드베이스로 배포하고 `INGEST_MAILBOXES=thomas@medidakoslabs.com` 하나로 5분 주기 실행을 확인했다.

- **배포 중 막혔던 것 두 가지, 둘 다 코드 문제가 아니라 IAM 문제였다:**
  1. `firebase deploy`가 Cloud Scheduler→함수 호출 IAM 바인딩 설정에서 실패 — 배포 계정이 `roles/editor`만 갖고 있어 `setIamPolicy`가 막힘. 프로젝트 Owner 계정으로 `roles/cloudfunctions.admin`·`roles/run.admin`을 배포 계정에 부여한 뒤 재배포로 해결.
  2. 재배포 후 첫 두 차례 실행이 `iam.serviceAccounts.signJwt` 권한 거부로 실패 — **배포된 함수는 로컬 스파이크 때와 다른 신원(GCP 기본 Compute 서비스 계정 `{project-number}-compute@developer.gserviceaccount.com`)으로 실행된다.** 이 신원에게도 `mail-ingest` SA에 대한 `roles/iam.serviceAccountTokenCreator`를 별도로 부여해야 했다. **계획 7(나머지 메일함 확장)에서도 이 단계를 빠뜨리지 말 것** — 계정 추가는 코드 변경이 아니라 IAM 작업이라 잊기 쉽다.
- **실행 로그 확인:** 최초 성공 회차 77통(30일 백필), 다음 5분 뒤 회차 1통.
- **결정적 ID 확인:** 위 재실행에서 "1통 처리"됐다고 로그가 났지만 `messages` 총량은 77에서 그대로였다 — 새 문서가 아니라 기존 문서 갱신이었다는 뜻. 문서 수 폭증 없음, 계획서가 우려한 실패 모드가 발생하지 않았다.
- **저장된 문서 형태 실측** (`messages`/`threads`/`ingestState` 직접 조회):
  - `messages/gmail_thomas:{id}` — `channel`·`side`·`sideSource`·`direction`·`threadKey`·`parseStatus: "pending"` 전부 계획서 그대로.
  - `threads/gmail_thomas:thomas@medidakoslabs.com:{providerThreadId}` — `readState`·`triageState`·`linkState`가 원문과 별도 문서로 존재.
  - `ingestState/thomas@medidakoslabs.com` — `lastError: null`, `processedCount`, `lastSuccessAt` 정상.
  - 표본 하나가 `bodyText` 길이 1(사실상 빈 본문)이었다 — 실제로 본문이 짧은 자동알림성 메일일 가능성이 높지만, 계획 6(파서) 착수 전 빈 본문 케이스를 어떻게 다룰지 한 번 확인해볼 것.
- **최종 상태:** `firebase functions:list` 대조 결과 `ingestGmail`만 추가되고 기존 4개 함수·확장은 그대로, `lifecycleScan`은 여전히 없음 — 코드베이스 분리가 의도대로 작동.
