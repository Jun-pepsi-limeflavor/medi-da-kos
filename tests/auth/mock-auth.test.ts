// Mock 인증 회귀 테스트: 명시적 Mock 모드, Mock 가입·로그인·로그아웃·세션 복원, 미리 만든 관리자 계정 없음,
// mdk_users·mdk_session 정리, 소스에 하드코딩된 자격 증명 없음, predev의 Firebase 설정 누락 차단.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

register("../esm-alias-loader.mjs", import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()].sort();
  }
}

// mock-auth.ts reads `window` and the global `localStorage` like it does in the browser.
const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });

const mock = await import("../../src/lib/auth/mock-auth.ts");
// useMockAuth is a plain env check, not a React hook: aliased so the hooks lint rule does not misfire.
const { useMockAuth: isMockAuth } = await import("../../src/lib/firebase/client.ts");

const profile = { displayName: "Dev", phone: "", country: "", companyName: "", role: "user" as const };
const LEGACY_ADMIN = { uid: "mock-admin-uid", email: "legacy-admin@example.test", role: "admin" };

function reset() {
  for (const key of storage.keys()) storage.removeItem(key);
}

test("useMockAuth: only NEXT_PUBLIC_USE_MOCK_AUTH=true enables mock, unset/false/other stay on Firebase", () => {
  const original = process.env.NEXT_PUBLIC_USE_MOCK_AUTH;
  try {
    for (const [value, expected] of [["true", true], ["false", false], [undefined, false], ["", false], ["TRUE", false], ["1", false]] as const) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_USE_MOCK_AUTH;
      else process.env.NEXT_PUBLIC_USE_MOCK_AUTH = value;
      assert.equal(isMockAuth(), expected, `value=${String(value)}`);
    }
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_USE_MOCK_AUTH;
    else process.env.NEXT_PUBLIC_USE_MOCK_AUTH = original;
  }
});

test("mock register → logout → login → session restore, with no pre-made admin account", () => {
  reset();
  const created = mock.mockRegister("dev@example.test", "dev-pass-123", profile);
  assert.equal(created.role, "user");
  assert.equal(mock.mockGetSession()?.email, "dev@example.test");

  const users = JSON.parse(storage.getItem("mdk_users")!);
  assert.deepEqual(Object.keys(users), ["dev@example.test"], "only the registered user, no seeded admin");
  assert.ok(Object.values(users).every((u) => (u as { role: string }).role !== "admin"));

  assert.throws(() => mock.mockRegister("dev@example.test", "other", profile), { code: "auth/email-already-in-use" });

  mock.mockLogout();
  assert.equal(mock.mockGetSession(), null);
  assert.equal(storage.getItem("mdk_users") !== null, true, "mock users survive logout");

  assert.throws(() => mock.mockLogin("dev@example.test", "wrong"), { code: "auth/invalid-credential" });
  const loggedIn = mock.mockLogin("dev@example.test", "dev-pass-123");
  assert.equal(loggedIn.uid, created.uid);
  assert.equal("password" in loggedIn, false, "session never carries the password");
  assert.equal(mock.mockGetSession()?.uid, created.uid, "session is restored from storage (reload)");
});

test("mock Google sign-in still works", () => {
  reset();
  const user = mock.mockGoogleSignIn();
  assert.equal(user.provider, "google");
  assert.equal(mock.mockGetSession()?.uid, user.uid);
});

test("mock-auth exports no seeded admin", () => {
  assert.equal("MOCK_ADMIN" in mock, false);
  assert.equal("seedMockAdmin" in mock, false);
});

test("cleanup in Firebase mode removes mdk_users and mdk_session only", () => {
  const s = new MemoryStorage();
  s.setItem("mdk_users", JSON.stringify({ [LEGACY_ADMIN.email]: LEGACY_ADMIN }));
  s.setItem("mdk_session", JSON.stringify(LEGACY_ADMIN));
  s.setItem("firebase:authUser:key:[DEFAULT]", "{}");
  s.setItem("mdk_cookie_consent", "{}");
  mock.cleanupMockStorage(s, false);
  assert.deepEqual(s.keys(), ["firebase:authUser:key:[DEFAULT]", "mdk_cookie_consent"]);
});

test("cleanup in mock mode removes only the legacy seeded admin and its session", () => {
  const s = new MemoryStorage();
  const dev = { uid: "mock-1", email: "dev@example.test", role: "user" };
  s.setItem("mdk_users", JSON.stringify({ [LEGACY_ADMIN.email]: LEGACY_ADMIN, [dev.email]: dev }));
  s.setItem("mdk_session", JSON.stringify(LEGACY_ADMIN));
  mock.cleanupMockStorage(s, true);
  assert.deepEqual(JSON.parse(s.getItem("mdk_users")!), { [dev.email]: dev });
  assert.equal(s.getItem("mdk_session"), null);

  s.setItem("mdk_session", JSON.stringify(dev));
  mock.cleanupMockStorage(s, true);
  assert.equal(JSON.parse(s.getItem("mdk_session")!).uid, dev.uid, "a developer's mock session is kept");
});

test("cleanup never throws on blocked storage or malformed values", () => {
  const blocked = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.doesNotThrow(() => mock.cleanupMockStorage(blocked, false));
  assert.doesNotThrow(() => mock.cleanupMockStorage(blocked, true));
  const s = new MemoryStorage();
  s.setItem("mdk_users", "{not json");
  assert.doesNotThrow(() => mock.cleanupMockStorage(s, true));
  assert.equal(s.getItem("mdk_users"), "{not json");
});

test("no hardcoded credential in client source", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, "src"));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.doesNotMatch(text, /\bMOCK_ADMIN\b|\bseedMockAdmin\b/, rel);
    assert.doesNotMatch(text, /admin@medidakos\.com/, rel);
    // A non-empty string literal assigned to a `password` field (validation messages are keyed differently).
    assert.doesNotMatch(text, /\bpassword\s*:\s*(["'`])(?!Password must)[^"'`]+\1/, rel);
  }
});

function runPredev(env: Record<string, string>) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "predev-")); // no .env files here
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("NEXT_PUBLIC_")));
  return spawnSync(process.execPath, [path.join(ROOT, "scripts/check-dev-firebase.mjs")], {
    cwd,
    env: { ...clean, ...env },
    encoding: "utf8",
  });
}

test("predev: no Firebase config and no mock flag stops the dev server (no mock fallback)", () => {
  assert.equal(runPredev({}).status, 1);
  assert.equal(runPredev({ NEXT_PUBLIC_USE_MOCK_AUTH: "false" }).status, 1);
});

test("predev: explicit mock mode starts without Firebase config", () => {
  const result = runPredev({ NEXT_PUBLIC_USE_MOCK_AUTH: "true" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mock/);
});

test("predev: dev Firebase config starts, production project is blocked", () => {
  const base = { NEXT_PUBLIC_FIREBASE_API_KEY: "k", NEXT_PUBLIC_FIREBASE_APP_ID: "a" };
  assert.equal(runPredev({ ...base, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "dev-medidakos-b9b4f" }).status, 0);
  assert.equal(runPredev({ ...base, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "medidakos" }).status, 1);
});
