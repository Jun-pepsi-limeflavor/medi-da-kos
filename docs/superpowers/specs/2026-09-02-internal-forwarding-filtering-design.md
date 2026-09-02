# Outlook Support 수신함 사내 포워딩/내부 메일 필터링 기획 및 설계 (Design Spec)

## 1. 개요 및 배경

### 1.1 문제 상황
- 사내 직원이 개인 계정(예: `@gmail.com`) 또는 외부 메일 클라이언트를 사용하여 공장/제조사에 업무 의뢰 메일을 발신하면서 `support@medidakos.com`(Outlook)을 참조(CC/BCC)하거나 포워딩하는 경우 발생.
- 현재 시스템의 사내 도메인 검사(`isInternalEmail`)는 발신자 이메일 주소의 도메인(`from.split("@")[1]`)만 확인하므로, 발신자 메일이 `@gmail.com`인 경우 외부 바이어의 신규 문의로 오인식됨.
- 이로 인해:
  1. 사내 직원(예: 송준하 님)이 바이어로 등록되고 **"고객 업무(Customer-Work)"** 큐에 노출됨.
  2. AI 추출기(Extraction)가 사내 발신 의뢰서/메일을 바이어 인바운드 딜로 추출하려고 시도함.

### 1.2 목표
1. **본문 서명/내용 감지**: 발신자 주소가 사내 도메인이 아니더라도, 본문 서명/연락처에 사내 도메인(`@techasset.co.kr`, `@medidakos.com`, `@medidakoslabs.com`) 또는 사내 담당자 명기가 있는 경우 사내 내부 메일(`internal`)로 자동 판별.
2. **'광고·내부' 큐 분류**: 사내 내부 메일로 감지된 스레드/아이덴티티는 `classification = "internal"`로 지정되어 고객 업무 큐에서 제외되고 **"광고·내부"** 탭으로 자동 분류.
3. **AI 딜 추출 제외**: `shouldParse()` 필터에서 `internal_communication`으로 분류하여 불필요한 LLM 호출 및 딜 생성을 차단.
4. **기존 데이터 백필**: 이미 '고객 업무'에 인입된 사내 포워딩 메일을 '광고·내부'로 일괄 재분류하는 스크립트 제공.
5. **UI 수동 재분류 액션**: 관리자가 대화 인스펙터에서 원클릭으로 '광고·내부'로 이동시킬 수 있는 기능 제공.

---

## 2. 세부 설계

### 2.1 사내 메일 판별 규칙 확장 (`src/lib/internal-staff.ts` & `functions-ingest/filter.js`)

#### A. 본문 내 사내 도메인 및 직원 서명 탐색 (`hasInternalSignature`)
- 메일 본문(Body text)을 정규식으로 분석하여 사내 도메인/서명 패턴이 존재하는지 감지:
  1. 사내 도메인 이메일 패턴: `/(?:[a-zA-Z0-9._%+-]+)@(techasset\.co\.kr|medidakoslabs\.com|medidakos\.com)/i`
  2. 사내 담당자 서명 패턴: `/<담당자>\s*[^:\n]+:\s*(?:[a-zA-Z0-9._%+-]+)@(techasset\.co\.kr|medidakoslabs\.com|medidakos\.com)/i`
  3. 사내 직원 발신자명 서명 (예: `송준하 드림`, `이동훈 드림`, `김형선 드림` 등)

> **인용구(Quoted text) 처리**:
> 바이어가 사내 직원에게 받은 메일에 회신(답장)할 때 이전 메일이 본문 하단에 인용될 수 있습니다.
> 따라서 본문 분석 시 **최상단 본문(첫 500자 또는 인용구 구분선 이전)** 과 **서명 블록**을 우선 분석하여 오탐(False Positive)을 방지합니다.

#### B. `isInternalStaffMessage` 함수 정의
```typescript
export function isInternalStaffMessage(message: {
  from?: string;
  fromName?: string;
  bodyText?: string;
  subject?: string;
}): boolean {
  // 1. 발신자 이메일/이름이 사내 계정인 경우
  if (isInternalAddress(message.from) || isInternalAddress(message.fromName)) {
    return true;
  }
  // 2. 본문 서명에 사내 도메인/연락처가 명시된 경우
  if (hasInternalSignature(message.bodyText)) {
    return true;
  }
  return false;
}
```

---

### 2.2 수집기 저장 및 큐 분기 (`functions-ingest/store.js`)

1. **아이덴티티 및 스레드 분류**:
   - `saveMessage()` 실행 시, `isInternalStaffMessage(m)`가 `true`인 경우:
     - `classification`: `"internal"`
     - `side`: `"internal"`
     - `sideSource`: `"account_rule"`
   - `identityData.classification = "internal"`로 저장되어 `conversations` (고객 업무 큐)를 생성하지 않음.
   - 받은편지함의 **"광고·내부" (`queue=advertising`)** 탭의 Review Identity 항목으로 분류됨.

2. **LLM 파싱 필터 (`functions-ingest/filter.js`)**:
   - `shouldParse()`에서 사내 서명/메일 감지 시 `{ parse: false, reason: "internal_communication" }` 반환.

---

### 2.3 UI 관리자 수동 재분류 기능 (`src/app/admin/(dash)/inbox/ConversationInspector.tsx`)

- 대화 인스펙터의 설정(Settings) 탭 또는 상단 액션 바에 **"광고/내부로 이동" (Mark as Internal/Spam)** 액션 추가.
- 클릭 시 `/api/admin/conversations/identities/[id]/classify`를 호출하여 `classification: "internal"`로 변경하고 대화를 고객 업무 큐에서 즉시 제거.

---

### 2.4 기존 데이터 재분류 스크립트 (`scripts/reclassify-internal-threads.mjs`)

- Firestore의 `messages` 및 `threads`, `conversationIdentities`, `conversations`를 스캔하여:
  - 본문에 사내 서명(`@techasset.co.kr`, `@medidakos.com`)이 포함된 외부 발신자 스레드 검색
  - 해당 스레드와 아이덴티티의 `classification`을 `internal`로 갱신
  - `conversations` 문서에서 제거하거나 정리하여 '고객 업무' 큐에서 제거

---

## 3. 검증 계획

### Automated Tests
1. `tests/internal-staff.test.ts`:
   - 개인 메일(`@gmail.com`) 발신이지만 본문에 `<담당자>김형선 매니저 : kimhs@techasset.co.kr` 또는 사내 서명이 포함된 경우 `isInternalStaffMessage`가 `true`를 반환하는지 테스트.
   - 바이어가 사내 직원의 메일을 인용한 답장 메일은 `false`로 유지되는지 회귀 테스트.
2. `tests/filter.test.mjs`:
   - 사내 서명이 포함된 메일에 대해 `shouldParse`가 `parse: false, reason: "internal_communication"`을 반환하는지 테스트.
3. `tests/classify-new-buyer.test.mjs`:
   - `classification: "internal"`로 분류 시 `conversations` 큐에서 정상적으로 제외되는지 테스트.

### Manual Verification
- 브라우저 인박스 화면에서:
  1. `jhulbo0413@gmail.com` 등 사내 포워딩 메일이 '고객 업무' 탭에서 사라지고 '광고·내부' 탭에 올바르게 위치하는지 확인.
  2. AI 딜 인큐베이터가 비활성화되고 불필요한 바이어 딜이 생성되지 않는지 확인.
