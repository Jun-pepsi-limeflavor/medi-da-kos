// 쿠키 동의 상태(선택 쿠키 3종: Analytics·Marketing·Functional) 저장·조회. 필수 쿠키는 항상 허용이라 저장하지 않는다.
// - 확정 정책(2026-11-06): 동의·거부 기록 6개월 보관 → 만료 시 재동의, 쿠키 목적·정책의 중요한 변경(POLICY_VERSION 변경) 시 재동의
// - 저장값: 정책 버전 · 카테고리별 선택 · 저장 시각 · 만료 시각만(개인정보·식별자 없음), localStorage 'mdk:cookie-consent'
// - 화면·스크립트는 useCookieConsent()/hasCookieConsent()로 읽는다. 유효한 기록이 없으면 null = 아직 선택 전(선택 쿠키 불허)
// - 같은 탭의 변경은 즉시, 다른 탭의 변경은 storage 이벤트로 반영
// - 실제 GA4·Meta Pixel·Channel Talk 실행 제어(동의 전 차단)는 운영 연동 단계에서 이 상태를 읽어 적용한다(아직 연결하지 않음)
import { useSyncExternalStore } from "react";

export type OptionalCookieCategory = "analytics" | "marketing" | "functional";
export type CookieChoices = Record<OptionalCookieCategory, boolean>;

export type CookieConsent = CookieChoices & {
  version: number;
  /** ISO time the choice was saved. */
  savedAt: string;
  /** ISO time after which the visitor is asked again (6 months after savedAt). */
  expiresAt: string;
};

/** Bump when the cookie purposes or policy change materially: every stored choice becomes invalid. */
export const POLICY_VERSION = 1;
export const CONSENT_STORAGE_KEY = "mdk:cookie-consent";
export const CONSENT_RETENTION_MONTHS = 6;

export const OPTIONAL_COOKIE_CATEGORIES: readonly OptionalCookieCategory[] = ["analytics", "marketing", "functional"];
export const ALL_REJECTED: CookieChoices = { analytics: false, marketing: false, functional: false };
export const ALL_ACCEPTED: CookieChoices = { analytics: true, marketing: true, functional: true };

/** Same calendar day 6 months later (clamped to the month's last day, e.g. Aug 31 → Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function createConsent(choices: CookieChoices, now: Date = new Date()): CookieConsent {
  return {
    version: POLICY_VERSION,
    analytics: choices.analytics,
    marketing: choices.marketing,
    functional: choices.functional,
    savedAt: now.toISOString(),
    expiresAt: addMonths(now, CONSENT_RETENTION_MONTHS).toISOString(),
  };
}

/** The stored record if it is well-formed, for the current policy version and not expired; otherwise null. */
export function parseConsent(raw: string | null, now: number = Date.now()): CookieConsent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CookieConsent>;
    if (value.version !== POLICY_VERSION) return null;
    if (!OPTIONAL_COOKIE_CATEGORIES.every((key) => typeof value[key] === "boolean")) return null;
    const expires = Date.parse(String(value.expiresAt));
    if (!Number.isFinite(expires) || expires <= now || !Number.isFinite(Date.parse(String(value.savedAt)))) return null;
    return value as CookieConsent;
  } catch {
    return null;
  }
}

// ---------- Store (browser only) ----------

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: CookieConsent | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Current valid consent, or null when the visitor has not chosen yet (or the choice expired / is outdated). */
export function readConsent(): CookieConsent | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseConsent(raw);
  }
  // Expiry can pass while the page stays open.
  if (cachedValue && Date.parse(cachedValue.expiresAt) <= Date.now()) cachedValue = null;
  return cachedValue;
}

export function saveConsent(choices: CookieChoices): CookieConsent {
  const consent = createConsent(choices);
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Storage blocked: the choice applies to this page only and the banner returns on the next load.
    cachedRaw = JSON.stringify(consent);
    cachedValue = consent;
  }
  listeners.forEach((listener) => listener());
  return consent;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * undefined while rendering on the server / before hydration (unknown — render no consent UI yet),
 * null when no valid choice exists, otherwise the saved consent.
 */
export function useCookieConsent(): CookieConsent | null | undefined {
  return useSyncExternalStore(subscribe, readConsent, () => undefined);
}

/** For scripts that must wait for consent (GA4 → analytics, Meta Pixel → marketing, optional chat storage → functional). */
export function hasCookieConsent(category: OptionalCookieCategory): boolean {
  return readConsent()?.[category] === true;
}
