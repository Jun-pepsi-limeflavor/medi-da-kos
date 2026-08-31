"use client";

import type { CMBrief, Order, TrackingEntry, UserProfile } from "./types";

const USERS_KEY = "mdk_users";
const SESSION_KEY = "mdk_session";
const BRIEFS_KEY = "mdk_cm_briefs";
const TRACKING_KEY = "mdk_tracking";
const ORDERS_KEY = "mdk_orders";

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
  if (users[email]) throw new Error("An account with this email already exists.");
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
    throw new Error("Invalid email or password.");
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

export function mockSaveBrief(brief: CMBrief) {
  const all = read<Record<string, CMBrief>>(BRIEFS_KEY, {});
  all[brief.uid] = brief;
  write(BRIEFS_KEY, all);
}

export function mockGetBrief(uid: string): CMBrief | null {
  const all = read<Record<string, CMBrief>>(BRIEFS_KEY, {});
  return all[uid] ?? null;
}

export function mockSaveTracking(uid: string, entries: TrackingEntry[]) {
  const all = read<Record<string, TrackingEntry[]>>(TRACKING_KEY, {});
  all[uid] = entries;
  write(TRACKING_KEY, all);
}

export function mockGetTracking(uid: string): TrackingEntry[] {
  const all = read<Record<string, TrackingEntry[]>>(TRACKING_KEY, {});
  return all[uid] ?? [];
}

export function mockAddOrder(order: Order): Order {
  const all = read<Order[]>(ORDERS_KEY, []);
  const entry: Order = {
    ...order,
    id: order.id || `order-${crypto.randomUUID()}`,
  };
  all.push(entry);
  write(ORDERS_KEY, all);
  return entry;
}

export function mockGetOrders(uid: string): Order[] {
  const all = read<Order[]>(ORDERS_KEY, []);
  return all
    .filter((o) => o.uid === uid)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
