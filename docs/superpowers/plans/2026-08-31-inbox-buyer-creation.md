# 검토함 신규 바이어 등록 및 AI 브리프 연계 워크플로우 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 받은편지함 검토함(`queue=unclassified`)에서 신규 바이어 문의 확인 시, 메일 본문 기반 실명 자동 추출과 함께 신규 바이어 및 대화를 생성하고, AI 브리프/추출을 자동 연계하여 고객 업무 및 딜 파이프라인으로 연결한다.

**Architecture:**
1. 본문 실명 추출기(`src/lib/name-extractor.ts`)를 경량 정규식/패턴 매칭으로 구현하여 클라이언트 폼 프리필 및 파서에 활용.
2. `classifyIdentity` 및 API 스키마를 확장하여 신규 바이어(`buyerMode: "new"`) 입력 시 바이어 생성, 대화 생성, thread 연결, AI 추출을 일괄 트랜잭션/파이프라인으로 처리.
3. `ReviewQueue.tsx`에 신규 바이어 등록 모드 기본 활성화, 자동 프리필, 완료 후 이동/잔류 선택 모달 구현.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Zod, Firebase Admin SDK (Firestore), React 19, Tailwind CSS v4, Lucide React, Node 내장 `node --test`.

## Global Constraints
- 원가/마진/재무 데이터는 클라이언트에 절대 노출하지 않는다.
- 어드민은 Firebase 클라이언트 SDK를 사용하지 않으며 서버 컴포넌트 및 `withAdmin` route handler를 사용한다.
- `buyers`, `deals`, `conversations`, `messages`는 클라이언트에서 직접 접근하지 않는다.
- 담당자(Owner/Assignee)는 대화/바이어가 아닌 개별 딜(`deals`) 단위로 지정되며, 대화 생성 시 기본은 `미배정`이다.
- 배포 및 커밋은 명시적 승인 하에 진행하며, `npm test`, `npm run typecheck`, `npm run lint` 통과를 필수로 한다.

---

### Task 1: 경량 본문 이름 추출 엔진 구현 (`src/lib/name-extractor.ts`)

**Files:**
- Create: `src/lib/name-extractor.ts`
- Test: `tests/name-extractor.test.mjs`

**Interfaces:**
- Produces: `extractBuyerNameFromBody(bodyText: string, fallbackName?: string): string`

- [ ] **Step 1: 실패하는 단위 테스트 작성 (`tests/name-extractor.test.mjs`)**

```javascript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractBuyerNameFromBody } from "../src/lib/name-extractor.ts";

describe("extractBuyerNameFromBody", () => {
  test("영문 서명(Sign-off)에서 이름 추출", () => {
    const body = "Hi, we want 5000 units of serum.\n\nBest regards,\nJohn Doe\nAcme Corp";
    assert.equal(extractBuyerNameFromBody(body), "John Doe");
  });

  test("영문 자기소개(Intro)에서 이름 추출", () => {
    const body = "Hello, my name is Sarah Connor and I am looking for OEM toner.";
    assert.equal(extractBuyerNameFromBody(body), "Sarah Connor");
  });

  test("국문 자기소개 및 서명에서 이름 추출", () => {
    const body1 = "안녕하세요, 뷰티코스메틱의 홍길동 팀장입니다. 수분크림 OEM 견적 문의드립니다.";
    assert.equal(extractBuyerNameFromBody(body1), "홍길동");

    const body2 = "수분 세럼 MOQ 문의드립니다.\n\n김철수 드림";
    assert.equal(extractBuyerNameFromBody(body2), "김철수");
  });

  test("패턴이 없는 경우 공란 또는 fallback 반환", () => {
    const body = "Please send catalogue and price list.";
    assert.equal(extractBuyerNameFromBody(body), "");
    assert.equal(extractBuyerNameFromBody(body, "Fallback Name"), "Fallback Name");
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/name-extractor.test.mjs`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: `src/lib/name-extractor.ts` 구현**

```typescript
/**
 * 메일 본문에서 바이어 실명을 경량 정규식 및 패턴 매칭으로 추출한다.
 * LLM을 호출하지 않으며, 패턴이 불명확한 경우 억지로 지어내지 않고 공란(또는 fallback)을 반환한다.
 */
export function extractBuyerNameFromBody(bodyText?: string | null, fallbackName?: string): string {
  if (!bodyText || typeof bodyText !== "string") {
    return fallbackName?.trim() || "";
  }

  const clean = bodyText.trim();

  // 1. 영문 서명 패턴 (하단 Sign-off)
  const enSignOff = /(?:best regards|warm regards|kind regards|regards|thanks & regards|thanks|thank you|sincerely|cheers)[,\s]*\r?\n+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;
  const signMatch = clean.match(enSignOff);
  if (signMatch && signMatch[1].trim().length >= 2) {
    const name = signMatch[1].trim();
    if (!["team", "support", "sales", "info", "admin"].includes(name.toLowerCase())) {
      return name;
    }
  }

  // 2. 영문 자기소개 패턴 (첫머리 소개)
  const enIntro = /\b(?:my name is|i am|this is|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;
  const introMatch = clean.match(enIntro);
  if (introMatch && introMatch[1].trim().length >= 2) {
    const name = introMatch[1].trim();
    if (!["interested", "writing", "looking", "contacting"].includes(name.toLowerCase())) {
      return name;
    }
  }

  // 3. 국문 자기소개 패턴
  const koIntro = /(?:안녕하세요[,\s]+)?(?:(?:주식회사\s*)?[가-힣A-Za-z0-9\s]+(?:의|에서\s*근무하는)\s*)?([가-힣]{2,4})\s*(?:입니다|팀장|대표|과장|대리|매니저|담당자|이사|실장)\b/;
  const koIntroMatch = clean.match(koIntro);
  if (koIntroMatch && koIntroMatch[1].trim().length >= 2) {
    return koIntroMatch[1].trim();
  }

  // 4. 국문 서명 패턴
  const koSign = /([가-힣]{2,4})\s*(?:드림|올림|배상)\b/;
  const koSignMatch = clean.match(koSign);
  if (koSignMatch && koSignMatch[1].trim().length >= 2) {
    return koSignMatch[1].trim();
  }

  return fallbackName?.trim() || "";
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/name-extractor.test.mjs`
Expected: PASS

