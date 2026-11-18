"use client";

// 로컬 개발용 Mock 인증. Mock 모드에서 Firebase Auth 대신 사용한다.
// - 사용자·세션을 localStorage에 저장하고 Mock 관리자 계정을 준비
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

export const MOCK_ADMIN = {
  email: "admin@medidakos.com",
  password: "MediDaKos2024!",
  profile: {
    uid: "mock-admin-uid",
    email: "admin@medidakos.com",
    displayName: "Admin User",
    phone: "+82-10-0000-0000",
    country: "South Korea",
    companyName: "Medi Da Kos",
    provider: "email" as const,
    role: "admin" as const,
    createdAt: new Date().toISOString(),
  } satisfies UserProfile,
};

export function seedMockAdmin() {
  const users = read<Record<string, UserProfile & { password?: string }>>(
    USERS_KEY,
    {},
  );
  if (!users[MOCK_ADMIN.email]) {
    users[MOCK_ADMIN.email] = {
      ...MOCK_ADMIN.profile,
      password: MOCK_ADMIN.password,
    };
    write(USERS_KEY, users);
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
  seedMockAdmin();
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
  seedMockAdmin();
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
