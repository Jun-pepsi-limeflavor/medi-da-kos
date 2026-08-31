<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Medidakos 개발 작업 지침

이 저장소는 Medidakos 웹사이트와 `/admin` 백오피스를 위한 Git 저장소다. 백오피스는 여러 채널의 바이어 문의를 한 화면에 모으고 바이어↔공장 딜을 관리한다.

누구나 인수받아 운영할 수 있게 만든다. 개인 노트북의 자격 증명에만 의존하는 구현은 완료가 아니다.

## 단일 원본과 경계

이 파일이 프로젝트 공통 지침의 단일 원본이다. Claude Code는 `CLAUDE.md`에서 이 파일을 가져오고, AntiGravity는 `.agents/rules/common.md`를 통해 이 파일을 참조한다. 도구 전용 파일에는 그 도구의 실행 방법만 둔다.

`/Users/giwook/Documents/한국기술자산`은 Obsidian Wiki vault다. 요구사항의 근거를 확인하는 읽기 전용 참조로만 사용한다. 백오피스 세션 산출물, 코드, 비밀값, 임시 스크립트는 이 저장소에 두며, vault 수정은 vault 루트에서 별도 세션으로 수행한다.

Vault를 참조할 때는 `wiki/index.md` → `wiki/hot.md` → 관련 문서 순으로 좁혀 읽는다. 전체 탐색은 피한다.

## 보안과 데이터 경계

- 원가, 마진, 공급가, 환율은 바이어가 읽을 수 있는 클라이언트 번들, 문서 본문, API 응답, payload에 포함하지 않는다. 재무 데이터는 `deals/{id}/private/finance`에 구조적으로 분리한다.
- 권한은 서버에서 판정한다. UI 가드는 편의일 뿐이며, 클라이언트가 역할·권한 필드를 작성하거나 이를 권한 근거로 삼아서는 안 된다.
- 어드민은 Firebase 클라이언트 SDK를 사용하지 않는다. 읽기는 서버 컴포넌트와 Admin SDK로, 쓰기는 `withAdmin` route handler로 처리한다.
- `buyers`, `suppliers`, `deals`, `messages`는 클라이언트에서 직접 읽거나 쓸 수 없다. 새 컬렉션·테이블은 접근 규칙과 에뮬레이터 테스트를 같은 변경에 포함한다.
- 관리자 판정은 서버 허용목록 `BACKOFFICE_ADMIN_EMAILS`로 한다. 비어 있으면 500으로 실패해야 하며, 기존 Functions의 알림 수신자 `ADMIN_EMAILS`와 합치지 않는다.
- 비밀값은 수집기의 Secret Manager 또는 앱의 Vercel 환경변수에 둔다. `.env.local`과 자격 증명은 커밋하지 않는다.
- 반대로 `functions/.env`와 `functions-ingest/.env`는 비밀이 아닌 배포 파라미터이므로 추적한다. 배포 설정이 한 사람의 노트북에만 있으면 안 되고, 클론만으로 재현되어야 한다. 여기에 비밀값을 넣지 않는다.

## 계획과 구현

- 스키마, 권한 규칙, 딜 파이프라인 단계를 바꿀 때는 데이터 모양과 접근 규칙을 먼저 적고 사용자 승인을 받은 뒤 구현한다. 그 외 변경은 바로 구현한다.
- `docs/backoffice-spec.md`와 `docs/plans/`에 이미 결정된 범위를 따른다. 순서를 바꿔야 하면 이유를 한 줄로 밝힌다. v1 범위 밖 기능을 미리 설계하지 않는다.
- `orders`는 고객 주문과 메일 트리거에 사용 중이다. 내부 원장은 반드시 `deals`를 사용한다.
- 요청하지 않은 추상화나 기능은 만들지 않고, 가장 짧고 검증 가능한 diff를 선호한다. 단, 이 원칙은 스키마·인가·파이프라인의 계획 게이트를 우회하지 않는다.

## 디버깅과 검증

