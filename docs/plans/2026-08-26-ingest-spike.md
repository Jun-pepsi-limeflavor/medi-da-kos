# 수집기 관통 계획 — thomas@ 한 계정

> **For agentic workers:**  Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `thomas@medidakoslabs.com` 메일함 하나를 서버 자격증명으로 읽어 불변 원문 `messages`와 사람의 작업 상태 `threads`에 안전하게 적재한다. 개인 노트북이 관여하지 않는다.

**Architecture:** 도메인 전체 위임을 받은 서비스 계정이 메일함 주인을 가장해 Gmail API를 부른다. **키 파일을 만들지 않는다** — Cloud Functions 런타임이 IAM Credentials API로 JWT에 서명하고 그걸 액세스 토큰으로 바꾼다. 수집 함수는 기존 `functions/`와 분리된 `functions-ingest/` 코드베이스에 있어서 배포가 서로 닿지 않는다.

**Tech Stack:** Cloud Functions v2 (JavaScript CommonJS, Node 20, firebase-functions v6) / `asia-northeast3` / Cloud Scheduler / Gmail REST v1 / Secret Manager

**Spec:** `docs/backoffice-spec.md` — 3장, 6.1~6.2, 9장 작업 5

**선행:** 계획 1 머지 + **`medidakoslabs.com` 도메인 전체 위임 승인**

---

## 이건 스파이크다

**계획 4·6의 전제가 여기서 판가름 난다.** 확인할 것 둘:

1. 도메인 전체 위임이 실제로 동작하는가 — 안 되면 3장 인증 설계를 다시 짠다
2. Gmail 응답이 실제로 어떻게 생겼는가 — 계획 6의 파서 프롬프트가 여기 기댄다

그래서 **Task 2가 함수가 아니라 스크립트다.** 배포·스케줄·Firestore 없이 "메일 한 통이 읽히는가"만 먼저 본다. 안 되면 나머지를 안 짓는다.

## Global Constraints

- 수집 함수는 **`functions-ingest/` 코드베이스에만** 넣는다. `functions/`를 건드리지 않는다
- **`setGlobalOptions({ region: "asia-northeast3" })`를 반드시 넣는다.** 빼면 `us-central1`에 생긴다. 기존 `functions/index.js`에 같은 이유의 주석이 있다
- **서비스 계정 키 파일을 만들지 않는다.** 다운로드받는 순간 노트북에 비밀이 생긴다
- 메일 본문을 **그대로 저장한다.** 재파싱과 평가가 여기 기댄다 (스펙 6.2)
- 문서 ID는 `{channel}:{externalId}` 고정. 폴링 재실행이 중복을 만들지 않는다
- 스레드 ID는 `{channel}:{account}:{providerThreadId}` 고정. 계정이 다른 같은 문자열을 합치지 않는다
- 제공자 페이지를 끝까지 처리한 뒤에만 cursor를 전진시킨다
- 재수집은 `threads`의 읽음·보관·연결·수동 side를 덮지 않는다
- `firebase deploy --only functions` (전체)를 쓰지 않는다. `--only functions:ingest`로 좁힌다
- **`git add -A`를 쓰지 않는다**

```bash
git switch -c feat/ingest-spike origin/dev
```

---

## File Structure

| 파일                                       | 책임                                                                |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `firebase.json` (수정)                   | `functions-ingest` 코드베이스 등록 + 에뮬레이터                   |
| `functions-ingest/package.json` (신규)   | Node 20, firebase-functions v6                                      |
| `functions-ingest/index.js` (신규)       | 스케줄 함수 진입점                                                  |
| `functions-ingest/google-auth.js` (신규) | 서비스 계정 → 가장 액세스 토큰                                     |
| `functions-ingest/gmail.js` (신규)       | Gmail REST 호출과 응답 정규화                                       |
| `functions-ingest/store.js` (신규)       | `messages` 원문·`threads` 요약을 트랜잭션으로 쓰기 + 수집 상태 |
| `scripts/spike-gmail.js` (신규, 임시)    | Task 2 전용. 끝나면 지운다                                          |

---

### Task 1: `functions-ingest` 코드베이스

**Files:**

- Modify: `firebase.json`
- Create: `functions-ingest/package.json`
- Create: `functions-ingest/index.js`

**Interfaces:**

- Consumes: 없음
- Produces: `exports.ingestGmail` — 스케줄 함수. Task 5에서 실제 동작이 붙는다

