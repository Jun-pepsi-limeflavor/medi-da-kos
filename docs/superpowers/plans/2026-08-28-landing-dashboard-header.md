# 랜딩 대시보드 상단 프로세스 로드맵 및 트러스트 바 구현 계획서 (Phase 2: CTA 점진적 노출 및 스크롤)

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랜딩 대시보드(`/landing/dashboard`)에서 처음부터 위저드 입력 폼을 노출하지 않고, '작성 시작하기' CTA 클릭 시 위저드가 노출되며 부드러운 스크롤로 포커스되도록 구현.

**Architecture:** `LandingDashboardHeader`에 `isStarted` 및 `onStart` prop을 추가하여 CTA 버튼을 제공하고, `CMWizard`에서 consultation 모드일 때 위저드 카드를 조건부 렌더링하고 smooth scroll 처리.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript strict, Tailwind v4, lucide-react.

---

### Task 1: `LandingDashboardHeader`에 시작하기 CTA 섹션 추가

**Files:**
- Modify: `src/components/landing/LandingDashboardHeader.tsx`

- [ ] **Step 1: props 및 CTA UI 추가**
  - `isStarted?: boolean`, `onStart?: () => void` 추가
  - `!isStarted`일 때 'Start Your Product Brief' CTA 박스 노출
  - `isStarted`일 때 '● Brief in progress' 미니 뱃지 전환

---

### Task 2: `CMWizard`의 조건부 카드 노출 및 스크롤 로직

**Files:**
- Modify: `src/components/dashboard/CMWizard.tsx`

- [ ] **Step 1: 상태 및 스크롤 핸들러 구현**
  - `isStarted` 상태 (초기값: 기존 draft가 있으면 true, 없으면 false)
  - `handleStartBrief`: `setIsStarted(true)` 및 `wizardCardRef.current?.scrollIntoView({ behavior: 'smooth' })`
  - 위저드 카드 조건부 렌더링 및 `scroll-mt-8` 적용

---

### Task 3: 테스트 및 검증

**Files:**
- Modify: `tests/landing-dashboard-header.test.ts`

- [ ] **Step 1: 단위 테스트 갱신 및 실행**
- [ ] **Step 2: `npm run typecheck` 및 린트 통과 확인**
