import { isNonProductionEnv } from "./env-flags";

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

export type EmailLinkLocation = "contact" | "footer";

/** 이메일 주소 클릭. 위치는 이벤트 이름이 아니라 `link_location`으로 나눈다. */
export function trackEmailClick(location: EmailLinkLocation, email: string) {
  trackConversionEvent("email_click", {
    link_location: location,
    link_url: `mailto:${email}`,
  });
}

/** 사용자가 주소를 직접 선택해 복사한 것. 우클릭·길게 누르기 메뉴 복사는 잡히지 않는다. */
export function trackEmailCopy(location: EmailLinkLocation) {
  trackConversionEvent("email_copy", { link_location: location, method: "manual" });
}

/** GA4 event when the CM Wizard step changes (saved/navigated step, not field edits). */
export function trackBriefStep(step: number, stepLabel: string) {
  trackConversionEvent("brief_step_changed", {
    brief_step: step,
    brief_step_label: stepLabel,
  });
}
