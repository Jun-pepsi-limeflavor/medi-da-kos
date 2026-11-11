# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Medidakos 개발 지침

Medidakos 공개 웹사이트 저장소다. Firebase(Auth·Firestore·Functions), Channel Talk, GA4, Meta Pixel과 연동된다. 누구나 인수받아 운영할 수 있게 만든다. 개인 노트북의 자격 증명에만 의존하는 구현은 완료가 아니다.

## 보안과 데이터

- 기존 Firestore 고객 데이터와 컬렉션은 삭제하거나 임의로 수정하지 않는다.
- 권한은 서버와 Firestore 규칙에서 판정한다. UI 가드는 편의일 뿐이며, 클라이언트가 작성한 역할·권한 필드를 근거로 삼지 않는다.
- 새 컬렉션은 접근 규칙과 에뮬레이터 규칙 테스트를 같은 변경에 포함한다. Firestore 규칙의 기본값은 전부 거부다.
- 비밀값은 Functions는 Secret Manager, 웹은 Vercel 환경변수에 둔다. `.env.local`과 자격 증명은 커밋하지 않는다.
- `functions/.env`는 비밀이 아닌 배포 파라미터라 추적한다. 클론만으로 배포 설정이 재현되어야 하며, 여기에 비밀값을 넣지 않는다.
- `ADMIN_EMAILS`(`functions/.env`)는 관리자 알림 메일 수신자다.

## 계획과 구현

- 스키마, Firestore 규칙, Channel Talk 연동 흐름을 바꿀 때는 데이터 모양과 접근 규칙을 먼저 적고 사용자 승인을 받은 뒤 구현한다. 그 외 변경은 바로 구현한다.
- 요청하지 않은 추상화나 기능은 만들지 않고, 가장 짧고 검증 가능한 diff를 선호한다.
- 문서와 코드 주석은 필요한 내용만 간결하게 쓴다.

## 디버깅과 검증

- 원인은 재현과 라이브 상태 확인으로 찾은 뒤 수정한다. 배포 여부는 소스·문서가 아니라 `firebase functions:list`, 로그, `curl`, `git ls-tree origin/<branch>`로 확인한다.
- 의존성 API는 기억으로 추측하지 않는다. lockfile과 `node_modules/`의 현재 버전·문서를 확인한다.
- Firestore Rules 정규식에서 `\\s`를 공백 클래스로 쓰지 않는다(RE2 문자열에서 문자 `s`로 해석된다).
- 완료를 주장하기 전에 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 중 해당 검사를 실제로 실행하고, 실행하지 못한 검사는 명시한다.
- UI를 바꾸면 먼저 `preview_start`로 개발 서버를 띄워 브라우저에서 확인한다. 실패하면 사용자가 `npm run dev`로 서버를 실행해 연결하도록 요청하고, 그것도 불가능하면 화면 검증을 하지 못했다는 사실을 결과에 밝힌다.

## 실행 환경

| 목적 | 명령 |
|---|---|
| 개발 서버 (dev Firebase) | `npm run dev` |
| 타입 검사 | `npm run typecheck` |
| 린트 | `npm run lint` |
| 테스트 (Firestore Emulator) | `npm test` |
| 프로덕션 빌드 (Vercel과 같음, `.env.local` 기준) | `npm run build` |
| 로컬 빌드·실행 (dev Firebase) | `npm run build:local` → `npm run start:local` (결과물 Firebase를 검사, 운영이면 차단) |
| Functions 테스트 | `npm --prefix functions test` |
| Functions 로그 | `npm --prefix functions run logs -- -P dev` (운영은 `-P prod`) |
| 배포 함수 목록 | `firebase functions:list -P dev` (운영은 `-P prod`) |

