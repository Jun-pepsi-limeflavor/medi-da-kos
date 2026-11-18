# 카카오워크 Git 알림 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub 리포지토리의 `dev` 브랜치 커밋 푸시(최대 15개) 및 `main` 대상 PR 이벤트(생성/재오픈/머지)를 감지하여 카카오워크 인커밍 웹훅으로 정형화된 알림 메시지를 자동 전송한다.

**Architecture:** GitHub Actions 워크플로우(`.github/workflows/kakaowork-notify.yml`)에서 이벤트 발생 시 Node.js 전용 스크립트(`.github/scripts/kakaowork-notify.mjs`)를 실행하고, 이벤트 페이로드를 파싱하여 카카오워크 Block Kit 메시지 규격으로 변환 후 안전하게 웹훅 엔드포인트로 HTTP POST 전송한다.

**Tech Stack:** GitHub Actions, Node.js (ESM), KakaoWork Block Kit API, Node 내장 `node --test`

## Global Constraints
- `dev` 브랜치 Push: 푸시된 커밋 메시지 목록 (최대 15개), 작성자, 변경사항 비교 링크(compare)
- `main` 브랜치 PR 생성/재오픈: PR 제목, 작성자, 브랜치 정보(`dev -> main`), PR 링크
- `main` 브랜치 PR 머지 완료: PR 제목, 머지 진행자(`merged_by`), PR 링크 (단순 close는 무시)
- 웹훅 URL은 `KAKAOWORK_WEBHOOK_URL` 환경변수(GitHub Secret)로 주입
- 모든 코드는 Node.js 20+ ESM 기반으로 작성하고 의존성 추가 없이 순수 내장 API(`fetch`, `fs`, `path`)를 사용

---

### Task 1: 카카오워크 알림 메시지 빌더 및 전송 스크립트 구현 (TDD)

**Files:**
- Create: `.github/scripts/kakaowork-notify.mjs`
- Test: `tests/kakaowork-notify.test.mjs`

**Interfaces:**
- Consumes:
  - `event`: GitHub Actions 이벤트 객체 (`push` 또는 `pull_request`)
  - `eventName`: `'push' | 'pull_request'`
- Produces:
  - `buildKakaoWorkPayload(eventName, event)`: `{ text: string, blocks: Array<object> } | null`
  - `sendKakaoWorkMessage(webhookUrl, payload, fetchFn?)`: `Promise<{ ok: boolean, status: number, body?: string }>`
  - CLI 엔트리포인트 실행 (`GITHUB_EVENT_PATH`, `GITHUB_EVENT_NAME`, `KAKAOWORK_WEBHOOK_URL` 파싱)

- [ ] **Step 1: 실패하는 단위 테스트 작성 (`tests/kakaowork-notify.test.mjs`)**
  - Push 이벤트: 커밋 20개 입력 시 상위 15개만 렌더링되고 "+ 외 5개의 커밋 더보기" 문구 생성 확인
  - Push 이벤트: compare URL 버튼 생성 확인
  - PR Opened/Reopened: PR 제목, 작성자, 브랜치 매핑(`dev ➔ main`), PR 버튼 확인
  - PR Closed & Merged: 머지 진행자, 축하 헤더, PR 버튼 확인
  - PR Closed & Merged = false: `null` 반환(알림 스킵) 확인
  - `sendKakaoWorkMessage`: 정상 200 반환 및 웹훅 URL 누락 시 에러 throw 확인

- [ ] **Step 2: 테스트 실행하여 실패 확인**
  - 실행: `node --test tests/kakaowork-notify.test.mjs`
  - 기대 결과: 모듈 부재 또는 구현 미완료로 인한 FAIL

- [ ] **Step 3: 스크립트 본체 구현 (`.github/scripts/kakaowork-notify.mjs`)**
  - `buildKakaoWorkPayload(eventName, event)` 구현
  - `sendKakaoWorkMessage(webhookUrl, payload, fetchFn = fetch)` 구현
  - CLI 자동 실행 로직 (직접 실행 시 `process.env` 읽어 처리)

- [ ] **Step 4: 테스트 재실행하여 PASS 확인**
  - 실행: `node --test tests/kakaowork-notify.test.mjs`
  - 기대 결과: 모든 테스트 통과 (PASS)

---

### Task 2: GitHub Actions 워크플로우 구성 및 로컬 검증

**Files:**
- Create: `.github/workflows/kakaowork-notify.yml`

**Interfaces:**
- Triggers:
  - `push` on branch `dev`
  - `pull_request` on branch `main` (types: `[opened, reopened, closed]`)
- Environment:
  - `KAKAOWORK_WEBHOOK_URL`: `${{ secrets.KAKAOWORK_WEBHOOK_URL }}`

- [ ] **Step 1: 워크플로우 YAML 파일 생성 (`.github/workflows/kakaowork-notify.yml`)**
  - trigger 설정 (`push` to `dev`, `pull_request` to `main`)
  - Node 20 환경 설정 및 `.github/scripts/kakaowork-notify.mjs` 실행 단계 구성
  - `secrets.KAKAOWORK_WEBHOOK_URL` 주입

- [ ] **Step 2: 전체 린트 / 타입체크 / 테스트 검증**
  - 실행: `npm run lint && npm run typecheck && npm test`
  - 기대 결과: 0 에러, 전체 테스트 PASS

- [ ] **Step 3: 웹훅 엔드포인트 연동 검증**
  - 실제 제공된 엔드포인트(`https://api.kakaowork.com/v1/webhooks/ca5d4dec.70314c0bf13641aebc8c2e3cab0a0902`)로 테스트 메시지 1회 드라이런 발송 확인
