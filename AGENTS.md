<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# medidakos_web — 에이전트 작업 지침

Medidakos 웹사이트와 `/admin` 백오피스. 한국 화장품 제조사와 해외 바이어를 잇는 B2B 중개 사업의 운영 도구다.

**현재 주 작업은 백오피스 v1이다.** 아홉 곳(Gmail 6개·Outlook·채널톡·웹 폼)에 흩어진 대화를 한 화면에 모으고, 바이어↔공장 양면 딜을 한 원장에서 굴린다.

## 상위 저장소가 원칙을 갖고 있다

이 저장소는 `Medidakos backoffice/` 안에 있고 **상위 폴더의 `AGENTS.md`·`CLAUDE.md`가 함께 로드된다.** 원가 분리·서버 인가·배포 승인·git 흐름 같은 **원칙은 상위가 정한다.** 이 파일은 그 원칙이 이 앱에서 어떤 모양인지만 적는다. 둘이 어긋나면 상위가 이긴다.

## 명령

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` (반드시 이 폴더에서) |
| 타입 검사 | `npm run typecheck` |
| 린트 | `npm run lint` |
| 테스트 | `npm test` — Firestore 에뮬레이터 + `node --test` |
| 프로덕션 빌드 | `npm run build` |
| Functions 로그 | `npm --prefix functions run logs` |
| 배포된 함수 목록 | `firebase functions:list` |

**완료 판정은 `npm test` · `npm run typecheck` · `npm run lint` 셋이 통과한 상태다.** 셋을 안 돌렸으면 "됐다"고 보고하지 않는다. 화면을 바꿨으면 브라우저 확인이 추가된다.

## 스택 (추측하지 말 것 — 이 버전이 맞다)

- Next.js **16.2.6** App Router · React **19.2.4** · TypeScript strict · Tailwind **v4** (PostCSS 플러그인, `tailwind.config` 파일 없음) · Firebase JS SDK 12 · lucide-react · gsap
- 서버 쪽은 `firebase-admin` · `zod` · `server-only`. 어드민은 **클라이언트 SDK를 쓰지 않는다**
- 테스트는 Node 내장 **`node --test`**다. Node 26이 TypeScript를 그대로 돌린다. jest·vitest를 추가하지 않는다
- `functions/`는 별도 패키지다. **JavaScript CommonJS + Node 20**, firebase-functions v6. TypeScript 아니다
- 수집 함수는 `functions-ingest/` **별도 코드베이스**다. 기존 `functions/`와 배포가 분리돼 있다
- Firebase 프로젝트 `medidakos`, 리전 **`asia-northeast3` 하나뿐**. 새 함수에도 리전을 명시한다. 안 하면 기본값 `us-central1`에 생긴다
- 린터는 ESLint(`eslint-config-next`). **Biome은 도입하지 않기로 정해졌다** — Next 전용 규칙을 버릴 이유가 없다

## 디렉터리 지도

```
src/app/(marketing)/      공개 마케팅 페이지
src/app/(campaign)/       콜드메일 랜딩 (/korea)
src/app/dashboard/        로그인 고객용 — 6단계 브리프, 주문, 배송 추적
src/app/admin/login/      백오피스 로그인 — 게이트 밖
src/app/admin/(dash)/     백오피스 본체. 레이아웃이 세션을 검증한다
src/app/api/admin/        어드민 서버 라우트. 전부 withAdmin 으로만 내보낸다
src/lib/admin-auth.ts     허용목록 판정 (순수 함수)
src/lib/with-admin.ts     route handler 래퍼
src/lib/admin-page.ts     서버 컴포넌트 가드
src/lib/firebase-admin.ts Admin SDK 싱글턴. server-only
src/lib/repo/             Firestore 접근. server-only
src/lib/schemas/          Zod 스키마 — 검증과 타입이 한 곳에서 나온다
src/components/crm/       칸반·모달 프로토타입 (계획 5에서 재사용)
functions/index.js        기존 메일 트리거
functions-ingest/         메일·채널톡 수집기
tests/                    node --test
```

## 백오피스 — 착수 전 반드시 아는 것 다섯

1. **`orders` 이름을 재사용하면 고객에게 메일이 나간다.** 현행 `orders/{autoId}`는 고객이 직접 제출한 주문이고 `onOrderCreated` 트리거가 붙어 있다. 문서가 생기는 즉시 두 통이 발송된다. 내부 원장은 **`deals`**다.
2. **`/admin`은 아직 라이브가 아니다.** `origin/main`·`origin/dev` 어디에도 없고 `medidakos.com/admin`은 404다. 로컬 미커밋 프로토타입이 `src/lib/mock-crm-data.ts` 상수를 읽고 있을 뿐이다. **인가 게이트가 머지되기 전에 `main`에 올리지 않는다.**
3. **`role` 상승 구멍이 열려 있다.** `saveUserProfile()`이 `users/{uid}`를 merge 없이 `setDoc`으로 덮어쓰는데 규칙이 필드를 제한하지 않는다. 지금은 `role`을 읽는 코드가 없어 취약점이 아니고, 그래서 함정이다. 백오피스 첫 커밋에서 막는다.
4. **`lifecycleScan`이 소스에 있고 배포에는 없다.** 의도된 상태다. 전체 배포하면 딸려 올라간다.
5. **`mail` 컬렉션에 쓰면 메일이 나간다.** Trigger Email 확장이 붙어 있고 혼자 `us-central1`이다. 회신 기능을 만들 때 새로 짜지 않는다.

## 보안 경계 (양보하지 않는다)

- **어드민은 Firebase 클라이언트 SDK를 쓰지 않는다.** 읽기는 서버 컴포넌트가 Admin SDK로, 쓰기는 `withAdmin` route handler로 한다
- **`buyers`·`suppliers`·`deals`·`messages`는 모든 클라이언트에게 `allow read, write: if false`다.** 브라우저가 닿는 경로 자체가 없다. 그래서 원가·마진은 딜 문서에 인라인으로 둔다 — 나눌 이유가 없고, 나누면 "이 필드는 어느 문서냐"를 매번 판단해야 하는 지점만 늘어난다
- **관리자 판정은 서버 허용목록(`BACKOFFICE_ADMIN_EMAILS`)이다.** `users/{uid}.role`을 쓰지 않는다 — 사용자가 쓰는 문서를 권한 근거로 삼지 않는다. 커스텀 클레임도 쓰지 않는다(회수가 즉시 반영되지 않는다)
- `BACKOFFICE_ADMIN_EMAILS`가 비면 **500**이다. 빈 목록을 "전원 허용"으로 읽지 않는다
- **기존 Functions 의 `ADMIN_EMAILS`와 다른 것이다.** 그건 알림 수신자 목록이다. 두 목록을 합치지 않는다
- 어드민 라우트는 `withAdmin` 으로만 내보낸다. `tests/with-admin-coverage.test.ts`가 검사한다
- 새 컬렉션은 `firestore.rules`와 에뮬레이터 테스트를 **같은 커밋에** 넣는다
- 비밀값은 Secret Manager(수집기)와 Vercel 환경변수(앱)에 둔다. `.env.local`을 커밋하지 않는다

## 배포 — 사람 승인 없이 하지 않는다

앱은 `main` 푸시하면 **Vercel이 자동 배포**한다. 함수와 규칙은 수동이다.

- `firebase deploy --only functions` (전체) — 소스에 없는 함수를 지우고, 소스에만 있는 `lifecycleScan`을 올린다. **쓰지 않는다.** `--only functions:ingest` 또는 `--only functions:<이름>`으로 좁힌다
- `firebase deploy --only firestore:rules` — **`--dry-run`을 dry-run으로 믿지 않는다.** 2026-08-05에 이 플래그로 규칙이 실제로 운영에 릴리스됐다. 돌린 뒤 콘솔에서 뭐가 나갔는지 대조한다
- `git push --force`, `git reset --hard`, 게시된 이력 수정

## 커밋·브랜치

- 기능 하나에 브랜치 하나 (`feat/…`, `fix/…`) → `dev` → 검증 후 `main`
- **`git add -A`·`git commit -a`를 쓰지 않는다.** `src/components/crm/` 프로토타입이 미추적으로 남아 있고 계획 5가 쓴다. 커밋할 파일을 명시한다
- 커밋 신원은 저장소 로컬로 고정돼 있다 (Kiwook Lee / rheekw@techasset.co.kr). 전역 설정을 건드리지 않는다
- push 전 `gh auth status` 확인. 활성 계정이 `coconutdoyou`면 push 권한이 없다 → `gh auth switch --user rheekw-alt`

## 반복해서 났던 실수

- **소스가 운영 상태를 반영한다고 가정한 것.** 배포 여부는 `firebase functions:list`·`git ls-tree origin/<브랜치>`·`curl`로 확인한다
- **미추적 파일을 백업 없이 덮어쓴 것.** 덮어쓰기 전에 git 추적 여부를 본다. 미추적이면 사본을 먼저 뜬다
- **`next/image`에 `quality` 값을 임의로 넣은 것.** Next 16부터 `next.config.ts`의 `qualities` 배열(현재 60·75)에 없는 값은 400을 낸다
- **작업 트리가 더러운 채로 `git checkout main`** — `git branch -f main origin/main`을 쓴다
- **문서를 CLAUDE.md에 쌓은 것.** 작업 기록·설계 근거는 `docs/`나 커밋 메시지로 간다

## 더 읽을 것 (필요해질 때만)

- `docs/backoffice-spec.md` — 백오피스 구현 스펙 v2. **여기가 기준이다**
- `docs/plans/README.md` — 구현 계획 여섯 개의 지도와 의존 관계
- `docs/firebase-collections-and-mail.md` — 현행 컬렉션별 저장 시점과 메일 트리거