- [ ] **Step 1: `firebase.json`에 코드베이스 추가**

기존 `"functions"` 값이 배열이므로 항목을 하나 더 넣는다. 기존 항목은 손대지 않는다.

```json
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "*.local"]
    },
    {
      "source": "functions-ingest",
      "codebase": "ingest",
      "ignore": ["node_modules", ".git", "*.local"]
    }
  ],
```

**이 분리가 `lifecycleScan` 문제를 배치로 막는다.** `--only functions:ingest`가 `functions/` 코드베이스를 물리적으로 볼 수 없다.

- [ ] **Step 2: 패키지 정의**

`functions-ingest/package.json`:

```json
{
  "name": "functions-ingest",
  "description": "메일·채널톡 수집기",
  "private": true,
  "main": "index.js",
  "engines": { "node": "20" },
  "scripts": {
    "logs": "firebase functions:log --only ingestGmail"
  },
  "dependencies": {
    "firebase-admin": "^13.0.2",
    "firebase-functions": "^6.3.0",
    "google-auth-library": "^9.15.0"
  }
}
```

버전을 기존 `functions/package.json`과 맞췄다. `google-auth-library`는 설치 후 `node -p "require('./functions-ingest/node_modules/google-auth-library/package.json').version"`으로 확인한다.

```bash
npm --prefix functions-ingest install
```

- [ ] **Step 3: 진입점 골격**

`functions-ingest/index.js`:

```javascript
const { initializeApp } = require("firebase-admin/app");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineString } = require("firebase-functions/params");

// 리전을 빼면 us-central1 에 생긴다. 기존 functions/index.js 와 같은 이유다.
setGlobalOptions({ region: "asia-northeast3" });

initializeApp();

const INGEST_MAILBOXES = defineString("INGEST_MAILBOXES");

exports.ingestGmail = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "Asia/Seoul" },
  async () => {
    const mailboxes = INGEST_MAILBOXES.value()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log("ingestGmail: 대상 메일함", mailboxes.length, "개");
    // Task 5 에서 실제 수집이 들어온다.
  },
);
```

- [ ] **Step 4: 배포 없이 로드되는지 확인**

```bash
node -e "require('./functions-ingest/index.js'); console.log('로드 OK')"
```

Expected: `로드 OK`. 문법 오류나 의존성 누락이 여기서 걸린다.

**아직 배포하지 않는다.** Task 2가 자격증명을 확인하기 전에 스케줄 함수를 띄우면 5분마다 실패 로그가 쌓인다.

- [ ] **Step 5: 커밋**

```bash
git add firebase.json functions-ingest/package.json functions-ingest/package-lock.json functions-ingest/index.js
git commit -m "build: functions-ingest 코드베이스 분리

기존 functions/ 와 배포가 닿지 않는다. lifecycleScan 이 딸려 올라가는 것을
기억이 아니라 배치로 막는다."
```

---

### Task 2: 자격증명 스파이크 — 메일 한 통

**Files:**

- Create: `scripts/spike-gmail.js` (임시)

**Interfaces:**

- Consumes: 없음
- Produces: **답 두 개** — 위임이 되는가, 응답이 어떻게 생겼는가

- [ ] **Step 1: 서비스 계정 확인**

```bash
gcloud iam service-accounts list --project medidakos
```

전용 계정을 새로 만든다. 기존 컴퓨트 기본 계정을 재사용하지 않는다 — 권한 범위를 좁게 유지한다.

```bash
gcloud iam service-accounts create mail-ingest \
  --display-name "Mail ingest (domain-wide delegation)" \
  --project medidakos
```

클라이언트 ID를 받아 적는다. **Workspace 관리콘솔에 등록할 값이 이것이다.**

```bash
gcloud iam service-accounts describe mail-ingest@medidakos.iam.gserviceaccount.com \
  --project medidakos --format="value(uniqueId)"
```

- [ ] **Step 2: 도메인 전체 위임 등록 (사람이 하는 일)**

`medidakoslabs.com` 관리콘솔 → 보안 → 액세스 및 데이터 제어 → API 제어 → 도메인 전체 위임 → 새로 추가

```
클라이언트 ID   (Step 1 의 uniqueId)
OAuth 범위      https://www.googleapis.com/auth/gmail.readonly
```

- [ ] **Step 3: 자기 자신에게 토큰 생성 권한 부여**

