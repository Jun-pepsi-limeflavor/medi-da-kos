// Google Consent Mode v2 신호(Basic 방식). GA4 태그는 Analytics 동의 후에만 로드하고(GoogleAnalytics),
// 로드할 때 기본값을 모두 denied로 둔 뒤 현재 선택으로 update한다.
// - analytics_storage ← Analytics 동의
// - ad_storage·ad_user_data·ad_personalization ← Marketing 동의(GPC면 항상 denied, consent.ts effectiveChoices)
import type { CookieChoices } from "@/lib/cookie-consent/consent";

export type GoogleConsentValue = "granted" | "denied";
export type GoogleConsentState = {
  analytics_storage: GoogleConsentValue;
  ad_storage: GoogleConsentValue;
  ad_user_data: GoogleConsentValue;
  ad_personalization: GoogleConsentValue;
};

export const GOOGLE_CONSENT_DEFAULT: GoogleConsentState = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

export function googleConsentState(choices: CookieChoices): GoogleConsentState {
  const ads: GoogleConsentValue = choices.marketing ? "granted" : "denied";
  return {
    analytics_storage: choices.analytics ? "granted" : "denied",
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
  };
}
