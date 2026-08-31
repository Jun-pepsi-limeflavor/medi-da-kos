# 고객 중심 통합 받은편지함 v2

## Summary

provider 스레드를 직접 합치지 않고, Gmail·Outlook·Channel Talk 원문 스레드 위에 고객 단위 `conversation` 계층을 추가한다.

완료 기준은 다음과 같다.

- 같은 이메일과 같은 바이어에 등록된 복수 이메일은 계정·채널·제목이 달라도 하나의 타임라인으로 표시된다.
- 모든 인바운드는 `conversation 연결` 또는 `검토함 분류` 중 정확히 하나에 속한다.
- 원문 스레드별 미답장 상태를 유지해 다른 문의에 답했다고 미처리 문의가 사라지지 않는다.
- 확정 브리프만 제조사 공유에 사용하며 원문·내부 메모·재무정보는 전송하지 않는다.
- 수집 장애가 있으면 받은편지함에서 즉시 드러난다.

## 데이터·서버 인터페이스

- 기존 `messages`와 `threads`는 provider 원본 및 회신 연결의 기준으로 보존한다.
- `threads`에 다음을 추가한다.
  - `identityId`, `classification`, `conversationId?`
  - `lastInboundAt`, `lastOutboundAt`, `handledThroughAt?`
  - 미답장 판정: 마지막 인바운드가 마지막 아웃바운드와 수동 처리 시각보다 최신인 경우
- `conversationIdentities/{identityId}`를 추가한다.
  - 이메일은 `trim + lowercase`만 정규화한다.
  - Channel Talk는 이메일이 없으면 account와 user ID로 임시 identity를 만든다.
  - identity는 `unclassified | buyer | supplier | internal | advertising`과 대상 conversation을 저장한다.
- `conversations/{id}`를 추가한다.
  - `buyerId?`, `supplierId?`, identity 목록과 병합 alias
  - `ownerEmail?`, `collaboratorEmails[]`
  - `workflowState: active | waiting_customer | done`
  - `nextAction`, `dueAt`, `defaultOutboundAccount?`
  - 마지막 활동, 미답장 수, 최장 대기 시각 등 목록용 rollup
- `conversations/{id}/brief/current`에는 확정된 제품 요구사항, 인증, 수량·용량, 일정·배송, 결정사항, 미해결 질문과 필드별 `sourceRefs`를 저장한다. 제품에는 안정적인 `briefItemId`를 부여한다.
- 브리프 영향 판정은 `changed | no_change | uncertain`이다.
  - 기존 바이어의 새 인바운드는 자동 판정한다.
  - 신규·미연결 고객은 실무자가 분석을 요청한다.
  - `changed`만 diff를 만들고, `uncertain`은 검토 필요로 노출한다.
  - 사람의 선택 확정 전에는 브리프나 딜을 변경하지 않는다.
- 관리자 API를 추가한다.
  - identity 분류 및 기존 conversation 연결
  - conversation 담당자·협업자·후속 상태·기한 수정
  - conversation 병합과 감사 사유 기록
  - 원문 thread 수동 처리 완료
  - 브리프 분석, 항목별 승인·거절
  - 제조사 공유 미리보기와 최종 전송
- 모든 입력은 Zod로 허용 필드만 검증하고 `withAdmin`을 사용한다. 새 컬렉션과 하위 컬렉션은 Firestore 클라이언트 접근을 명시적으로 차단한다.
- 기존 `threads.buyerId`, `supplierId`, `dealId`는 호환 기간 동안 유지하고 새 연결과 불일치하면 서버에서 실패시킨다.

## 받은편지함 UX

- 상위 화면을 `고객 업무 / 검토함 / 제조사 / 광고·내부`로 구성한다. 수신·발신·답장 필요는 고객 큐의 상태와 필터로 이동한다.
- 고객 업무는 3열 구조다.
  - 왼쪽: 고객 큐. `기한 초과 → 미답장 최장 대기 → 미배정 → 최근 활동` 순으로 정렬한다.
  - 가운데: 모든 채널의 시간순 타임라인. 메시지마다 계정·provider·제목·원문 스레드 경계를 표시한다.
  - 오른쪽: 담당자, 협업자, 다음 행동, 기한, 확정 브리프, AI 변경 제안, 연결된 딜과 제조사 공유 액션을 표시한다.