키 파일 없이 JWT에 서명하려면 이 역할이 필요하다.

```bash
gcloud iam service-accounts add-iam-policy-binding \
  mail-ingest@medidakos.iam.gserviceaccount.com \
  --member "serviceAccount:mail-ingest@medidakos.iam.gserviceaccount.com" \
  --role roles/iam.serviceAccountTokenCreator \
  --project medidakos

# 로컬에서 스파이크를 돌릴 사람도 같은 권한이 필요하다
gcloud iam service-accounts add-iam-policy-binding \
  mail-ingest@medidakos.iam.gserviceaccount.com \
  --member "user:$(gcloud config get-value account)" \
  --role roles/iam.serviceAccountTokenCreator \
  --project medidakos
```

- [ ] **Step 4: 스파이크 스크립트**

`scripts/spike-gmail.js`:

```javascript
/**
 * 임시 스크립트. 확인할 것 둘:
 *   1. 도메인 전체 위임으로 thomas@ 메일함이 읽히는가
 *   2. 응답이 실제로 어떻게 생겼는가
 * 답을 얻으면 지운다.
 */
const { GoogleAuth } = require("google-auth-library");

const SA = "mail-ingest@medidakos.iam.gserviceaccount.com";
const SUBJECT = process.argv[2] || "thomas@medidakoslabs.com";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

async function impersonatedToken(subject) {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SA,
    sub: subject,             // ← 가장할 사람. 도메인 전체 위임의 핵심
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // 키 파일 없이 IAM Credentials API 가 서명한다.
  const signed = await client.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA}:signJwt`,
    method: "POST",
    data: { payload: JSON.stringify(payload) },
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signed.data.signedJwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error("토큰 교환 실패: " + JSON.stringify(json));
  }
  return json.access_token;
}

