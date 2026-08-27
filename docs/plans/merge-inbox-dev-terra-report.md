# `feat/inbox` ← `origin/dev` 병합 충돌 정리

## 정리한 충돌

- `package.json`: inbox의 `typecheck`, `eval`, 전체 에뮬레이터 기반 `test`를 유지하고, 랜딩의 `test:rules`를 추가했다. 두 쪽에서 필요한 의존성(`firebase-admin`, `server-only`, `zod`, `gsap`, `firebase-tools`)과 `@firebase/rules-unit-testing` 최신 범위를 함께 반영했다.
- `package-lock.json`: 충돌 마커를 수동으로 섞지 않고 위 의존성 목록에서 `npm install --package-lock-only --ignore-scripts`로 재생성했다.
- `firestore.rules`: inbox의 제한된 `users` 필드 규칙과 백오피스 원장 경로 전면 차단을 보존하고, 랜딩의 `landingRequests` 생성 전용 규칙을 추가했다. 랜딩 요청의 읽기·수정·삭제는 계속 거부된다.

## 확인 결과

- `npm --prefix functions test`: 4개 통과.
- `npm install --package-lock-only --ignore-scripts --dry-run`: 통과. Node 26에서 `superstatic`의 지원 버전 경고만 발생했다.
- `npm run typecheck`: 실패. 현재 실행 중인 개발 서버가 남긴 `.next/dev/types`와 `.next/types`의 라우트 생성물이 서로 달라 `/landing` 레이아웃 타입 오류가 발생한다. 소스 타입 오류는 확인되지 않았고, 개발 서버를 멈춘 뒤 `.next` 생성물을 새로 만들고 다시 확인해야 한다.
- `npm run test:rules`: 6개 중 5개 통과. `catalogItems`가 12개인 정상 요청이 Firestore Rules의 1,000개 식 평가 한도에 걸려 거부된다. 쓰기 검증을 완화하지 않았으므로, 이 문제를 고치려면 상품 목록을 서버에서 신뢰 가능한 요약으로 만들거나 서버 API로 작성하도록 데이터 흐름을 바꾸는 별도 작업이 필요하다.

## 상태

세 충돌 파일은 인덱스에 올려 병합 진행 상태에서 충돌 없음으로 만들었다. 커밋과 푸시는 수행하지 않았다.
