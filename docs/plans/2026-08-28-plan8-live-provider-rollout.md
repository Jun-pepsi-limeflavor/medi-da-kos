# Plan 8 — 운영 제공자 연결 및 검증

## 목적

Plan 7의 소스·에뮬레이터 검증을 실제 Firebase/메일 제공자 운영 검증으로
완성한다. 외부 수신자 메일 발송, 기존 Firestore 문서 backfill, Secret 생성은
각 단계의 명시적 승인 없이는 실행하지 않는다.

## 현재 상태

- `onContactCreated`, `onKoreaLeadCreated`, `onOrderCreated`,
  `onSampleRequestCreated`는 `messages`·`threads` 웹 투영을 포함해 Firebase에
  배포됐다.
- Gmail 수집의 새 allowlist·cursor·30일 backfill 코드는 운영 revision
  `ingestgmail-00003-hab`에 배포됐다. 첫 스케줄에서 Thomas가 성공했지만,
  현재 운영 `INGEST_MAILBOXES`는 Thomas만 활성화한다.
- Outlook와 Channel Talk normalizer/paging 코드는 단위 테스트로만 검증됐다.
  실제 anonymized fixture, 자격증명, read-only canary는 없다.
- 운영 Secret Manager에 `OUTLOOK_CLIENT_SECRET`이 존재하지 않는다. 값은
  확인하거나 저장소에 넣지 않았다.
- Next 관리자 답장 UI/API는 Firebase Functions 배포 대상이 아니다. 현재
  웹 애플리케이션 배포 상태를 별도로 확인해야 한다.

## 선행 계약

- `ingestState`는 Gmail 계정 주소, `outlook:<mailbox>`,
  `channeltalk:<desk-account>`별로 분리한다. 제공자 cursor는 모든 메시지를
  저장한 뒤에만 전진한다.
- Outlook/Channel Talk 자격증명은 Secret Manager에만 둔다. 새 secret binding을
  가진 제공자 스케줄은 Gmail 수집 함수와 분리해, 누락된 제공자 credential이
  Gmail 배포를 막지 않게 한다.
- 원가·공급가·마진은 `messages` projection, provider logs, reply API 응답에
  포함하지 않는다. `messages`·`threads`·`ingestState` Firestore 규칙은
  클라이언트 차단을 유지한다.
- 어떤 canary도 실제 바이어/제조사에게 보내지 않는다. 외부 발송은 테스트
  수신자 한 곳과 별도 승인으로만 실행한다.

## 작업

### 1. Gmail 운영 수집 확장 및 읽기 검증

- 운영 런타임의 Thomas 결과와 `ingestState`를 읽어, 2026-07-29T00:00:00Z
  초기 범위와 재수집 dedupe를 수·시간·ID만으로 확인한다.
- Hally의 운영 런타임 `mail-ingest` impersonation과 `gmail.readonly` 위임을
  `profile` 및 한 페이지 읽기 canary로 확인한 뒤에만 `INGEST_MAILBOXES`에
  추가한다. 토큰/본문은 로그에 남기지 않는다.
- Techasset 네 계정은 해당 도메인의 DWD와 `gmail.readonly` canary가 모두
  성공한 후에만 하나씩 활성화한다.

### 2. Gmail 답장 운영 canary

- 관리자 웹 앱의 `FIREBASE_SERVICE_ACCOUNT_B64` 보관 위치와
  `mail-ingest`에 대한 `signJwt` 권한을 검증한다.
- `gmail.send` 위임을 확인한 뒤, 승인된 테스트 주소 한 곳에 한 번만
  답장한다. 같은 provider thread, outbound `messages` 문서, 다음 poll의
  dedupe를 확인한다.
- provider 응답 또는 Firestore 기록이 불명확하면 다시 보내지 않고
  `ingestState`/운영 로그로 조정한다.

### 3. Outlook 제공자 함수

- 실제 Graph response를 익명화해 message/conversation/body/attachment/
  `@odata.nextLink`/`@odata.deltaLink` fixture로 보관한다.
- tenant/client/mailbox non-secret 설정과 `OUTLOOK_CLIENT_SECRET`을 Secret
  Manager에 준비하고, `Mail.Read`·`Mail.Send` app permission 및 `support@`
  동의를 확인한다.
- Gmail과 분리된 Outlook 수집 함수에 Secret을 bind하고 read-only canary를
  실행한다. delta 만료 시 승인된 범위의 backfill로 복구한다.

### 4. Channel Talk 제공자 함수

- Desk에서 읽은 실제 payload를 익명화해 chat/message author·timestamp·files·
  cursor shape를 확정한다.
- `CHANNELTALK_ACCESS_KEY`, `CHANNELTALK_ACCESS_SECRET`, `CHANNELTALK_VERSION`
  을 Secret Manager에 넣고 polling 전용 함수에만 bind한다.
- 한 chat의 Desk 메시지 수와 Firestore 저장 수를 비교한다. 웹훅은 검증된
  서명 계약이 생길 때까지 추가하지 않는다.

### 5. Firebase/운영 정합성

- 배포된 Firestore rules를 소스의 내부 컬렉션 차단 규칙과 비교한다. 실제
  문서나 고객 데이터를 수정하는 테스트는 하지 않는다.
- 신규 트리거는 새 폼 제출만 투영한다. 기존 `contact`, `koreaLeads`, `orders`,
  `sampleRequests` backfill은 대상 수와 중복 정책을 검토해 별도 승인받는다.
- Node.js 20은 2026-10-30 이후 배포할 수 없으므로, Functions runtime과
  `firebase-functions` 업그레이드를 별도 호환성 작업으로 계획한다.
- `onLandingRequestCreated`, `lifecycleScan`은 Plan 7 범위가 아니다. 다시
  활성화하려면 원래의 운영 의도와 발송 영향에 대한 별도 승인을 받는다.

## 완료 기준

- 각 활성 Gmail 계정의 read-only canary와 계정별 cursor 증거가 있다.
- Outlook/Channel Talk은 실제 익명 fixture, Secret binding, read-only
  provider count 비교를 통과했다.
- Gmail 답장은 승인된 테스트 수신자에게 정확히 한 번만 전송·저장·재수집됐다.
- 배포된 Firebase Functions/Rules가 소스와 일치하고, 사용자 클라이언트가
  내부 컬렉션을 읽거나 쓸 수 없다는 emulator 및 운영 검토 증거가 있다.
