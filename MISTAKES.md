# MISTAKES

반복 실수는 최신순으로 기록한다. 같은 실패가 세 번 발생하면 `AGENTS.md`의 상시 규칙으로 올리고 여기에서는 제거한다.

## 2026-08-28 — stripUndefined가 serverTimestamp(FieldValue 센티널)를 빈 객체로 변환함

**무슨 일이 있었나:** Firestore 쓰기 직전 `stripUndefined({ ...request, serverCreatedAt: serverTimestamp() })`를 호출하여, Firestore SDK의 `FieldValueImpl` 센티널이 `{}`(빈 일반 객체)로 변환되어 보안 규칙 평가(`serverCreatedAt is timestamp`) 실패(`Missing or insufficient permissions`)를 유발했다.

**근인:** `stripUndefined`가 `undefined`만 제거하고 다른 객체는 안전하게 둘 것이라고 추측했다.

**진짜 원인:** `stripUndefined`가 프로토타입이 있는 특수 객체(`FieldValue`, `Date`, `Timestamp` 등)를 검사하지 않고 순수 객체처럼 `Object.entries`로 순회해 분해했다.

**규칙:** Firestore 직렬화 유틸은 `Object.getPrototypeOf(v) !== Object.prototype`인 인스턴스를 보존해야 하며, `serverTimestamp()`와 같은 SDK 센티널은 데이터 정제(`stripUndefined`)가 끝난 뒤 최종 단계에서 부착한다.

## 2026-08-28 — Firestore Security Rules의 정규식 이스케이프 오류로 유효한 이메일 거부

**무슨 일이 있었나:** `firestore.rules`에서 `^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$` 정규식을 사용하여, 도메인이나 로컬 파트에 문자 `'s'`가 포함된 유효한 이메일(`test2@sds/...` 등) 제출 시 `Missing or insufficient permissions`가 발생했다.

**근인:** 일반 JS 정규식의 `\s`(공백 문자 클래스) 동작이 Firestore Rules 문자열에서도 동일하게 동작할 것으로 가정했다.

**진짜 원인:** Firestore Rules RE2 정규식 문자열 리터럴 내에서 `\\s`가 공백 클래스가 아니라 문자 `'\\'`와 `'s'`의 집합으로 해석되어 문자 `'s'`가 금지 문자로 처리되었다.

**규칙:** Firestore Security Rules에서는 `\\s` 문자 클래스 축약형을 신뢰하지 않고 표준 패턴(`.*@.*\\..*` 또는 `[^ @]+@[^ @]+\\.[^ @]+`)을 사용한다.

## 2026-08-28 — 비인터랙티브 배포 환경에서 환경변수 누락으로 배포 실패

**무슨 일이 있었나:** Functions 배포(`firebase deploy --only functions:...`) 시 워크트리의 `functions/.env` 파일이 없어 `ADMIN_EMAILS` 누락 에러로 빌드가 중단되었다.

**근인:** 메인 작업 디렉터리와 동일하게 Functions 배포가 즉시 성공할 것으로 가정했다.

**진짜 원인:** 메인 레포의 `functions/.env`가 `.gitignore` 대상이라 새 워크트리에 자동 복사되지 않았다.

**규칙:** 새 git worktree 생성 시 배포에 필요한 `.env` 파일들을 메인 작업 공간에서 안전하게 복사하고 점검한다.

## 2026-08-26 — 커밋 안 된 파일을 백업 없이 덮어씀

**무슨 일이 있었나:** 미추적 파일을 수정 전에 백업하지 않고 덮어썼다. Git은 추적 파일만 되돌릴 근거가 있다.

**근인:** 파일을 읽은 것을 안전하게 다뤘다는 판단으로 혼동했다.

**진짜 원인:** 덮어쓰기 전에 `git status`로 추적 여부를 확인하지 않았다. 추적 파일이면 `git diff`로 되돌릴 수 있지만, 미추적 파일은 덮어쓰는 순간 복구 근거가 없다.

**규칙:** 파일을 덮어쓰기 전에 Git 추적 여부를 확인한다. 미추적이면 먼저 커밋하거나 사본을 만든다.

## 2026-08-26 — 라이브 상태를 확인하지 않고 단정함

**무슨 일이 있었나:** 로컬 문서의 `/admin` 설명을 배포 상태로 확대 해석했다.

**근인:** 문서는 로컬 코드의 상태일 수 있는데도 라이브 상태 증거로 취급했다.

**규칙:** 배포 여부는 소스나 문서가 아니라 `curl`, `firebase functions:list`, 배포 로그, `git ls-tree origin/<branch>`로 확인한다.

## 2026-08-26 — 기존 스펙 문서를 못 찾고 처음부터 설계함

**무슨 일이 있었나:** 기존 스펙을 찾지 않고 새 설계를 시작했다.

**근인:** `src/`, `functions/`, 설정 파일만 살피고 `docs/`를 먼저 확인하지 않았다.

**규칙:** 설계를 시작하기 전에 관련 `docs/`와 Markdown 문서를 먼저 훑는다.
