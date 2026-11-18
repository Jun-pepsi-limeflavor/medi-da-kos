import { isNonProductionEnv } from "@/lib/utils/env-flags";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";
import type { UtmParams } from "@/hooks/use-utm-params";

/**
 * 모든 GA4 이벤트에 `is_test`를 붙인다.
 *
 * 이벤트마다 붙이지 않고 여기 한 곳에 두는 이유: 빠뜨린 이벤트 하나가
 * 보고서 전체를 오염시킨다. 2026-08-03 문의 폼 제출 3건이 전부 내부 테스트였는데
 * 구분 수단이 없어 리드 3건으로 읽혔다.
 */
export function trackConversionEvent(
  conversionEvent: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", conversionEvent, {
    ...params,
    is_test: isNonProductionEnv(),
  });
}

/**
 * Contact conversion events of the previous production form, unchanged (GA4 key event / Google Ads):
 * generate_lead with form_id · lead_type · UTM, and Meta Lead. Sent only when the inquiry was really saved to
 * Firestore (`saved: true`) — never for a mock submission. Tracking errors never reach the caller.
 */
export function trackContactLead(result: { saved: boolean }, utm: UtmParams) {
  if (result.saved !== true) return;
  try {
    trackConversionEvent("generate_lead", {
      form_id: "contact-page",
      lead_type: "inquiry",
      utm_source: utm.utmSource,
      utm_medium: utm.utmMedium,
      utm_campaign: utm.utmCampaign,
    });
    trackMetaEvent("Lead", { content_name: "contact-page" });
  } catch (error) {
    console.error("contact lead tracking failed", error);
  }
}

/** `about`·`privacy-policy`·`terms-of-service`: renewal emails (2026-11-13). Same events, new location values only. */
export type EmailLinkLocation = "contact" | "footer" | "about" | "privacy-policy" | "terms-of-service";

/** 이메일 주소 클릭. 위치는 이벤트 이름이 아니라 `link_location`으로 나눈다. */
export function trackEmailClick(location: EmailLinkLocation, email: string) {
  trackConversionEvent("email_click", {
    link_location: location,
    link_url: `mailto:${email}`,
  });
  trackMetaEvent("Contact", { content_name: location });
}

/** 사용자가 주소를 직접 선택해 복사한 것. 우클릭·길게 누르기 메뉴 복사는 잡히지 않는다. */
export function trackEmailCopy(location: EmailLinkLocation) {
  trackConversionEvent("email_copy", { link_location: location, method: "manual" });
}
