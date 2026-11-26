// 쿠키 동의 상태(선택 카테고리 2종: Analytics·Marketing) 저장·조회. 필수(Essential)는 항상 허용이라 저장하지 않는다.
// - 확정 정책(2026-11-06): 동의·거부 기록 6개월 보관 → 만료 시 재동의, 쿠키 목적·정책의 중요한 변경(POLICY_VERSION 변경) 시 재동의
// - 저장값: 정책 버전 · Consent ID · 카테고리별 선택 · 서버 확인된 선택(confirmed) · 저장 시각 · 만료 시각, localStorage 'mdk:cookie-consent'
//   (Consent ID = 브라우저별 무작위 UUID, 첫 선택 때 생성. UID·이메일·GA client id와 연결하지 않는다)
// - 서버 증빙(P2, consent-sync.ts): 선택을 늘린 항목은 서버 기록이 확인된 뒤(confirmed)에만 실행되고,
//   줄인 항목은 저장 즉시 멈춘다. 실행 여부 = 선택 && confirmed (Marketing은 GPC면 항상 꺼짐)
// - 화면·스크립트는 useCookieConsent()/hasCookieConsent()로 읽는다. 유효한 기록이 없으면 null = 아직 선택 전(선택 쿠키 불허)
// - GPC(Global Privacy Control) 신호가 켜진 브라우저는 저장값과 관계없이 Marketing을 거부로 본다(신호 우선, 2026-11-23)
// - 정책 버전 2(2026-11-23): Functional 카테고리 제거, GA4·Meta·Channel Talk 추적을 실제로 동의에 연결 → 버전 1 기록은 무효(재동의)
// - 같은 탭의 변경은 즉시, 다른 탭의 변경은 storage 이벤트로 반영
// - 실행 제어: GA4(GoogleAnalytics)·Meta Pixel(MetaPixel)·Channel Talk 추적 옵션·Contact 분석 정보가 이 상태를 읽고,
//   축소·철회 정리는 ConsentEnforcer가 맡는다
import { useSyncExternalStore } from "react";
import { addMonths, CONSENT_RETENTION_MONTHS, isUuidV4, POLICY_VERSION } from "@/lib/cookie-consent/policy";

export { addMonths, CONSENT_RETENTION_MONTHS, isUuidV4, POLICY_VERSION };

export type OptionalCookieCategory = "analytics" | "marketing";
export type CookieChoices = Record<OptionalCookieCategory, boolean>;

export type CookieConsent = CookieChoices & {
  version: number;
  /** Random per-browser UUID, created at the first choice and kept while this record (even expired) exists. */
  consentId: string;
  /** Choices the server has recorded (granting waits for it; narrowing applies at once). */
  confirmed: CookieChoices;
  /** ISO time the choice was saved. */
  savedAt: string;
  /** ISO time after which the visitor is asked again (6 months after savedAt). */
  expiresAt: string;
};

export const CONSENT_STORAGE_KEY = "mdk:cookie-consent";

export const OPTIONAL_COOKIE_CATEGORIES: readonly OptionalCookieCategory[] = ["analytics", "marketing"];
export const ALL_REJECTED: CookieChoices = { analytics: false, marketing: false };
export const ALL_ACCEPTED: CookieChoices = { analytics: true, marketing: true };

export function createConsent(
  choices: CookieChoices,
  now: Date,
  ids: { consentId: string; confirmed: CookieChoices },
): CookieConsent {
  return {
    version: POLICY_VERSION,
    consentId: ids.consentId,
    analytics: choices.analytics,
    marketing: choices.marketing,
    confirmed: { analytics: ids.confirmed.analytics, marketing: ids.confirmed.marketing },
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
    if (!isUuidV4(value.consentId)) return null;
    if (!value.confirmed || !OPTIONAL_COOKIE_CATEGORIES.every((key) => typeof value.confirmed?.[key] === "boolean")) return null;
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

/** Consent ID left in storage by an earlier (possibly expired or outdated) record, so re-consent keeps the same ID. */
export function readPreviousConsentId(): string | null {
  try {
    const value = JSON.parse(readRaw() ?? "null") as { consentId?: unknown } | null;
    return isUuidV4(value?.consentId) ? value.consentId : null;
  } catch {
    return null;
  }
}

/** Stores the record and notifies this tab (other tabs get a storage event). Choices are written by consent-sync.ts. */
export function writeConsent(consent: CookieConsent): CookieConsent {
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

// ---------- Effective consent (what scripts may actually do) ----------

/** Browser Global Privacy Control signal (navigator.globalPrivacyControl). */
export function isGpcEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/**
 * Saved choice → what may run: chosen AND confirmed by the server record. No valid choice = nothing optional.
 * GPC always wins over Marketing.
 */
export function effectiveChoices(consent: CookieConsent | null | undefined, gpc: boolean): CookieChoices {
  return {
    analytics: consent?.analytics === true && consent.confirmed?.analytics === true,
    marketing: consent?.marketing === true && consent.confirmed?.marketing === true && !gpc,
  };
}

/** GPC forces Marketing off before saving, so the stored record matches what actually runs. */
export function applyGpc(choices: CookieChoices, gpc: boolean): CookieChoices {
  return gpc ? { ...choices, marketing: false } : choices;
}

/**
 * undefined before hydration (unknown — load nothing yet), otherwise the effective choices.
 * For GA4 (analytics), Meta Pixel (marketing) and Channel Talk tracking options (marketing).
 */
export function useEffectiveConsent(): CookieChoices | undefined {
  const consent = useCookieConsent();
  return consent === undefined ? undefined : effectiveChoices(consent, isGpcEnabled());
}

/** Non-React read for code that runs on demand (Contact submit, Channel Talk boot). */
export function hasCookieConsent(category: OptionalCookieCategory): boolean {
  return effectiveChoices(readConsent(), isGpcEnabled())[category];
}