- 원인은 재현과 라이브 상태 확인으로 찾은 뒤 수정한다. 소스·문서만으로 배포 상태를 단정하지 않는다.
- 데이터는 실제 레코드를, 서비스는 배포 목록과 로그를, UI는 브라우저에서 확인한다. 화면을 바꾼 경우 브라우저 확인을 추가하고, 불가능했다면 그 사실을 명시한다.
- 의존성 API는 기억으로 추측하지 않는다. lockfile과 `node_modules/`의 현재 버전·문서를 확인한다.
- 완료를 주장하기 전에 해당 변경에 맞는 검증을 실제로 실행한다. 기본 기준은 `npm test`, `npm run typecheck`, `npm run lint`이며, 실행하지 못한 검사는 명시한다.

## 실행 환경

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` |
| 타입 검사 | `npm run typecheck` |
| 린트 | `npm run lint` |
| 테스트 | `npm test` |
| 프로덕션 빌드 | `npm run build` |
| Functions 로그 | `npm --prefix functions run logs` |
| 배포 함수 목록 | `firebase functions:list` |

- Next.js 16.2.6, React 19.2.4, TypeScript strict, Tailwind v4, Firebase JS SDK 12를 사용한다.
- 테스트는 Node 내장 `node --test`다. 규칙 테스트는 Firestore Emulator와 JDK 21+이 필요하다.
- `functions/`는 Node 20 CommonJS의 별도 패키지고, `functions-ingest/`는 별도 배포 코드베이스다.
- Firebase 프로젝트는 `medidakos`, 함수 리전은 `asia-northeast3`다. 새 함수에도 리전을 명시한다.
- 린터는 ESLint다. Biome, Jest, Vitest를 추가하지 않는다.

## 배포와 Git

- 커밋, push, deploy는 사용자가 요청할 때만 한다. 배포 전에는 명시적 승인을 받고, 실행 뒤 실제로 배포된 대상도 확인한다.
- `firebase deploy --only functions` 전체 배포는 사용하지 않는다. 명시한 함수만 좁혀 배포한다. Firestore rules의 `--dry-run`도 실제 변경 가능성이 있으므로 승인 없는 실행을 금지한다.
- `git push --force`, `git reset --hard`, 게시된 이력 수정은 명시적 승인 없이는 실행하지 않는다.
- 변경 하나당 `feat/...` 또는 `fix/...` 브랜치 하나를 사용하고 `dev`를 거쳐 검증 후 `main`으로 간다. `main`에 직접 작업하지 않는다.
- 더러운 작업 트리에서는 `git checkout main`을 하지 않는다. 포인터만 갱신해야 하면 `git branch -f main origin/main`을 사용한다.
- `git add -A`와 `git commit -a`를 사용하지 않는다. 커밋 대상 파일을 명시하고, 덮어쓰기 전에는 파일이 추적되는지 확인한다.
- push 전 `gh auth status`를 확인한다. Git 신원은 repo-local 설정을 사용하며 전역 설정을 바꾸지 않는다.

## 디렉터리 지도

```text
src/app/(marketing)/      공개 마케팅 페이지
src/app/(campaign)/       콜드메일 랜딩 (/korea)
src/app/dashboard/        로그인 고객용 화면
src/app/admin/login/      백오피스 로그인
src/app/admin/            백오피스 UI
src/app/api/admin/        어드민 서버 라우트
src/lib/admin-auth.ts     관리자 허용목록 판정
src/lib/with-admin.ts     route handler 래퍼
src/lib/firebase-admin.ts Admin SDK 싱글턴
src/lib/repo/             Firestore 접근
src/lib/schemas/          Zod 스키마
functions/                기존 Firebase Functions
functions-ingest/         메일·채널톡 수집기
tests/                    node --test
docs/                     스펙·계획·운영 문서
```

## 기록

세션 기록, 설계 근거, handoff는 `docs/` 또는 커밋 메시지에 남긴다. 이 파일과 도구 전용 규칙 파일에 작업 일지를 쌓지 않는다.

반복 실수는 `MISTAKES.md`에 최신순으로 원인과 재발 방지 규칙을 기록한다. 같은 실패가 세 번 발생하면 여기의 상시 규칙으로 올리고 `MISTAKES.md`에서는 제거한다.

필요할 때만 `docs/backoffice-spec.md`, `docs/plans/README.md`, `docs/firebase-collections-and-mail.md`를 먼저 읽는다.
