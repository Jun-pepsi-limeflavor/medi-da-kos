# 카카오워크 Git 커밋 및 PR 자동 알림 연동 설계

## 개요
GitHub 리포지토리(`Jun-pepsi-limeflavor/medi-da-kos`)에서 발생하는 `dev` 브랜치 커밋 푸시 및 `main` 브랜치 대상 PR 이벤트(생성/재오픈/머지 완료)를 감지하여, 카카오워크 인커밍 웹훅(Incoming Webhook)을 통해 지정된 채팅방으로 Block Kit 기반의 정형화된 알림 메시지를 자동 전송한다.

---

## 1. 알림 이벤트 및 메시지 규격

### 1.1 `dev` 브랜치 Push 이벤트
- **트리거**: `push` on `branches: ['dev']`
- **표시 항목**:
  - **헤더**: `🚀 [dev] 새 커밋 푸시 ({N}개)` (Blue 헤더)
  - **리포지토리**: 저장소 명칭 (`Jun-pepsi-limeflavor/medi-da-kos`)
  - **푸시 작성자**: 커밋 푸셔 명칭 (`pusher.name` / `actor`)
  - **대상 브랜치**: `dev`
  - **커밋 메시지 목록**:
    - 커밋 해시(앞 7자리) + 커밋 메시지 첫 줄 + 작성자 표시 (예: `• [a1b2c3d] feat: 카카오워크 알림 (@author)`)
    - **최대 15개**까지 표시. 초과 시 `+ 외 {N}개의 커밋 더보기` 텍스트 추가.
  - **액션 버튼**: `🔍 변경사항 비교 (Compare)` (클릭 시 `compare` URL로 이동)

### 1.2 `main` 브랜치 대상 PR 생성 / 재오픈 이벤트
- **트리거**: `pull_request` on `branches: ['main']` (types: `[opened, reopened]`)
- **표시 항목**:
  - **헤더**: `📬 [PR #{number}] 풀 리퀘스트 등록` (Yellow 헤더)
  - **PR 제목**: `pull_request.title`
  - **작성자**: `pull_request.user.login`
  - **브랜치 정보**: `{head.ref} ➔ {base.ref}` (예: `dev ➔ main`)
  - **상태**: `검토 요청 (Open)` / `재오픈 (Reopened)`
  - **액션 버튼**: `👉 PR 검토 및 확인하기` (클릭 시 `pull_request.html_url`로 이동)

### 1.3 `main` 브랜치 대상 PR 머지 완료 이벤트
- **트리거**: `pull_request` on `branches: ['main']` (types: `[closed]`, 조건: `github.event.pull_request.merged == true`)
- **표시 항목**:
  - **헤더**: `🎉 [PR #{number}] main 브랜치 머지 완료` (Blue 헤더)
  - **PR 제목**: `pull_request.title`
  - **머지 진행자**: `pull_request.merged_by.login`
  - **브랜치 정보**: `{head.ref} ➔ {base.ref}`
  - **안내 문구**: `main 브랜치에 성공적으로 머지되었습니다.`
  - **액션 버튼**: `🔍 머지된 PR 내역 보기` (클릭 시 `pull_request.html_url`로 이동)

---

## 2. 아키텍처 및 보안 관리

### 2.1 보안 관리
- 카카오워크 인커밍 웹훅 URL(`https://api.kakaowork.com/v1/webhooks/ca5d4dec.70314c0bf13641aebc8c2e3cab0a0902`)은 소스코드에 하드코딩하지 않고, GitHub Repository Secret `KAKAOWORK_WEBHOOK_URL`을 통해 주입한다.
- 워크플로우 실행 시 `env.KAKAOWORK_WEBHOOK_URL` 환경변수로 스크립트에 전달하며, 환경변수가 비어 있을 경우 오류를 로깅하고 종료한다.

### 2.2 디렉터리 및 파일 구조
```text
.github/
├── workflows/
│   └── kakaowork-notify.yml       # GitHub Actions 워크플로우 정의
└── scripts/
    └── kakaowork-notify.mjs       # 이벤트 페이로드 파싱 및 카카오워크 Block Kit 전송 스크립트
```

### 2.3 스크립트 (`kakaowork-notify.mjs`) 동작 흐름
1. `GITHUB_EVENT_PATH`에서 이벤트 원본 JSON을 읽는다.
2. `GITHUB_EVENT_NAME` 및 이벤트 액션(push, pull_request.opened, pull_request.closed 등)을 판별한다.
3. PR closed 이벤트 중 `merged === false`(단순 닫힘)인 경우는 알림 대상에서 제외한다.
4. 카카오워크 Block Kit 규격(JSON)으로 메시지를 빌드한다:
   - `header` 블록 (이벤트별 스타일: `blue`, `yellow`)
   - `description` 블록들 (작성자, 브랜치 정보 등)
   - `divider` 블록
   - `text` 블록 (커밋 목록 - 최대 15개 자르기 및 markdown 이스케이프)
   - `button` 블록 (Compare URL 또는 PR 링크)
5. `fetch(process.env.KAKAOWORK_WEBHOOK_URL, { method: 'POST', ... })`를 통해 카카오워크로 메시지를 전송하고 응답 상태를 검증한다.

---

## 3. 검증 계획

### 3.1 스크립트 단위 테스트 (Node.js)
- `tests/kakaowork-notify.test.mjs` 작성:
  1. `push` 이벤트 페이로드 (15개 이상 커밋 포함 mock) 테스트: 15개 제한 슬라이싱 및 Compare 버튼 확인.
  2. `pull_request` (opened) mock 테스트: PR 제목, 작성자, 브랜치(`dev -> main`), PR 링크 확인.
  3. `pull_request` (closed & merged = true) mock 테스트: 머지 진행자(`merged_by`) 정보 및 축하 헤더 확인.
  4. `pull_request` (closed & merged = false) mock 테스트: 알림 미발송(skip) 처리 확인.
- `node --test tests/kakaowork-notify.test.mjs` 실행.

### 3.2 로컬 실발송 드라이런 검증
- 실제 카카오워크 웹훅 엔드포인트로 샘플 테스트 메시지를 전송하여 카카오워크 대화방에 블록킷 포맷이 정상적으로 렌더링되는지 확인.
- `npm run typecheck`, `npm run lint`, `npm test` 전체 통과 확인.