- 답장은 선택한 원문 provider 스레드에서만 전송해 Gmail/Outlook의 실제 threading을 보존한다.
- 검토함은 미분류 메시지를 이메일 또는 Channel Talk identity별로 묶는다. 기존 바이어 검색과 분류 목적지로 드래그하거나 동일한 버튼·키보드 동작으로 처리한다.
- 고객 분류 시 주담당자 미지정을 허용하되 `미배정` 큐에 고정 표시한다. 메일 계정으로 담당자를 추론하지 않는다.
- 등록되지 않은 바이어·제조사 원장은 자동 생성하지 않는다.
- 현재 dark neutral/indigo와 Geist를 유지하고, provider가 한 고객에게 합류하는 “대화 레일”을 핵심 시각 요소로 사용한다. 좁은 화면은 고객 목록 → 타임라인 → 브리프의 단계형 화면으로 전환한다.
- 메인 목록은 conversation rollup만 읽으며 thread별 메시지 N+1 조회를 제거한다.

## 브리프 공유·발송

- 제조사 공유본은 확정된 브리프 항목만 선택해 생성한다.
- 수신자는 연결된 supplier의 등록 연락처만 허용한다. 새 주소는 supplier 원장을 먼저 수정해야 한다.
- 담당자와 발신 계정은 독립적으로 관리한다. conversation별 기본 발신 계정을 선택·기억하며 비활성 또는 오류 계정은 사용할 수 없다.
- 제목·수신자·발신 계정·본문을 미리본 뒤 실무자가 명시적으로 전송한다.
- 서버는 발신 capability, supplier 연결, 허용된 브리프 필드와 idempotency key를 다시 검증한다.
- 성공 시 provider message/thread ID, 브리프 revision, actor, 수신자, 시각을 감사 기록에 남기고 제조사 conversation 및 deal에 연결한다.
- Gmail부터 활성화하고 Outlook·Channel Talk 발송은 실제 send canary를 통과한 계정만 같은 인터페이스에 노출한다. provider 응답이 불명확하면 자동 재전송하지 않는다.

## 마이그레이션·검증·출시

1. 새 스키마, 저장소, 규칙 테스트와 dual-write 수집 경로를 구현하되 기존 UI는 유지한다.
2. 기존 저장 기록 전체에 쓰기 없는 dry-run을 실행해 바이어·제조사 자동 연결, 내부, 모호함, 미분류 수를 보고한다.
3. 별도 승인 후 멱등 backfill을 실행한다. 원문 메시지는 수정하지 않고 thread 연결과 conversation rollup만 채운다.
4. 모든 thread가 conversation 또는 검토함에 포함되고 누락·중복이 0인지 대조한다.
5. Thomas/Hally 데이터로 새 UI를 단계 출시한다. support와 Channel Talk은 실제 fixture, Secret binding, read-only count 및 재수집 중복 검증 후 순차 활성화한다.
6. 활성 provider가 15분 이상 성공 기록이 없거나 `lastError`가 있으면 받은편지함 상단에 지속 경고와 진단 링크를 표시한다.

필수 테스트:

- 같은 이메일의 새 제목, 다른 Gmail 계정 및 support 수신이 하나의 conversation으로 묶인다.
- 한 바이어의 복수 이메일이 하나의 타임라인으로 병합된다.
- 같은 이름의 다른 이메일, 다중 외부 수신자와 직원 포워딩은 자동 오결합되지 않는다.
- 이메일 없는 Channel Talk 임시 고객이 이후 기존 바이어에 안전하게 병합된다.
- 원문 스레드별 미답장, 수동 완료, 이후 새 인바운드 재개가 정확하다.
- drag, 버튼, 키보드 분류가 동일한 서버 결과와 감사 기록을 만든다.
- 브리프 영향도 3상태, 선택 확정, sourceRef와 AI 실패 경로가 검증된다.
- 제조사 발송의 권한, 허용 수신자, 중복 전송 방지, provider 불명확 응답과 재무정보 차단을 검증한다.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, Firestore Emulator 규칙 테스트를 실행한다.
- 인증된 Aside 세션으로 3열 고객 업무, 검토함 분류, 모바일 단계형 화면과 실제 레코드를 확인한다.

가정 및 승인 경계:

- 모든 메일 계정은 공용이며 담당자와 일치하지 않는다.
- 미배정 고객을 허용하지만 고객 큐 최상단에서 숨길 수 없게 한다.
- 알 수 없는 외부 발신자는 검토함 우선이며 AI로 광고를 자동 확정하지 않는다.
- 배포, Firestore backfill, Secret 변경과 외부 canary 발송은 각각 별도 승인을 받아야 한다.
- 요청한 `ui-ux-pro` 스킬은 현재 제공되지 않아, 사용 가능한 `frontend-design` 원칙과 접근성 기준으로 대체한다.