- Next.js 16.2.6, React 19.2.4, TypeScript strict, Tailwind v4, Firebase JS SDK 12, Node 22.
- 테스트는 Node 내장 `node --test`다. 규칙 테스트는 Firestore Emulator와 JDK 21+이 필요하다.
- `functions/`는 Node 22 CommonJS 별도 패키지다.
- 로컬 `npm run dev`는 `.env.development.local`의 dev Firebase(`dev-medidakos-b9b4f`)를 쓴다(`.env.local`은 운영 값). `predev`(`scripts/check-dev-firebase.mjs`)가 프로젝트를 출력하고 운영이면 시작을 막는다.
- `.firebaserc`: `default`·`dev` = `dev-medidakos-b9b4f`, `prod` = `medidakos`. 프로젝트를 생략한 Firebase CLI 명령은 dev를 대상으로 하므로, 운영 작업은 항상 `-P prod`(또는 `--project medidakos`)를 명시한다.
- 운영 Firebase 프로젝트는 `medidakos`(dev는 `dev-medidakos-b9b4f`), 함수 리전은 `asia-northeast3`다. 새 함수에도 리전을 명시한다.
- 린터는 ESLint다. Biome, Jest, Vitest를 추가하지 않는다. 승인 없이 npm 패키지를 설치·업데이트하지 않는다.

## 배포와 Git

- 커밋, push, merge, deploy는 사용자가 요청할 때만 한다. 배포 전에는 명시적 승인을 받고, 실행 뒤 실제로 배포된 대상을 확인한다.
- `firebase deploy --only functions` 전체 배포는 사용하지 않는다. 소스에 없는 운영 함수가 삭제된다. `docs/operations/firebase-functions-deployment.md`의 선택 배포 명령으로 명시한 함수만 배포한다.
- Firestore rules의 `--dry-run`도 실제 반영된 사례가 있으므로 승인 없이 실행하지 않는다.
- `git push --force`, `git reset --hard`, 게시된 이력 수정은 명시적 승인 없이는 실행하지 않는다.
- 변경 하나당 `feat/...` 또는 `fix/...` 브랜치 하나를 사용하고 `dev`를 거쳐 검증 후 `main`으로 간다. `main`에 직접 작업하지 않는다.
- 더러운 작업 트리에서는 `git checkout main`을 하지 않는다. 포인터만 갱신해야 하면 `git branch -f main origin/main`을 사용한다.
- `git add -A`와 `git commit -a`를 사용하지 않는다. 커밋 대상 파일을 명시하고, 덮어쓰기 전에는 파일이 추적되는지 확인한다(미추적이면 먼저 사본을 만든다).
- push 전 `gh auth status`를 확인한다. Git 신원은 repo-local 설정을 사용하며 전역 설정을 바꾸지 않는다.
- 새 git worktree에서 배포할 때는 배포에 필요한 `.env` 파일이 있는지 먼저 확인한다.

## 디렉터리 지도

```text
public/images/<페이지>/   페이지별 이미지 (home, about, services, portfolio, categories, common)
public/{icons,logos,og,downloads}/  아이콘·로고(logos/certifications 인증 마크)·OG·다운로드 파일
src/app/(marketing)/      공개 페이지 (Home, About Us, Contact)
src/app/login/            로그인·회원가입
src/app/api/              서버 라우트 (Channel Talk member-hash, KakaoWork callback)
src/components/<영역>/    layout, home, about, services, portfolio, faq, contact, auth, legal, ui,
                          cookie-consent, analytics, seo, channel-talk
src/lib/<영역>/           firebase, channel-talk, analytics, auth, contact, config, utils (+ types.ts)
src/hooks/                공통 React 훅
functions/                Firebase Functions (알림 메일, Channel Talk 연동)
tests/<기능>/             node --test (analytics, channel-talk, kakaowork, rules)
scripts/                  로컬 개발 보조 스크립트 (check-dev-firebase.mjs, local-firebase.mjs)
docs/                     operations(운영·배포), integrations(연동), plans(계획) — docs/README.md
```

새 코드는 위 영역에 맞춰 두고, 모듈 import는 `@/` 별칭을 쓴다.

## Claude 설정

`.claude/settings.json`의 destructive-command hook(`guard-destructive.sh`)과 touched-file typecheck hook(`typecheck-touched.sh`)은 프로젝트 방어선이다. 특별한 이유와 사용자 승인이 없으면 우회하거나 제거하지 않는다.

세션 기록, 설계 근거, handoff는 `docs/` 또는 커밋 메시지에 남긴다. 이 파일에 작업 일지를 쌓지 않는다.
