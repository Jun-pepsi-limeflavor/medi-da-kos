"use client";

// 로컬 개발용 Mock 인증. Mock 모드에서 Firebase Auth 대신 사용한다.
// - NEXT_PUBLIC_USE_MOCK_AUTH=true일 때만 사용. 사용자·세션을 localStorage에 저장(미리 만든 계정·자격 증명 없음, /signup으로 생성)
// - 오류에 Firebase와 같은 code를 붙여 같은 문구로 변환되게 함
import type { UserProfile } from "@/lib/types";

const USERS_KEY = "mdk_users";
const SESSION_KEY = "mdk_session";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/** uid of the Mock admin entry older builds seeded into every browser. No credential is kept in code. */
const LEGACY_SEEDED_ADMIN_UID = "mock-admin-uid";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Mock 전용 localStorage 정리 (2026-11 Mock 관리자 자동 생성 제거 후속, V2.1 이후 제거 검토).
 * - Firebase 모드: mdk_users·mdk_session 삭제. Mock 인증만 쓰는 키이며, 예전 코드가 모든 방문자에게 mdk_users를 만들었다.
 * - Mock 모드: 예전에 자동 생성된 관리자 항목과 그 세션만 삭제하고, 개발자가 만든 Mock 계정·세션은 유지한다.
 * Firebase Auth 저장소는 건드리지 않는다. 저장소 접근 실패·손상된 값은 그대로 둔다.
 */
export function cleanupMockStorage(storage: StorageLike, mockMode: boolean): void {
  try {
    if (!mockMode) {
      storage.removeItem(USERS_KEY);
      storage.removeItem(SESSION_KEY);
      return;
    }
    const users = JSON.parse(storage.getItem(USERS_KEY) ?? "null") as Record<string, { uid?: string }> | null;
    if (users && typeof users === "object") {
      const kept = Object.fromEntries(Object.entries(users).filter(([, u]) => u?.uid !== LEGACY_SEEDED_ADMIN_UID));
      if (Object.keys(kept).length !== Object.keys(users).length) storage.setItem(USERS_KEY, JSON.stringify(kept));
    }
    const session = JSON.parse(storage.getItem(SESSION_KEY) ?? "null") as { uid?: string } | null;
    if (session?.uid === LEGACY_SEEDED_ADMIN_UID) storage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked or malformed JSON: leave it as is.
  }
}

export function mockGetSession(): UserProfile | null {
  return read<UserProfile | null>(SESSION_KEY, null);
}

export function mockSetSession(user: UserProfile | null) {
  if (user) write(SESSION_KEY, user);
  else localStorage.removeItem(SESSION_KEY);
}

/** Mock errors carry the same `code` Firebase would return, so the UI maps both the same way. */
function mockAuthError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

export function mockRegister(
  email: string,
  password: string,
  profile: Omit<UserProfile, "uid" | "email" | "createdAt" | "provider">,
): UserProfile {
  const users = read<Record<string, UserProfile & { password?: string }>>(
    USERS_KEY,
    {},
  );
  if (users[email]) throw mockAuthError("auth/email-already-in-use", "An account with this email already exists.");
  const user: UserProfile = {
    uid: `mock-${crypto.randomUUID()}`,
    email,
    provider: "email",
    role: "user",
    createdAt: new Date().toISOString(),
    ...profile,
  };
  users[email] = { ...user, password };
  write(USERS_KEY, users);
  mockSetSession(user);
  return user;
}

export function mockLogin(email: string, password: string): UserProfile {
  const users = read<Record<string, UserProfile & { password?: string }>>(
    USERS_KEY,
    {},
  );
  const record = users[email];
  if (!record || record.password !== password) {
    throw mockAuthError("auth/invalid-credential", "Invalid email or password.");
  }
  const { password: _, ...user } = record;
  mockSetSession(user);
  return user;
}

export function mockGoogleSignIn(): UserProfile {
  const user: UserProfile = {
    uid: `mock-google-${crypto.randomUUID()}`,
    email: "demo.google@medidakos.com",
    displayName: "Google Demo User",
    phone: "",
    country: "United States",
    companyName: "Demo Brand Co.",
    provider: "google",
    role: "user",
    createdAt: new Date().toISOString(),
  };
  mockSetSession(user);
  return user;
}

export function mockLogout() {
  mockSetSession(null);
}