async function main() {
  const token = await impersonatedToken(SUBJECT);
  console.log("✅ 가장 토큰 발급됨 —", SUBJECT);

  const H = { Authorization: `Bearer ${token}` };
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";

  const list = await (
    await fetch(`${base}/messages?maxResults=3&q=newer_than:30d`, { headers: H })
  ).json();
  console.log("✅ 목록 조회 —", list.resultSizeEstimate, "통 추정");

  if (!list.messages?.length) {
    console.log("최근 30일 메일이 없다. q 를 바꿔서 다시 본다.");
    return;
  }

  const full = await (
    await fetch(`${base}/messages/${list.messages[0].id}?format=full`, { headers: H })
  ).json();

  // ── 여기가 스파이크의 산출물이다. 계획 4·6 이 이 모양에 기댄다 ──
  console.log("\n=== 메시지 최상위 키 ===");
  console.log(Object.keys(full));
  console.log("\n=== payload 구조 ===");
  console.log({
    mimeType: full.payload?.mimeType,
    partCount: full.payload?.parts?.length ?? 0,
    partMimeTypes: (full.payload?.parts || []).map((p) => p.mimeType),
    headerNames: (full.payload?.headers || []).map((h) => h.name).slice(0, 20),
  });
  console.log("\n=== historyId / threadId ===");
  console.log({ historyId: full.historyId, threadId: full.threadId });

  const profile = await (await fetch(`${base}/profile`, { headers: H })).json();
  console.log("\n=== profile (증분 수집의 시작점) ===");
  console.log(profile);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
```

- [ ] **Step 5: 돌린다**

```bash
node scripts/spike-gmail.js thomas@medidakoslabs.com
```

| 결과                                | 뜻                                 | 다음                                              |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------- |
| `✅ 가장 토큰 발급됨` + 목록      | 위임 성공                          | Task 3으로                                        |
| `unauthorized_client`             | 위임이 등록 안 됐거나 범위 불일치  | 관리콘솔의 클라이언트 ID·범위를 Step 1·2와 대조 |
| `403 iam.serviceAccounts.signJwt` | 토큰 생성 권한 없음                | Step 3 다시                                       |
| `400 invalid_grant`               | `sub` 가 그 도메인 사용자가 아님 | 메일 주소 확인                                    |

**여기서 막히면 멈춘다.** Task 3 이후를 짓지 않고 무엇이 막혔는지 보고한다.

- [ ] **Step 6: 출력을 기록으로 남긴다**

응답 구조를 `docs/gmail-response-shape.md`에 붙여넣는다. 계획 6의 파서가 이 문서를 읽는다. **이게 스파이크의 진짜 산출물이다.**

```bash
node scripts/spike-gmail.js thomas@medidakoslabs.com > docs/gmail-response-shape.md 2>&1
```

실제 메일 제목·주소가 섞이면 지운다. 필요한 건 **구조**지 내용이 아니다.

- [ ] **Step 7: 다른 메일함도 되는지 한 번만 확인**

```bash
node scripts/spike-gmail.js hally@medidakoslabs.com
```

같은 도메인이라 위임 등록 하나로 둘 다 돼야 한다. 안 되면 도메인 단위가 아니라 사용자 단위로 뭔가 걸린 것이다.

- [ ] **Step 8: 커밋 — 스크립트는 빼고 결과만**

```bash
git add docs/gmail-response-shape.md
git commit -m "docs: Gmail 응답 구조 실측 기록

도메인 전체 위임이 동작하는 것을 확인했다. 계획 6 파서가 이 문서를 읽는다."
```

`scripts/spike-gmail.js`는 커밋하지 않는다. Task 5가 끝나면 지운다.

---

### Task 3: 자격증명 모듈

**Files:**

- Create: `functions-ingest/google-auth.js`

**Interfaces:**

- Consumes: 없음
- Produces: `getGmailToken(subject: string): Promise<string>` — 가장 액세스 토큰. 1시간 캐시

- [ ] **Step 1: 스파이크 코드를 모듈로 옮긴다**

`functions-ingest/google-auth.js`:

```javascript
const { GoogleAuth } = require("google-auth-library");

const SA = process.env.INGEST_SERVICE_ACCOUNT
  || "mail-ingest@medidakos.iam.gserviceaccount.com";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// 토큰은 1시간 유효하다. 5분마다 도는 함수가 매번 두 번씩 왕복할 이유가 없다.
const cache = new Map();  // subject -> { token, expiresAt }

async function getGmailToken(subject) {
  const hit = cache.get(subject);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const now = Math.floor(Date.now() / 1000);
  const signed = await client.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA}:signJwt`,
    method: "POST",
    data: {
      payload: JSON.stringify({
        iss: SA,
        sub: subject,
        scope: SCOPE,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    },
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signed.data.signedJwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`토큰 교환 실패 (${subject}): ${JSON.stringify(json)}`);
  }

  cache.set(subject, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

module.exports = { getGmailToken };
```

```
ponytail: 인스턴스 메모리 캐시. Cloud Functions 인스턴스가 여럿이면 각자 캐시한다.
          5분 주기에 메일함 7개면 왕복이 시간당 최대 84회 — 문제가 되면 그때 공유 캐시로.
```

- [ ] **Step 2: 로드 확인**

```bash
node -e "const {getGmailToken}=require('./functions-ingest/google-auth.js'); console.log(typeof getGmailToken)"
```

Expected: `function`

- [ ] **Step 3: 커밋**

```bash
git add functions-ingest/google-auth.js
git commit -m "feat(ingest): 키 파일 없는 메일함 가장 자격증명"
```

---

### Task 4: 메시지 정규화와 저장

**Files:**

- Create: `functions-ingest/gmail.js`
- Create: `functions-ingest/store.js`
- Test: `tests/gmail-normalize.test.mjs`

**Interfaces:**

- Consumes: `getGmailToken()` (Task 3)
- Produces:
  - `normalizeMessage(raw, { channel, side, sideSource, account }): NormalizedMessage`
  - `listMessagePage(token, { after, pageToken })`, `listAllMessageIds(token, { after })`, `getMessage(token, id)`
  - `saveMessage(db, normalized): Promise<void>` — 원문·스레드 요약을 결정적 ID로 저장
  - `getIngestState(db, account)`, `setIngestState(db, account, state)`

**Task 2의 산출물(`docs/gmail-response-shape.md`)을 먼저 읽는다.** 아래 헤더 이름과 파트 구조는 그 문서로 대조한 뒤 확정한다.

- [ ] **Step 1: 정규화 테스트 먼저**

`tests/gmail-normalize.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage } from "../functions-ingest/gmail.js";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");

const raw = {
  id: "18f0abc",
  threadId: "18f0aaa",
  historyId: "99123",
  internalDate: "1755000000000",
  payload: {
    mimeType: "multipart/alternative",
    headers: [
      { name: "From", value: "Charity <candy@example.com>" },
      { name: "To", value: "thomas@medidakoslabs.com" },
      { name: "Subject", value: "Perfume sample request" },
      { name: "Message-ID", value: "<abc@mail.example.com>" },
    ],
    parts: [
      { mimeType: "text/plain", body: { data: b64("본문입니다") } },
      { mimeType: "text/html", body: { data: b64("<p>본문입니다</p>") } },
    ],
  },
};

const ctx = {
  channel: "gmail_thomas",
  side: "brand",
  sideSource: "account_rule",
  account: "thomas@medidakoslabs.com",
};

test("결정적 문서 ID 를 만든다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.docId, "gmail_thomas:18f0abc");
});

test("발신자 이름과 주소를 나눈다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.from, "candy@example.com");
  assert.equal(m.fromName, "Charity");
});

test("text/plain 을 골라 본문으로 쓴다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.bodyText, "본문입니다");
});

test("text/plain 이 없으면 html 에서 태그를 벗긴다", () => {
  const htmlOnly = {
    ...raw,
    payload: { ...raw.payload, parts: [raw.payload.parts[1]] },
  };
  const m = normalizeMessage(htmlOnly, ctx);
  assert.equal(m.bodyText, "본문입니다");
});

test("파트가 없고 body 에 직접 들어 있는 경우도 읽는다", () => {
  const flat = {
    ...raw,
    payload: {
      mimeType: "text/plain",
      headers: raw.payload.headers,
      body: { data: b64("납작한 본문") },
    },
  };
  assert.equal(normalizeMessage(flat, ctx).bodyText, "납작한 본문");
});

test("내가 보낸 메일이면 direction 이 out 이다", () => {
  const sent = {
    ...raw,
    payload: {
      ...raw.payload,
      headers: [
        { name: "From", value: "Thomas <thomas@medidakoslabs.com>" },
        { name: "To", value: "candy@example.com" },
        { name: "Subject", value: "Re: Perfume sample request" },
      ],
    },
  };
  assert.equal(normalizeMessage(sent, ctx).direction, "out");
});

test("side 근거와 namespaced threadKey 를 싣는다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.side, "brand");
  assert.equal(m.sideSource, "account_rule");
  assert.equal(m.sourceAccount, "thomas@medidakoslabs.com");
  assert.equal(m.providerThreadId, "18f0aaa");
  assert.equal(m.threadKey, "gmail_thomas:thomas@medidakoslabs.com:18f0aaa");
});

test("internalDate 를 ISO 로 바꾼다", () => {
  const m = normalizeMessage(raw, ctx);
  assert.equal(m.sentAt, new Date(1755000000000).toISOString());
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: 8건 FAIL — 모듈 없음

- [ ] **Step 3: 정규화 구현**

`functions-ingest/gmail.js`:

```javascript
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

function header(payload, name) {
  const found = (payload?.headers || []).find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

function parseAddress(value) {
  const m = value.match(/^\s*(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?\s*$/);
  if (!m) return { name: "", email: value.trim().toLowerCase() };
  return { name: (m[1] || "").trim(), email: m[2].trim().toLowerCase() };
}

function decode(data) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/ /g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 중첩 파트를 훑어 mimeType 이 맞는 첫 본문을 찾는다. */
function findBody(payload, mimeType) {
  if (!payload) return "";
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decode(payload.body.data);
  }
  for (const part of payload.parts || []) {
    const found = findBody(part, mimeType);
    if (found) return found;
  }
  return "";
}

function collectAttachments(payload, out = []) {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size ?? 0,
      attachmentId: payload.body.attachmentId,
    });
  }
  for (const part of payload.parts || []) collectAttachments(part, out);
  return out;
}

