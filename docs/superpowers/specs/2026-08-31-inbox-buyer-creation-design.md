# 검토함 신규 바이어 등록 및 AI 브리프 연계 워크플로우 설계

## 개요
관리자 받은편지함의 **검토함(`queue=unclassified`)**에서 미분류 인바운드 문의를 확인한 후, 기존 바이어 목록에 없는 신규 바이어를 즉시 등록하고 대화를 개설하며, AI를 통해 브리프/제품 사양을 자동 추출하여 고객 업무 및 딜 파이프라인으로 연결하는 워크플로우를 구현한다.

---

## 1. 핵심 정책 및 요구사항 반영

1. **코드 기반 본문 이름 추출 (LLM 호출 제외)**:
   - LLM을 사전 호출하지 않고, 정규식 및 휴리스틱 코드 알고리즘(`extractBuyerNameFromBody`)으로 메일 본문 첫머리 자기소개("My name is ...", "안녕하세요 OOO입니다")나 하단 서명("Best regards, Sarah")에서 바이어 실명을 가볍고 즉각적으로 추출한다.
   - 패턴이 감지되지 않거나 불명확한 경우, 무리하게 추측하지 않고 **공란**으로 두어 운영자가 직접 확인·입력할 수 있도록 한다.
2. **담당자 도메인 개념 정리 (Deal 중심)**:
   - 담당자(Owner/Assignee)는 바이어나 대화 단위가 아니라, 바이어와 진행하는 **개별 딜(`deals`)** 단위로 지정된다.
   - 대화(`conversations`)는 메일/채널 소통의 통합 채널 역할을 하며, 딜 전환 단계에서 해당 딜의 주담당자가 지정된다.
3. **신규 바이어 등록 폼 및 원클릭 워크플로우**:
   - `[1] 정상 바이어 승인` 클릭 시 기본적으로 **신규 바이어 등록** 모드가 열린다.
   - 본문 추출 이름(또는 공란), 식별자 이메일, 수신 채널(예: `gmail_hally`), 브랜드명이 자동 프리필된다.
   - 기존 바이어에 연결해야 하는 경우를 위한 `기존 바이어 연결` 모드 탭도 함께 제공한다.
4. **AI 브리프 자동 생성 연계**:
   - 신규 바이어 승인 시 인바운드 본문에 대한 AI 추출(`runMessageExtraction`)을 백그라운드로 실행하여 제품 사양, 수량, 일정, 인증 데이터를 자동 추출하고 메시지/인테이크에 반영한다.
5. **완료 후 사용자 의사 확인 모달**:
   - 바이어 및 대화 생성 완료 시 완료 팝업을 띄워:
     - `[고객 업무(대화)로 바로 이동]`
     - `[검토함에 남아 계속 분류]`
     중 선택할 수 있게 한다.

---

## 2. 세부 설계

### 2.1 본문 기반 이름 추출기 (`src/lib/name-extractor.ts` 또는 `src/lib/extractor.ts`)
- **경량 정규식 & 패턴 매칭 (`extractBuyerNameFromBody`)**:
  ```ts
  export function extractBuyerNameFromBody(bodyText: string, fallbackName?: string): string {
    if (!bodyText) return fallbackName?.trim() || "";

    // 1. 영문 서명 패턴 (하단 Sign-off)
    const enSignOff = /(?:best regards|warm regards|kind regards|regards|thanks & regards|thanks|thank you|sincerely|cheers)[,\s]*\r?\n+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;
    const signMatch = bodyText.match(enSignOff);
    if (signMatch && signMatch[1].trim().length >= 2) {
      return signMatch[1].trim();
    }

    // 2. 영문 자기소개 패턴 (첫머리 소개)
    const enIntro = /\b(?:my name is|i am|this is|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;
    const introMatch = bodyText.match(enIntro);
    if (introMatch && introMatch[1].trim().length >= 2) {
      return introMatch[1].trim();
    }

    // 3. 국문 자기소개 및 서명 패턴
    const koIntro = /(?:안녕하세요[,\s]+)?(?:(?:주식회사\s*)?[가-힣A-Za-z0-9\s]+(?:의|에서\s*근무하는)\s*)?([가-힣]{2,4})\s*(?:입니다|팀장|대표|과장|대리|매니저|드림|올림)\b/;
    const koMatch = bodyText.match(koIntro);
    if (koMatch && koMatch[1].trim().length >= 2) {
      return koMatch[1].trim();
    }

    // 4. 불명확한 경우 공란 (지어내지 않음)
    return "";
  }
  ```

