# 어드민 인가 게이트 구현 계획

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin`을 서버에서 검증되는 이메일 허용목록 뒤에 두고, 백오피스 컬렉션을 모든 클라이언트로부터 차단한다.

**Architecture:** 어드민은 Firebase 클라이언트 SDK를 쓰지 않는다. 브라우저는 구글로 로그인해 ID 토큰만 서버에 넘기고, 서버가 `firebase-admin`으로 검증한 뒤 httpOnly 세션 쿠키를 발급한다. 이후 모든 어드민 데이터 요청은 route handler를 지나며 `withAdmin` 래퍼가 쿠키를 재검증한다. 미들웨어는 쿠키 유무만 보고 리디렉트할 뿐 판단하지 않는다(Edge 런타임이라 `firebase-admin`을 못 쓴다).

**Tech Stack:** Next.js 16.2.6 (App Router) / React 19.2.4 / TypeScript 5 / `firebase-admin` / `@firebase/rules-unit-testing` / `node --test` (Node 26 내장 — 테스트 프레임워크 추가 없음) / Firestore 에뮬레이터

**Spec:** `docs/backoffice-spec.md` — 2.4, 5장, 9장 작업 1~3

---

## Global Constraints

- 어드민은 Firebase **클라이언트 SDK를 쓰지 않는다.** 모든 읽기·쓰기가 route handler + `firebase-admin`을 지난다 (스펙 5장)
- 원가·마진 필드는 `src/app/admin/**`·`src/app/api/admin/**`·`functions-ingest/**` 밖에 나타나면 안 된다 (스펙 8장)
- **새 컬렉션은 접근 규칙과 에뮬레이터 테스트가 같은 커밋에 들어간다** (스펙 5.3)
- `BACKOFFICE_ADMIN_EMAILS`가 비어 있으면 **500을 던진다.** 빈 목록을 "전원 허용"으로 읽지 않는다 (스펙 5.2)
- 세션 쿠키는 `httpOnly` + `secure` + `sameSite=strict`, 만료 5일 (스펙 5.2)
- 허용 제공자는 `google.com`, `microsoft.com` 둘뿐이고 `email_verified === true`가 필수 (스펙 5.1)
- 기존 컬렉션(`orders`·`cmBriefs`·`sampleRequests`·`contact`·`koreaLeads`·`mail`)의 규칙은 **건드리지 않는다.** 예외는 `users` 하나 (스펙 2.2)
- 린터는 ESLint 유지. Biome 도입하지 않는다 (스펙 8장)
- **Task 6이 머지되기 전에는 `src/app/admin/**`를 `main`에 올리지 않는다** (스펙 2.5)

---

## 착수 전 — 코드 밖의 일

이 계획은 아래 승인을 기다리지 않는다. 다만 스펙 9장 작업 5(수집기)가 여기 막히므로 **첫날 요청을 넣어둔다.**

- [ ] `medidakoslabs.com` Workspace 관리콘솔 → 보안 → API 제어 → 도메인 전체 위임 (`thomas@`, `hally@`, 스코프 `gmail.readonly`)
- [ ] `techasset.co.kr` Workspace 관리콘솔 → 같은 서비스 계정 클라이언트 ID로 동일 등록 (`rheekw`, `songjh`, `kimhs`, `parkjy`)
- [ ] Azure 앱 등록 → `Mail.Read` 앱 전용 권한 + 관리자 동의 + **`ApplicationAccessPolicy`로 `support@medidakos.com`만 접근되게 범위 제한**

## 작업 트리 상태

시작 시점에 `dev`에 미커밋 변경 11건(`src/app/admin/`, `src/components/crm/` 등)이 있다. **이 계획은 그것들을 건드리지 않는다.**

stash하지 않는다. 이 계획의 모든 커밋이 `git add <파일 경로>`로 대상을 명시하므로 프로토타입 파일은 작업 트리에 그대로 남고 PR에 들어가지 않는다. 브랜치를 갈아도 미추적 파일은 따라온다.

```bash
cd medi-da-kos
git switch -c feat/admin-auth-gate origin/dev
git status --porcelain    # 프로토타입 11건이 그대로 보이면 정상
```

**`git add -A`나 `git commit -a`를 쓰지 않는다.** 한 번이라도 쓰면 남의 미완성 작업이 PR에 딸려 들어간다. 계획 5(딜 보드)가 `src/components/crm/`의 칸반 컴포넌트를 재사용하므로 이 파일들은 살아 있어야 한다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `firestore.rules` (수정) | `users` 필드 잠금 + 백오피스 컬렉션 4종 차단 |
| `firebase.json` (수정) | Firestore 에뮬레이터 포트 |
| `tests/rules/users.test.mjs` (신규) | `users` 규칙 회귀 |
| `tests/rules/backoffice.test.mjs` (신규) | 백오피스 컬렉션 차단 회귀 |
| `tests/rules/helpers.mjs` (신규) | 에뮬레이터 테스트 환경 부트스트랩 |
| `src/lib/firebase-admin.ts` (신규) | Admin SDK 싱글턴. 서버 전용 |
| `src/lib/admin-auth.ts` (신규) | 허용목록 판정(순수 함수) + 세션 쿠키 검증 |
| `tests/admin-auth.test.ts` (신규) | 허용목록 판정 단위 테스트 |
| `src/app/api/admin/session/route.ts` (신규) | 세션 쿠키 발급·삭제 |
| `src/lib/with-admin.ts` (신규) | route handler 래퍼 |
| `tests/with-admin-coverage.test.ts` (신규) | 래퍼 누락 검사 |
| `src/middleware.ts` (신규) | `/admin/*` 쿠키 유무 리디렉트 |
| `src/app/admin/login/page.tsx` (신규) | 구글 로그인 → 세션 발급 |

---

### Task 1: 테스트 하네스와 에뮬레이터

**Files:**
- Modify: `firebase.json`
- Modify: `package.json`
- Create: `tests/rules/helpers.mjs`
- Test: `tests/rules/smoke.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: `getTestEnv(): Promise<RulesTestEnvironment>` — 이후 모든 규칙 테스트가 쓴다. `RulesTestEnvironment`는 `@firebase/rules-unit-testing`의 타입

- [ ] **Step 1: 의존성 설치**

```bash
npm i -D --save-exact @firebase/rules-unit-testing@5.0.0
```

버전을 고정하는 이유: 이 패키지는 메이저 사이에 API가 바뀐다. 설치 후 `node_modules/@firebase/rules-unit-testing/package.json`의 `version`을 확인해 5.x인지 본다. 다르면 아래 코드의 import가 맞는지 먼저 확인한다.

- [ ] **Step 2: `firebase.json`에 에뮬레이터 블록 추가**

기존 `firestore`·`database`·`functions` 키는 그대로 두고 최상위에 추가한다.

```json
  "emulators": {
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
```

- [ ] **Step 3: `package.json`에 스크립트 추가**

```json
    "typecheck": "tsc --noEmit",
    "test": "firebase emulators:exec --only firestore --project demo-medidakos \"node --test tests/\""
```

`demo-` 접두어가 붙은 프로젝트 ID는 에뮬레이터가 실제 자격증명 없이 받아준다.

- [ ] **Step 3b: `tsconfig.json`에 `allowImportingTsExtensions` 추가**

`compilerOptions`의 `"noEmit": true` 바로 아래에 넣는다.

```json
    "allowImportingTsExtensions": true,
```

**이게 없으면 Task 4의 테스트가 타입체크에서 깨진다.** 실측으로 확인된 사실이다:

```
node --test  ../src/lib/admin-auth     → ERR_MODULE_NOT_FOUND (ESM 은 확장자를 요구한다)
node --test  ../src/lib/admin-auth.ts  → 통과
tsc          ../src/lib/admin-auth.ts  → TS5097 (이 옵션이 없으면)
```

즉 Node는 `.ts` 확장자를 **요구**하고 tsc는 이 옵션 없이는 **거부**한다. 둘을 동시에 만족시키는 유일한 설정이다. `noEmit: true`가 이미 켜져 있어 전제 조건도 충족한다.

Next.js가 빌드 중 `tsconfig.json`을 재작성할 수 있으므로, 첫 `npm run build` 뒤에 이 줄이 남아 있는지 확인한다. 사라졌다면 tests 전용 `tsconfig.test.json`으로 분리하고 `typecheck` 스크립트를 `tsc -p tsconfig.test.json --noEmit && tsc --noEmit`로 바꾼다.

- [ ] **Step 4: 테스트 환경 헬퍼 작성**

`tests/rules/helpers.mjs`:

```javascript
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

let envPromise;

export function getTestEnv() {
  if (!envPromise) {
    envPromise = initializeTestEnvironment({
      projectId: "demo-medidakos",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  }
  return envPromise;
}
```

- [ ] **Step 5: 하네스가 실제로 도는지 확인하는 테스트**

`tests/rules/smoke.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

test("규칙 파일이 로드되고 catch-all이 막는다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("someuid").firestore();
  await assertFails(getDoc(doc(db, "nonexistent", "x")));
  assert.ok(true);
});
```

- [ ] **Step 6: 실행해서 통과 확인**

Run: `npm test`
Expected: PASS 1건. 에뮬레이터가 뜨고 규칙이 로드된다.

실패하면 원인을 먼저 가른다 — 에뮬레이터가 안 뜨면 Java 문제(`java -version`), 규칙 로드 실패면 `firestore.rules` 문법 문제다.

- [ ] **Step 7: 훅을 이 저장소로 가져온다**

**훅이 상위 저장소에만 있다.** `medi-da-kos`에서 세션을 열면 `$CLAUDE_PROJECT_DIR`가 여기가 되고 상위의 `.claude/settings.json`을 읽지 않는다 — 지금은 아무것도 안 지킨다.

```bash
mkdir -p .claude/hooks
cp "../.claude/hooks/guard-destructive.sh" .claude/hooks/
cp "../.claude/hooks/typecheck-touched.sh" .claude/hooks/
chmod +x .claude/hooks/*.sh
```

`no-cost-leak.sh`는 복사하지 않고 **새로 쓴다.** 상위 것은 경로에 `buyer`·`public`이 들어가면 검사하는 블랙리스트인데, 이 저장소의 실제 구조에서는 반대가 안전하다 (스펙 8장).

`.claude/hooks/no-cost-leak.sh`:

```bash
#!/usr/bin/env bash
# PostToolUse(Edit|Write) — 원가가 어드민 밖으로 나가는 것을 막는다.
# 화이트리스트다. 블랙리스트는 새 디렉터리가 생길 때마다 구멍이 뚫린다.
set -uo pipefail
f=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) || exit 0
[ -z "$f" ] || [ ! -f "$f" ] && exit 0
case "$f" in *.ts|*.tsx|*.js|*.jsx|*.mjs) ;; *) exit 0 ;; esac

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
rel=${f#"$root"/}

# 원가를 다뤄도 되는 곳. 일반 딜 스키마·저장소는 허용하지 않는다.
case "$rel" in
  src/lib/schemas/deal-finance.ts|src/lib/repo/deal-finance.ts|src/app/admin/*|src/app/api/admin/*|functions-ingest/*|tests/*) exit 0 ;;
esac

SECRETS='unitCost|supplierCost|factoryPrice|internalCosts|supplierQuotes|grossProfit|margin|markup|fxSnapshot'
hits=$(grep -nE "$SECRETS" "$f" 2>/dev/null | head -10)
[ -z "$hits" ] && exit 0

{
  echo "COST LEAK RISK — $rel 는 어드민 경로 밖인데 원가·제조사 필드를 참조한다:"
  echo "$hits"
  echo
  echo "허용 경로: deal-finance 스키마·저장소 · src/app/admin/** · src/app/api/admin/** · functions-ingest/** · tests/**"
  echo "여기서 다뤄야 한다면 이 훅의 화이트리스트를 넓히되, 넓힌 이유를 커밋 메시지에 남긴다."
} >&2
exit 2
```

`.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-destructive.sh\"", "timeout": 10 }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR/.claude/hooks/no-cost-leak.sh\"", "timeout": 15 },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR/.claude/hooks/typecheck-touched.sh\"", "timeout": 120 }
        ]
      }
    ]
  }
}
```

- [ ] **Step 8: 훅이 실제로 잡는지 확인한다**

```bash
mkdir -p /tmp/hk && cat > src/lib/_probe.ts <<'EOF'
export const q = (d: { unitCost: number }) => d.unitCost;
EOF
printf '{"tool_input":{"file_path":"%s/src/lib/_probe.ts"}}' "$PWD" | .claude/hooks/no-cost-leak.sh; echo "exit=$?"
```

Expected: `exit=2`, "COST LEAK RISK — src/lib/_probe.ts …"

허용 경로도 확인한다.

```bash
mkdir -p src/app/admin/_probe && cp src/lib/_probe.ts src/app/admin/_probe/x.ts
printf '{"tool_input":{"file_path":"%s/src/app/admin/_probe/x.ts"}}' "$PWD" | .claude/hooks/no-cost-leak.sh; echo "exit=$?"
```

Expected: `exit=0`

확인했으면 지운다: `rm -rf src/lib/_probe.ts src/app/admin/_probe`

**이 단계를 건너뛰면 아무것도 검사하지 않는 훅을 커밋하게 된다.**

- [ ] **Step 9: 커밋**

```bash
git add firebase.json tsconfig.json package.json package-lock.json tests/ .claude/
git commit -m "test: Firestore 규칙 에뮬레이터 하네스와 저장소 훅

훅이 상위 저장소에만 있어서 여기서 세션을 열면 아무것도 지키지 못했다.
원가 검사는 화이트리스트로 뒤집었다 — 블랙리스트는 새 디렉터리마다 구멍이 뚫린다."
```

---

### Task 2: `users` 규칙 잠금

**Files:**
- Modify: `firestore.rules:14-17` (현재 `match /users/{uid} { allow read, write: if isOwner(uid); }`)
- Test: `tests/rules/users.test.mjs`

**Interfaces:**
- Consumes: `getTestEnv()` (Task 1)
- Produces: 없음 — 규칙 변경만

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/rules/users.test.mjs`:

```javascript
import { test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const UID = "buyer-1";
const safeProfile = {
  uid: UID, email: "b@example.com", displayName: "B",
  companyName: "", phone: "", country: "", provider: "google",
  createdAt: "2026-01-01T00:00:00.000Z", isTest: false,
};
const existing = { ...safeProfile, role: "user" };

async function seed(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", UID), existing);
  });
}

test("본인 문서를 읽을 수 있다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertSucceeds(getDoc(doc(db, "users", UID)));
});

test("가입 시 권한 필드 없이 안전 프로필을 생성할 수 있다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("new-uid").firestore();
  await assertSucceeds(
    setDoc(doc(db, "users", "new-uid"), { ...safeProfile, uid: "new-uid" }),
  );
});

test("안전 필드만 merge 수정할 수 있다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertSucceeds(
    setDoc(doc(db, "users", UID), { phone: "010-0000-0000" }, { merge: true }),
  );
});

test("role 을 admin 으로 바꿀 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertFails(
    setDoc(doc(db, "users", UID), { role: "admin" }, { merge: true }),
  );
});

test("가입 시 role: user 도 클라이언트가 쓰지 못한다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("evil-uid").firestore();
  await assertFails(
    setDoc(doc(db, "users", "evil-uid"), { ...safeProfile, uid: "evil-uid", role: "user" }),
  );
});

test("permissions 필드를 추가할 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertFails(
    setDoc(doc(db, "users", UID), { permissions: ["admin"] }, { merge: true }),
  );
});

test("문서를 삭제할 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext(UID).firestore();
  await assertFails(deleteDoc(doc(db, "users", UID)));
});

test("남의 문서는 읽을 수 없다", async () => {
  const env = await getTestEnv();
  await seed(env);
  const db = env.authenticatedContext("other").firestore();
  await assertFails(getDoc(doc(db, "users", UID)));
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npm test`
Expected: role 변경·role 포함 생성·permissions 추가·삭제 테스트가 FAIL. 현재 규칙은 소유자의 모든 쓰기를 허용하므로 이 네 동작이 성공해 테스트가 실패해야 한다.

현재 규칙이 `allow read, write: if isOwner(uid)`라 셋 다 통과해버리는 것이 정상적인 실패다.

- [ ] **Step 3: 규칙 수정**

`firestore.rules`의 `users` 블록을 통째로 교체한다.

```
    // users/{uid}: 본인만. 권한 필드는 클라이언트 요청에 들어오지 않는다.
    match /users/{uid} {
      allow read:   if isOwner(uid);
      allow create: if isOwner(uid)
        && request.resource.data.keys().hasOnly([
          'uid', 'email', 'displayName', 'phone', 'country', 'companyName',
          'provider', 'createdAt', 'isTest'
        ]);
      allow update: if isOwner(uid)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'displayName', 'phone', 'country', 'companyName', 'provider', 'isTest'
        ]);
      allow delete: if false;
    }
```

- [ ] **Step 4: 실행해서 전부 통과 확인**

Run: `npm test`
Expected: 전부 PASS (권한 필드가 요청에 들어오지 않는 경계 포함)

- [ ] **Step 5: 프로필 저장에서 권한 필드를 제거한다**

`src/lib/firestore-service.ts`의 `saveUserProfile()`을 안전 필드 merge로 바꾼다. `role`·`permissions`를 인자로 받거나 Firestore 요청에 넣지 않는다.

```typescript
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (useMockAuth()) return;
  const { uid, email, displayName, phone, country, companyName, provider, createdAt } = profile;
  const ref = doc(getFirebaseDb(), "users", uid);
  const existing = await getDoc(ref);
  const mutable = {
    displayName, phone, country, companyName, provider,
    isTest: isNonProductionEnv(),
  };
  await setDoc(
    ref,
    stripUndefined(existing.exists()
      ? mutable
      : { uid, email, createdAt, ...mutable }),
    { merge: true },
  );
}
```

신규 문서만 `uid`·`email`·`createdAt`을 쓰고 이후 로그인은 변경 가능한 프로필 필드만 merge한다. 신규 문서는 `role` 없이 생성된다. 앱의 `mapFirebaseUser()`는 필드가 없으면 이미 `user`로 해석한다. 기존 문서의 `role: "user"`는 merge가 보존하지만 클라이언트가 더 이상 전송하거나 바꿀 수 없다. `getDoc` import를 같은 파일의 Firestore import에 추가한다.

`deleteDoc`·`deleteUser`는 `src/` 전체에 없다. 위 두 파일을 열어 실제로 그런지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add firestore.rules tests/rules/users.test.mjs src/lib/firestore-service.ts
git commit -m "fix(rules): users.role 클라이언트 쓰기 차단

role 을 읽는 코드는 아직 없지만, 어드민 시스템을 옆에 만드는 참이라
권한처럼 생긴 필드가 사용자 쓰기 가능한 채로 남아 있으면 함정이 된다."
```

---

### Task 3: 백오피스 컬렉션 차단

**Files:**
- Modify: `firestore.rules` (catch-all `match /{document=**}` **앞에** 삽입)
- Test: `tests/rules/backoffice.test.mjs`

**Interfaces:**
- Consumes: `getTestEnv()` (Task 1)
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/rules/backoffice.test.mjs`:

```javascript
import { test } from "node:test";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const COLLECTIONS = [
  "buyers", "suppliers", "deals", "messages", "threads", "intakeReviews",
];

for (const col of COLLECTIONS) {
  test(`로그인 사용자가 ${col} 를 읽을 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("anyone").firestore();
    await assertFails(getDoc(doc(db, col, "x")));
  });

  test(`로그인 사용자가 ${col} 에 쓸 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("anyone").firestore();
    await assertFails(setDoc(doc(db, col, "x"), { a: 1 }));
  });

  test(`비로그인도 ${col} 를 읽을 수 없다`, async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, col, "x")));
  });
}

for (const sub of [
  "items", "supplierEngagements", "private", "sampleRounds", "shipments", "tasks", "events",
]) {
  test(`deals 하위 ${sub} 서브컬렉션도 막힌다`, async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("anyone").firestore();
    await assertFails(getDoc(doc(db, "deals", "d1", sub, "x")));
  });
}
```

- [ ] **Step 2: 실행해서 통과하는지 확인**

Run: `npm test`
Expected: **전부 PASS.** 기존 catch-all(`match /{document=**} { allow read, write: if false; }`)이 이미 막고 있다.

이 테스트는 "지금 막히는가"가 아니라 **"앞으로도 막히는가"**를 지킨다. 나중에 누가 `deals`에 규칙을 열면 여기서 걸린다. 통과하는 테스트를 먼저 쓰는 드문 경우다 — 회귀 방어선이 목적이기 때문이다.

- [ ] **Step 3: 규칙에 명시적 블록 추가**

catch-all에 기대지 않고 의도를 문서화한다. `match /{document=**}` **바로 앞**에 넣는다.

```
    // 백오피스 원장 — 클라이언트는 어느 쪽에서도 닿을 수 없다.
    // Admin SDK 는 규칙을 우회하므로 서버만 접근한다.
    match /buyers/{id}    { allow read, write: if false; }
    match /suppliers/{id} { allow read, write: if false; }
    match /deals/{id} {
      allow read, write: if false;
      match /{sub=**} { allow read, write: if false; }
    }
    match /messages/{id}  { allow read, write: if false; }
    match /threads/{id}   { allow read, write: if false; }
    match /intakeReviews/{id} { allow read, write: if false; }
```

- [ ] **Step 4: 실행해서 여전히 통과하는지 확인**

Run: `npm test`
Expected: 전부 PASS (신설 컬렉션과 딜 하위 7종 포함)

- [ ] **Step 5: 커밋**

```bash
git add firestore.rules tests/rules/backoffice.test.mjs
git commit -m "feat(rules): 백오피스 컬렉션 클라이언트 차단

컬렉션과 규칙과 테스트를 같은 커밋에 둔다 (AGENTS.md)."
```

---

### Task 4: Admin SDK 초기화와 허용목록 판정

**Files:**
- Create: `src/lib/firebase-admin.ts`
- Create: `src/lib/admin-auth.ts`
- Test: `tests/admin-auth.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `getAdminAuth(): Auth` — `firebase-admin/auth`의 `Auth`
  - `type AdminIdentity = { email: string }`
  - `assertAllowedAdmin(claims: DecodedLike): AdminIdentity` — 통과하면 신원 반환, 아니면 throw
  - `type DecodedLike = { email?: string; email_verified?: boolean; firebase?: { sign_in_provider?: string } }`
  - Task 5·6이 이 셋을 쓴다

- [ ] **Step 1: 의존성 설치**

```bash
npm i --save-exact firebase-admin@13.6.0 server-only@0.0.1
```

`server-only`는 Next.js에 딸려오지 않는다 — **이 리포에 설치돼 있지 않은 것을 확인했다.** 별도 패키지다.

설치 후 `node -p "require('./node_modules/firebase-admin/package.json').version"`으로 실제 버전을 확인한다. 13.x가 아니면 `firebase-admin/app`·`firebase-admin/auth` 서브패스 import가 유효한지 먼저 본다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/admin-auth.test.ts`:

```typescript
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertAllowedAdmin } from "../src/lib/admin-auth.ts";

const google = (email: string) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
});

beforeEach(() => {
  process.env.BACKOFFICE_ADMIN_EMAILS = "rheekw@techasset.co.kr, songjh@techasset.co.kr";
});

test("허용목록에 있는 구글 계정은 통과한다", () => {
  const id = assertAllowedAdmin(google("rheekw@techasset.co.kr"));
  assert.equal(id.email, "rheekw@techasset.co.kr");
});

test("대소문자와 공백이 달라도 통과한다", () => {
  const id = assertAllowedAdmin(google("  RheeKW@Techasset.co.KR "));
  assert.equal(id.email, "rheekw@techasset.co.kr");
});

test("허용목록에 없으면 거부한다", () => {
  assert.throws(() => assertAllowedAdmin(google("stranger@example.com")));
});

test("이메일 미인증이면 거부한다", () => {
  assert.throws(() =>
    assertAllowedAdmin({ ...google("rheekw@techasset.co.kr"), email_verified: false }),
  );
});

test("허용되지 않은 제공자면 거부한다", () => {
  assert.throws(() =>
    assertAllowedAdmin({
      ...google("rheekw@techasset.co.kr"),
      firebase: { sign_in_provider: "password" },
    }),
  );
});

test("microsoft.com 제공자는 통과한다", () => {
  process.env.BACKOFFICE_ADMIN_EMAILS = "support@medidakos.com";
  const id = assertAllowedAdmin({
    email: "support@medidakos.com",
    email_verified: true,
    firebase: { sign_in_provider: "microsoft.com" },
  });
  assert.equal(id.email, "support@medidakos.com");
});

test("BACKOFFICE_ADMIN_EMAILS 가 비어 있으면 통과가 아니라 예외다", () => {
  process.env.BACKOFFICE_ADMIN_EMAILS = "";
  assert.throws(
    () => assertAllowedAdmin(google("rheekw@techasset.co.kr")),
    /BACKOFFICE_ADMIN_EMAILS/,
  );
});

test("BACKOFFICE_ADMIN_EMAILS 가 없어도 예외다", () => {
  delete process.env.BACKOFFICE_ADMIN_EMAILS;
  assert.throws(
    () => assertAllowedAdmin(google("rheekw@techasset.co.kr")),
    /BACKOFFICE_ADMIN_EMAILS/,
  );
});

test("이메일이 없으면 거부한다", () => {
  assert.throws(() => assertAllowedAdmin({ ...google(""), email: undefined }));
});
```

- [ ] **Step 3: 실행해서 실패 확인**

Run: `npm test`
Expected: `admin-auth.test.ts` 전건 FAIL — `Cannot find module '../src/lib/admin-auth.ts'`

- [ ] **Step 4: Admin SDK 싱글턴 작성**

`src/lib/firebase-admin.ts`:

```typescript
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App | undefined;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  }
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
}

export function getAdminApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: cert(getServiceAccount()) });
  }
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
```

`import "server-only"`가 이 모듈이 클라이언트 번들에 딸려 들어가면 **빌드를 실패시킨다.** 서비스 계정이 브라우저로 새는 사고를 컴파일 타임에 막는다.

- [ ] **Step 5: 허용목록 판정 작성**

`src/lib/admin-auth.ts`:

```typescript
export type DecodedLike = {
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
};

export type AdminIdentity = { email: string };

const ALLOWED_PROVIDERS = new Set(["google.com", "microsoft.com"]);

export class NotAdminError extends Error {}

function allowlist(): Set<string> {
  const raw = process.env.BACKOFFICE_ADMIN_EMAILS;
  if (!raw?.trim()) {
    // 빈 목록을 "전원 허용"으로 읽으면 안 된다. 설정 누락은 사고다.
    throw new Error("BACKOFFICE_ADMIN_EMAILS is not set");
  }
  return new Set(
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

export function assertAllowedAdmin(claims: DecodedLike): AdminIdentity {
  const allowed = allowlist();
  const email = claims.email?.trim().toLowerCase();

  if (!email) throw new NotAdminError("no email on token");
  if (claims.email_verified !== true) throw new NotAdminError("email not verified");
  if (!ALLOWED_PROVIDERS.has(claims.firebase?.sign_in_provider ?? "")) {
    throw new NotAdminError("provider not allowed");
  }
  if (!allowed.has(email)) throw new NotAdminError("not on allowlist");

  return { email };
}
```

`allowlist()`를 맨 위에서 부르는 순서가 중요하다 — 설정 누락은 `NotAdminError`(401)가 아니라 일반 `Error`(500)로 터져야 한다.

- [ ] **Step 6: 실행해서 통과 확인**

Run: `npm test`
Expected: `admin-auth.test.ts` 9건 PASS. 규칙 테스트 21건도 그대로 PASS.

- [ ] **Step 7: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 8: 커밋**

```bash
git add package.json package-lock.json src/lib/firebase-admin.ts src/lib/admin-auth.ts tests/admin-auth.test.ts
git commit -m "feat(admin): Admin SDK 싱글턴과 이메일 허용목록 판정

커스텀 클레임 대신 요청마다 허용목록을 확인한다. 클레임은 토큰에 박혀서
회수가 즉시 반영되지 않는다."
```

---

### Task 5: 세션 쿠키 발급·삭제

**Files:**
- Create: `src/app/api/admin/session/route.ts`

**Interfaces:**
- Consumes: `getAdminAuth()`, `assertAllowedAdmin()`, `NotAdminError` (Task 4)
- Produces: 쿠키 이름 상수 `ADMIN_SESSION_COOKIE = "mdk_admin_session"` — Task 6·7이 쓴다

- [ ] **Step 1: 쿠키 이름을 공유 상수로 뽑기**

`src/lib/admin-auth.ts` 맨 아래에 추가한다. 미들웨어(Edge)와 route handler(Node)가 같은 이름을 써야 하는데, 미들웨어는 `firebase-admin`을 import할 수 없으므로 이 상수만 별도로 쓸 수 있어야 한다. `admin-auth.ts`에는 `firebase-admin` import가 없으므로 안전하다.

```typescript
export const ADMIN_SESSION_COOKIE = "mdk_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;
```

- [ ] **Step 2: 세션 라우트 작성**

`src/app/api/admin/session/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  assertAllowedAdmin,
  NotAdminError,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  const auth = getAdminAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  try {
    assertAllowedAdmin(decoded);
  } catch (err) {
    if (err instanceof NotAdminError) {
      return NextResponse.json({ error: "not authorized" }, { status: 403 });
    }
    throw err; // 설정 누락 → 500
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
```

`export const runtime = "nodejs"`가 필수다. 빼면 Edge에서 돌려다 `firebase-admin`이 터진다.

이 라우트는 `withAdmin`을 쓰지 않는다 — **세션을 만드는 라우트가 세션을 요구할 수 없다.** Task 6의 검사 테스트가 이 파일을 예외로 둔다.

- [ ] **Step 3: 타입체크와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/lib/admin-auth.ts src/app/api/admin/session/route.ts
git commit -m "feat(admin): 세션 쿠키 발급·삭제 라우트"
```

---

### Task 6: `withAdmin` 래퍼와 누락 검사

**Files:**
- Create: `src/lib/with-admin.ts`
- Test: `tests/with-admin-coverage.test.ts`

**Interfaces:**
- Consumes: `getAdminAuth()`, `assertAllowedAdmin()`, `NotAdminError`, `ADMIN_SESSION_COOKIE`, `AdminIdentity`
- Produces: `withAdmin(handler: AdminHandler): (req: NextRequest) => Promise<Response>` — 이후 모든 어드민 데이터 라우트가 이걸로만 내보낸다.
  `type AdminHandler = (req: NextRequest, actor: AdminIdentity) => Promise<Response> | Response`

- [ ] **Step 1: 래퍼 작성**

`src/lib/with-admin.ts`:

```typescript
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  assertAllowedAdmin,
  NotAdminError,
  type AdminIdentity,
} from "@/lib/admin-auth";

export type AdminHandler = (
  req: NextRequest,
  actor: AdminIdentity,
) => Promise<Response> | Response;

export function withAdmin(handler: AdminHandler) {
  return async function guarded(req: NextRequest): Promise<Response> {
    const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!cookie) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    } catch {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    let actor: AdminIdentity;
    try {
      actor = assertAllowedAdmin(decoded);
    } catch (err) {
      if (err instanceof NotAdminError) {
        return NextResponse.json({ error: "not authorized" }, { status: 403 });
      }
      throw err; // BACKOFFICE_ADMIN_EMAILS 누락 → 500
    }

    return handler(req, actor);
  };
}
```

`verifySessionCookie(cookie, true)`의 두 번째 인자가 폐기 확인이다. 허용목록에서 사람을 빼면 다음 요청부터 막히고, 계정 자체가 정지되면 이쪽에서 막힌다.

- [ ] **Step 2: 누락 검사 테스트 작성**

`tests/with-admin-coverage.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ADMIN_API_DIR = "src/app/api/admin";

// 세션을 만드는 라우트는 세션을 요구할 수 없다.
const EXEMPT = new Set(["session/route.ts"]);

function routeFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...routeFiles(full, rel));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(rel);
  }
  return out;
}

test("어드민 API 라우트는 전부 withAdmin 으로만 내보낸다", () => {
  const files = routeFiles(ADMIN_API_DIR);
  assert.ok(files.length > 0, "어드민 라우트가 하나도 없다 — 경로가 맞는지 확인");

  const offenders: string[] = [];
  for (const rel of files) {
    if (EXEMPT.has(rel)) continue;
    const src = readFileSync(join(ADMIN_API_DIR, rel), "utf8");
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const re = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*withAdmin\\s*\\(`);
      const declared = new RegExp(`export\\s+(const|async\\s+function|function)\\s+${method}\\b`);
      if (declared.test(src) && !re.test(src)) {
        offenders.push(`${rel}: ${method}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `withAdmin 없이 내보낸 핸들러: ${offenders.join(", ")}`);
});
```

- [ ] **Step 3: 실행해서 통과 확인**

Run: `npm test`
Expected: PASS. 지금은 `session/route.ts` 하나뿐이고 예외 목록에 있다.

- [ ] **Step 4: 검사가 실제로 잡는지 확인**

임시로 `src/app/api/admin/_probe/route.ts`를 만든다.

```typescript
export async function GET() {
  return new Response("nope");
}
```

Run: `npm test`
Expected: FAIL — `withAdmin 없이 내보낸 핸들러: _probe/route.ts: GET`

확인했으면 지운다: `rm -rf src/app/api/admin/_probe`

이 단계를 건너뛰면 **아무것도 검사하지 않는 테스트**를 커밋하게 된다.

- [ ] **Step 5: 다시 통과 확인 후 커밋**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 통과

```bash
git add src/lib/with-admin.ts tests/with-admin-coverage.test.ts
git commit -m "feat(admin): withAdmin 래퍼와 누락 검사 테스트

래퍼를 안 거치면 핸들러가 존재하지 않는다. 규율이 아니라 구조로 막는다."
```

---

### Task 7: 미들웨어와 로그인 화면

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `ADMIN_SESSION_COOKIE` (Task 5), `getFirebaseAuth()` (기존 `src/lib/firebase.ts`)
- Produces: 없음 — 이 계획의 마지막 조각

- [ ] **Step 1: 미들웨어 작성**

`src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

// Edge 런타임이라 firebase-admin 을 쓸 수 없다.
// 여기서 하는 일은 쿠키 유무를 보고 리디렉트하는 것뿐이다.
// 실제 검증은 withAdmin 이 한다.
export function middleware(req: NextRequest) {
  if (req.cookies.get(ADMIN_SESSION_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/((?!login$|login/).*)"],
};
```

matcher가 `/admin/login`을 제외한다. 안 그러면 리디렉트가 무한 루프에 빠진다.

- [ ] **Step 2: 로그인 화면 작성**

`src/app/admin/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.status === 403) {
        setError("이 계정은 백오피스 접근 권한이 없습니다.");
        return;
      }
      if (!res.ok) {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Medidakos 백오피스</h1>
          <p className="mt-1 text-xs text-neutral-500">회사 계정으로 로그인하세요</p>
        </div>

        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? "로그인 중…" : "Google 계정으로 로그인"}
        </button>

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 타입체크·린트·테스트**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 통과

- [ ] **Step 4: 브라우저에서 확인**

```bash
npm run dev
```

`.env.local`에 `BACKOFFICE_ADMIN_EMAILS`와 `FIREBASE_SERVICE_ACCOUNT_B64`를 넣은 뒤 확인한다.

| 확인 | 기대 |
|---|---|
| `/admin` 접속 (비로그인) | `/admin/login`으로 리디렉트 |
| `/admin/login`에서 허용목록 계정으로 로그인 | `/admin`으로 이동 |
| `/admin/login`에서 허용목록 밖 계정으로 로그인 | "접근 권한이 없습니다" |
| 쿠키를 지우고 `/admin` 재접속 | 다시 로그인으로 |
| `BACKOFFICE_ADMIN_EMAILS`를 비우고 로그인 시도 | **500** (403이 아니라) |

마지막 줄이 가장 중요하다. 설정 누락이 조용히 통과하면 프리뷰 배포가 공개된다.

- [ ] **Step 5: 커밋**

```bash
git add src/middleware.ts src/app/admin/login/page.tsx
git commit -m "feat(admin): 미들웨어 리디렉트와 로그인 화면"
```

- [ ] **Step 6: Vercel 환경변수 설정**

Production·Preview·Development 세 환경 모두에 넣는다. **Preview를 빠뜨리면 프리뷰 URL에서 500이 난다** — 공개되지는 않지만 동작도 안 한다.

```
BACKOFFICE_ADMIN_EMAILS                   rheekw@techasset.co.kr,songjh@techasset.co.kr,kimhs@techasset.co.kr,parkjy@techasset.co.kr
FIREBASE_SERVICE_ACCOUNT_B64   (서비스 계정 JSON 을 base64 로)
```

- [ ] **Step 7: 규칙 배포**

```bash
firebase deploy --only firestore:rules --project medidakos
```

`--only firestore:rules`를 반드시 붙인다. 전체 배포는 `lifecycleScan`을 딸려 올린다(스펙 2.5).

배포 후 **실제로 반영됐는지 확인한다.** 콘솔에서 규칙 탭을 열어 `users` 블록에 `allow delete: if false`가 있는지 본다. 명령의 자체 보고를 믿지 않는다(AGENTS.md).

- [ ] **Step 8: PR**

```bash
git push -u origin feat/admin-auth-gate
gh pr create --base dev --title "feat(admin): 인가 게이트" --body "스펙 docs/backoffice-spec.md 5장 / 작업 순서 1~3"
```

---

## 다음 계획으로 넘기는 것

스펙 9장의 작업 4~10은 별도 계획으로 나눈다.

| 계획 | 작업 | 선행 |
|---|---|---|
| `buyers`·`suppliers`·`intakeReviews` 원장 | 4 | 이 계획 |
| 수집기 (`thomas@` 단독 관통) | 5 | 이 계획 + 관리자 승인 |
| 받은편지함·설정 화면 | 6 | 수집기 |
| 나머지 여섯 함 + 채널톡 + 폼 | 7 | 수집기 |
| `deals` + 파이프라인 보드 | 8·9 | `buyers`·`suppliers`·`intakeReviews` |
| 파서 + eval | 10 | 7, 8 |

작업 9(`sampleRounds`·`shipments`·`private/finance`)는 8과 같은 계획에 넣는다. 일반 딜 저장소와 재무 저장소는 파일을 분리하되 같은 PR에서 규칙·타입·UI를 함께 검증한다.