function normalizeMessage(raw, { channel, side, sideSource, account }) {
  const from = parseAddress(header(raw.payload, "From"));
  const plain = findBody(raw.payload, "text/plain");
  const bodyText = plain || stripHtml(findBody(raw.payload, "text/html"));

  return {
    docId: `${channel}:${raw.id}`,
    channel,
    side,
    sideSource,
    sourceAccount: account.toLowerCase(),
    externalId: raw.id,
    providerThreadId: raw.threadId,
    threadKey: `${channel}:${account.toLowerCase()}:${raw.threadId}`,
    historyId: raw.historyId,
    direction: from.email === account.toLowerCase() ? "out" : "in",
    from: from.email,
    fromName: from.name,
    to: header(raw.payload, "To")
      .split(",")
      .map((s) => parseAddress(s).email)
      .filter(Boolean),
    subject: header(raw.payload, "Subject"),
    bodyText,
    attachments: collectAttachments(raw.payload),
    sentAt: new Date(Number(raw.internalDate)).toISOString(),
  };
}

async function listMessagePage(token, { after, pageToken, max = 100 }) {
  const q = after ? `after:${after}` : "newer_than:7d";
  const params = new URLSearchParams({ maxResults: String(max), q });
  if (pageToken) params.set("pageToken", pageToken);
  const url = `${GMAIL}/messages?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`목록 조회 실패 ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return {
    ids: (json.messages || []).map((m) => m.id),
    nextPageToken: json.nextPageToken ?? null,
  };
}

