import type { LandingRequestContext } from "./types";

/** catalog·dashboard가 공유하는 상담 폼. korea는 `coldmail-landing`을 그대로 쓴다. */
export const LANDING_CONSULTATION_FORM_ID = "landing-consultation";

/**
 * catalog·dashboard 상담 제출의 `generate_lead` 파라미터.
 *
 * korea `generate_lead`와 같은 UTM 4개만 싣는다. `utm_term`(대상 회사)은 Firestore에만 둔다.
 * 랜딩 구분은 `trackLandingEvent`의 `landing_variant`(경로)가 하고 `utm_content`는 손대지 않는다.
 */
export function consultationLeadParams(expectedVolume: string, attribution: LandingRequestContext) {
  return {
    form_id: LANDING_CONSULTATION_FORM_ID,
    lead_type: "consultation",
    expected_volume: expectedVolume,
    utm_source: attribution.utmSource,
    utm_medium: attribution.utmMedium,
    utm_campaign: attribution.utmCampaign,
    utm_content: attribution.utmContent,
  };
}