---

### Task 2: 신규 바이어 생성 및 대화 승격 서버 파이프라인 확장

**Files:**
- Modify: `src/lib/repo/conversations.ts`
- Modify: `src/app/api/admin/conversation-identities/[identityId]/classify/route.ts`
- Test: `tests/classify-new-buyer.test.mjs`

**Interfaces:**
- Consumes: `buyerInputSchema` from `src/lib/schemas/buyer.ts`, `runMessageExtraction` from `src/lib/extractor.ts`
- Produces: `classifyIdentity(identityId, input, actor)` returning `{ ok: true, buyerId: string, conversationId: string }`

- [ ] **Step 1: `identityClassificationInputSchema` 및 `classifyIdentity` 수정**
  - `identityClassificationInputSchema`에 `buyerMode: "new"` 및 `buyer: buyerInputSchema`, `autoExtractBrief` 지원.
  - `classifyIdentity`에서 `buyerMode === "new"`일 때:
    1. `createBuyer`로 바이어 생성
    2. `conversations` 문서 신규 생성 (기본 `workflowState: "active"`, `ownerEmail: undefined`)
    3. `conversationIdentities` 및 `threads` 연결
    4. `autoExtractBrief`가 true인 경우 `anchorMessage`에 대해 `runMessageExtraction` 실행 후 `updateMessageExtraction` 및 인테이크 동기화.

- [ ] **Step 2: API Route `POST /api/admin/conversation-identities/[identityId]/classify`에서 `buyerId`, `conversationId` 응답 반환**

- [ ] **Step 3: 테스트 코드 작성 및 실행**

Run: `node --test tests/classify-new-buyer.test.mjs`
Expected: PASS

---

### Task 3: 검토함 UI 신규 바이어 등록 폼 및 완료 모달 구현

**Files:**
- Modify: `src/app/admin/(dash)/inbox/ReviewQueue.tsx`

**Features:**
- [ ] **Step 1: 모달 탭 상태 (`[신규 바이어 등록]` / `[기존 바이어 연결]`) 및 폼 필드 상태 추가**
  - 신규 바이어 폼 필드:
    - 바이어 이름 (`name`): `extractBuyerNameFromBody(anchorMessage?.bodyText, anchorMessage?.fromName)`로 초기값 자동 완성 (공란 허용)
    - 대표 이메일 (`emails`): `activeIdentity.identity.value`
    - 유입 채널 (`inflowChannel`): `activeIdentity.channels[0]` 매핑 (예: `gmail_hally` 등)
    - 브랜드/회사명 (`brandName`): 이메일 도메인 또는 본문 추정값
    - 국가 (`country`), 전화번호 (`phone`): 선택 입력
    - 분류 사유 (`reason`): 기본 `"정상 바이어 문의 확인"`
    - AI 브리프 자동 생성 체크박스: 기본 checked
- [ ] **Step 2: 승인 완료 후 의사 확인 팝업 (Success Dialog)**
  - 승인 완료 시 성공 다이얼로그 표시:
    - `[고객 업무(대화)로 바로 이동]` -> `router.push('/admin/inbox?queue=customer-work&conversationId=' + newConvId)`
    - `[검토함에 머무르기]` -> 모달 닫기 및 검토함 리프레시 (`router.refresh()`)

---

### Task 4: 전체 빌드 및 회귀 검증

- [ ] **Step 1: 타입체크 실행**
  Run: `npm run typecheck`
  Expected: No TypeScript errors

- [ ] **Step 2: 린트 검사 실행**
  Run: `npm run lint`
  Expected: No ESLint errors

- [ ] **Step 3: 전체 단위 테스트 실행**
  Run: `npm test`
  Expected: All tests pass

- [ ] **Step 4: 브라우저 동작 검증**
  - 검토함(`queue=unclassified`)에서 `[1] 정상 바이어 승인` 클릭.
  - 신규 바이어 등록 폼에 본문 추출 이름/이메일/채널이 자동 완성되는지 확인.
  - `분류 확정` 클릭 후 완료 팝업 및 `[고객 업무로 이동]` 동작 검증.