async function listAllMessageIds(token, { after }) {
  const ids = [];
  let pageToken;
  do {
    const page = await listMessagePage(token, { after, pageToken });
    ids.push(...page.ids);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

async function getMessage(token, id) {
  const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`메시지 조회 실패 ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = {
  normalizeMessage, listMessagePage, listAllMessageIds, getMessage, parseAddress, stripHtml,
};
```

증분 조회에 `historyId` 대신 `after:` 쿼리를 쓴다. `history.list`는 `historyId`가 너무 오래되면 404를 내고 그때 전체 재동기화 경로를 따로 짜야 한다. `after:` 는 그 분기가 없다.

```
ponytail: after: 쿼리는 초 단위라 같은 초에 온 메일을 중복 조회할 수 있다.
          결정적 문서 ID 가 덮어쓰기로 흡수하므로 문제가 안 된다.
```

cursor가 있으면 실제 조회는 `after = max(0, lastEpochSeconds - 5)`로 5초 겹친다. 같은 초 경계와 부분 지연을 흡수하고 중복은 결정적 ID가 제거한다.

- [ ] **Step 4: 페이지 순회 테스트를 추가하고 통과 확인**

두 번째 응답에만 있는 메시지 ID가 결과에 포함되고, 두 번째 요청 URL에 첫 응답의 `nextPageToken`이 들어가는지 fetch mock으로 검증한다.

- [ ] **Step 5: 저장 모듈**

`functions-ingest/store.js`:

```javascript
const MESSAGES = "messages";
const THREADS = "threads";
const STATE = "ingestState";

async function saveMessage(db, m) {
  const { docId, ...data } = m;
  const messageRef = db.collection(MESSAGES).doc(docId);
  const threadRef = db.collection(THREADS).doc(m.threadKey);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const [messageSnap, threadSnap] = await Promise.all([
      tx.get(messageRef), tx.get(threadRef),
    ]);

    const isNewMessage = !messageSnap.exists;
    if (!isNewMessage) {
      // source 필드만 갱신한다. parseStatus·extraction·accepted는 건드리지 않는다.
      tx.update(messageRef, { ...data, sourceUpdatedAt: now });
    } else {
      tx.create(messageRef, {
        ...data,
        parseStatus: "pending",
        createdAt: now,
        sourceUpdatedAt: now,
      });
    }

    const latest = !threadSnap.exists || m.sentAt >= (threadSnap.data().lastMessageAt ?? "");
    if (!threadSnap.exists) {
      tx.create(threadRef, {
        channel: m.channel,
        sourceAccount: m.sourceAccount,
        providerThreadId: m.providerThreadId,
        readState: m.direction === "in" ? "unread" : "read",
        triageState: "open",
        linkState: "unlinked",
        side: m.side,
        sideSource: m.sideSource,
        sideHistory: [],
        lastMessageAt: m.sentAt,
        lastDirection: m.direction,
        createdAt: now,
        updatedAt: now,
      });
    } else if (latest) {
      const update = {
        lastMessageAt: m.sentAt,
        lastDirection: m.direction,
        updatedAt: now,
      };
      if (isNewMessage && m.direction === "in") {
        update.readState = "unread";
        if (threadSnap.data().triageState === "archived") {
          update.triageState = "open";
        }
      }
      if (threadSnap.data().sideSource !== "manual") {
        update.side = m.side;
        update.sideSource = m.sideSource;
      }
      tx.update(threadRef, update);
    }
  });
}

async function getIngestState(db, account) {
  const snap = await db.collection(STATE).doc(account).get();
  return snap.exists ? snap.data() : {
    lastEpochSeconds: null,
    lastSuccessAt: null,
    lastError: null,
    processedCount: 0,
  };
}

async function setIngestState(db, account, state) {
  await db.collection(STATE).doc(account).set(
    { ...state, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

module.exports = { saveMessage, getIngestState, setIngestState };
```

`merge: true`만으로 사람 상태를 보존할 수 없다. 전달한 필드는 merge에서도 덮인다. 신규 메시지에만 `parseStatus='pending'`을 만들고, 재수집은 source 필드만 갱신한다. 읽음·보관·연결은 별도 `threads` 문서라 수집기가 소유하지 않는다.

새 인바운드 메시지가 추가될 때만 `readState='unread'`로 되돌리고, 보관된 스레드는 `open`으로 다시 연다. `ignored`는 자동으로 열지 않는다. 같은 메시지를 재수집한 경우에는 사람 상태가 그대로다.

- [ ] **Step 6: `ingestState` 규칙 추가**

새 컬렉션이므로 규칙을 같은 커밋에 넣는다. `firestore.rules`의 백오피스 블록 옆에.

```
    match /ingestState/{account} { allow read, write: if false; }
```

`tests/rules/backoffice.test.mjs`의 `COLLECTIONS` 배열에 `"ingestState"`를 추가한다. `threads`는 계획 1에서 이미 포함된다.

- [ ] **Step 7: 검사와 커밋**

Run: `npm test`
Expected: 전부 PASS (규칙 테스트가 `ingestState` 3건 늘어난다)

```bash
git add functions-ingest/gmail.js functions-ingest/store.js firestore.rules tests/
git commit -m "feat(ingest): 메시지 정규화와 결정적 ID 저장"
```

---

### Task 5: 스케줄 함수 연결과 배포

**Files:**

- Modify: `functions-ingest/index.js`

**Interfaces:**

- Consumes: Task 3·4의 전부
- Produces: 배포된 `ingestGmail`

- [ ] **Step 1: 진입점 완성**

`functions-ingest/index.js`의 `exports.ingestGmail` 본문을 채운다.

```javascript
const { getFirestore } = require("firebase-admin/firestore");
const { getGmailToken } = require("./google-auth");
const { listAllMessageIds, getMessage, normalizeMessage } = require("./gmail");
const { saveMessage, getIngestState, setIngestState } = require("./store");

// 메일함은 side 의 기본값일 뿐이다. 계획 4에서 주소 매칭·수동 정정이 가능하다.
const SIDE_BY_DOMAIN = {
  "medidakoslabs.com": "brand",
  "medidakos.com": "brand",
  "techasset.co.kr": "factory",
};

function sideOf(account) {
  return SIDE_BY_DOMAIN[account.split("@")[1]] ?? "unknown";
}

function channelOf(account) {
  return `gmail_${account.split("@")[0]}`;
}

async function ingestOne(db, account) {
  const token = await getGmailToken(account);
  const state = await getIngestState(db, account);

  const after = state.lastEpochSeconds == null
    ? null
    : Math.max(0, state.lastEpochSeconds - 5);
  const ids = await listAllMessageIds(token, { after });
  let newest = state.lastEpochSeconds ?? 0;

  for (const id of ids) {
    const raw = await getMessage(token, id);
    const normalized = normalizeMessage(raw, {
      channel: channelOf(account),
      side: sideOf(account),
      sideSource: "account_rule",
      account,
    });
    await saveMessage(db, normalized);
    newest = Math.max(newest, Math.floor(Number(raw.internalDate) / 1000));
  }

  await setIngestState(db, account, {
    lastEpochSeconds: newest || state.lastEpochSeconds,
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    processedCount: ids.length,
  });
  return ids.length;
}
```

그리고 스케줄 본문을 바꾼다.

```javascript
exports.ingestGmail = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "Asia/Seoul", timeoutSeconds: 540 },
  async () => {
    const db = getFirestore();
    const mailboxes = INGEST_MAILBOXES.value()
      .split(",").map((s) => s.trim()).filter(Boolean);

    for (const account of mailboxes) {
      try {
        const n = await ingestOne(db, account);
        console.log(`ingestGmail ${account}: ${n}통`);
      } catch (err) {
        // 한 메일함이 실패해도 나머지는 계속한다.
        console.error(`ingestGmail ${account} 실패:`, err.message);
        await setIngestState(db, account, {
          lastAttemptAt: new Date().toISOString(),
          lastError: err.message,
        });
      }
    }
  },
);
```

한 계정의 실패가 전체를 멈추지 않는다. 실패 경로는 `lastEpochSeconds`를 쓰지 않으므로 미처리 페이지를 건너뛰지 않는다. 토큰 하나가 깨져도 나머지 여섯이 계속 돈다.

- [ ] **Step 2: 배포 전 마지막 확인**

```bash
firebase functions:list --project medidakos
```

출력에 `ingestGmail`이 **없어야 한다.** 있으면 누가 이미 배포한 것이니 멈추고 확인한다.

- [ ] **Step 3: 사용자 승인을 받고 배포**

배포는 덮어쓰기다. **사용자에게 확인받고 실행한다.**

```bash
firebase deploy --only functions:ingest --project medidakos
```

`--only functions:ingest`가 코드베이스 이름이다. `functions/`는 건드리지 않는다.

- [ ] **Step 4: 실제로 뭐가 올라갔는지 대조**

명령의 자체 보고를 믿지 않는다.

```bash
firebase functions:list --project medidakos
```

| 확인              | 기대                     |
| ----------------- | ------------------------ |
| `ingestGmail`   | 있다.`asia-northeast3` |
| `lifecycleScan` | **여전히 없다**    |
| 기존 넷           | 그대로                   |

**`lifecycleScan`이 생겼으면 코드베이스 분리가 안 먹은 것이다.** 즉시 보고한다.

- [ ] **Step 5: 파라미터 설정과 첫 실행**

```bash
firebase functions:config:set --project medidakos   # v2 는 params 를 배포 시 물어본다
```

`INGEST_MAILBOXES`에 `thomas@medidakoslabs.com` **하나만** 넣는다. 나머지 여섯은 계획 7이다.

5분 기다린 뒤:

```bash
npm --prefix functions-ingest run logs
```

- [ ] **Step 6: Firestore에서 눈으로 확인**

Firebase 콘솔 → Firestore → `messages`

| 확인                                     | 기대                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| 문서 ID                                  | `gmail_thomas:18f0abc` 형태                                                           |
| `bodyText`                             | 실제 본문이 들어 있다                                                                   |
| `side`                                 | `brand`                                                                               |
| `sideSource`                           | `account_rule`                                                                        |
| `threadKey`                            | `gmail_thomas:thomas@medidakoslabs.com:{providerThreadId}`                            |
| `direction`                            | 받은 건`in`, 보낸 건 `out`                                                          |
| `threads/{threadKey}`                  | 원문과 별도로`readState`·`triageState`·`linkState`가 있다                       |
| `ingestState/thomas@medidakoslabs.com` | `lastEpochSeconds`·`lastSuccessAt`·`processedCount`가 있고 `lastError`는 null |

10분 더 기다린 뒤 다시 본다. **문서 수가 폭증하면 결정적 ID가 안 먹는 것이다.**

- [ ] **Step 7: 스파이크 스크립트 삭제와 커밋**

```bash
rm -f scripts/spike-gmail.js
git add functions-ingest/index.js
git commit -m "feat(ingest): thomas@ 메일함 5분 주기 수집"
git push -u origin feat/ingest-spike
gh pr create --base dev --title "feat(ingest): 수집기 관통 — thomas@ 단독" --body "스펙 docs/backoffice-spec.md 3장·6장 / 작업 순서 5"
```

---

## 이 계획이 답해야 하는 것

PR 본문에 아래를 적는다. **계획 4·6이 이 답을 읽는다.**

- 도메인 전체 위임이 동작했는가 / 막혔다면 무엇에
- Gmail 응답 구조에서 예상과 달랐던 것
- 5분 주기가 적절한가 — 한 번에 몇 통이 들어오는가
- 두 페이지 이상인 조회에서 전 페이지가 저장되고 성공 뒤 cursor가 전진했는가
- 정상 0건과 실패가 `ingestState`에서 구분되는가
- 첨부가 실제로 얼마나 자주 오는가 (계획 6의 첨부 제외 결정에 영향)

## 다음 계획으로 넘기는 것

- 나머지 여섯 메일함 + Outlook + 채널톡 → 계획 7 (스펙 9장)
- 받은편지함 화면 → 계획 4
- 발신자를 바이어·제조사에 자동 연결 → 계획 4. `findBuyerByEmail()`은 계획 2에서 이미 만들었다
- 파싱 → 계획 6