### 2.2 클라이언트 UI (`src/app/admin/(dash)/inbox/ReviewQueue.tsx`)
- **정상 바이어 승인 액션 영역**:
  - 탭: `[신규 바이어 등록 (기본)]` / `[기존 바이어 연결]`
  - **신규 바이어 등록 필드**:
    - **바이어 이름**: 본문 추출 이름 (없으면 공란, placeholder: "바이어 담당자 이름 입력")
    - **대표 이메일**: `identity.value` (수정 가능)
    - **유입 채널**: `latestThread.channel` 자동 매핑 (예: `gmail_hally` 등)
    - **브랜드명 / 회사명**: 이메일 도메인 또는 본문 추정값
    - **국가 / 전화번호**: 선택 입력
    - **분류 사유**: `"정상 바이어 문의 확인"`
    - **옵션**: `[v] 승인 즉시 AI 브리프 자동 추출 실행` (기본 체크)
- **완료 확인 모달**:
  - `[고객 업무(대화)로 이동]` 버튼 클릭 시 `/admin/inbox?queue=customer-work&conversationId=${newConversationId}`로 이동.
  - `[검토함에 머무르기]` 버튼 클릭 시 모달 닫기 및 검토함 목록 갱신(`router.refresh()`).

### 2.3 서버 데이터 파이프라인 (`src/lib/repo/conversations.ts` & API)
- **`POST /api/admin/conversation-identities/[identityId]/classify` 요청 스키마**:
  ```ts
  z.discriminatedUnion("classification", [
    z.object({
      classification: z.literal("buyer"),
      buyerMode: z.literal("new").default("new"),
      buyer: buyerInputSchema,
      reason: reasonSchema,
      autoExtractBrief: z.boolean().optional().default(true),
    }).strict(),
    z.object({
      classification: z.literal("buyer"),
      buyerMode: z.literal("existing"),
      buyerId: idSchema,
      conversationId: idSchema.optional(),
      reason: reasonSchema,
      autoExtractBrief: z.boolean().optional().default(true),
    }).strict(),
    // supplier, internal, advertising ...
  ])
  ```
- **`classifyIdentity` 트랜잭션 수행**:
  1. `buyers` 컬렉션에 새 바이어 문서 생성.
  2. `conversations` 컬렉션에 새 대화 문서 생성 (`buyerId`, `identityIds`, `workflowState: "active"`, `counterpartyLabel`, `lastSubject`, `lastSnippet`, `providerLabels` 등).
  3. `conversationIdentities/{identityId}` 문서 업데이트 (`classification: "buyer"`, `buyerId`, `conversationId`).
  4. 해당 identity의 모든 `threads` 문서 업데이트 (`classification: "buyer"`, `buyerId`, `conversationId`).
  5. 대화 및 식별자 감사 이벤트 기록.
  6. `autoExtractBrief: true`인 경우, `runMessageExtraction`을 실행하여 `messages` 및 `intakeReviews`에 AI 추출 데이터 저장.
  7. `{ ok: true, buyerId: newBuyer.id, conversationId: newConv.id }` 반환.

---

## 3. 검증 계획
1. **단위 테스트**:
   - `extractBuyerNameFromBody` 테스트: 영문 서명/소개, 국문 서명/소개, 불명확한 경우 공란 반환 검증.
   - `classifyIdentity` 신규 바이어 생성 및 대화 연동, thread 갱신, AI 추출 파이프라인 테스트.
   - `npm test`, `npm run typecheck`, `npm run lint`.
2. **UI 브라우저 검증**:
   - 검토함에서 `[1] 정상 바이어 승인` 클릭 시 신규 바이어 모드 기본 활성화 및 자동 프리필 확인.
   - 승인 후 완료 모달에서 '고객 업무로 이동' 및 '검토함 잔류' 선택 동작 확인.
   - 생성된 대화의 딜 인큐베이터에서 AI 브리프/추출 데이터 정상 표출 확인.
