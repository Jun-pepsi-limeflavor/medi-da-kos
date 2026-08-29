import { isNonProductionEnv } from "./env-flags";
import type { LandingVariant } from "./landing/types";

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

/** GA4 event when the CM Wizard step changes (saved/navigated step, not field edits). */
export function trackBriefStep(step: number, stepLabel: string) {
  trackConversionEvent("brief_step_changed", {
    brief_step: step,
    brief_step_label: stepLabel,
  });
}

/**
 * 개인정보가 절대 GA4로 나가지 않게 거르는 신뢰 경계.
 * landing/analytics.ts에서 그대로 옮겼다 — 간소화 대상이 아니다.
 */
const privateKeys = new Set([
  "companyName",
  "contactName",
  "email",
  "message",
  "pageUrl",
  "gaClientId",
  "userAgent",
]);

/** 모든 랜딩 이벤트의 단일 진입점. is_test·landing_variant를 전역으로 붙인다. */
export function trackLandingEvent(
  name: string,
  variant: LandingVariant,
  params: Record<string, unknown> = {},
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const safe = Object.fromEntries(
    Object.entries(params).filter(([key]) => !privateKeys.has(key)),
  );
  window.gtag("event", name, {
    ...safe,
    landing_variant: variant,
    is_test: isNonProductionEnv(),
  });
}
