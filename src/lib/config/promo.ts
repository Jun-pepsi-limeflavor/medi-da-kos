// 연말 프로모션(2026) 설정.
// - 프로모션 코드·종료 시각(KST). 프로모션 문의도 일반 /contact로 연결(전용 URL 없음, 2026-11-10 확정)
// - 현재 시각 기준 진행 여부 판정
// - Announcement Bar 닫힘·클릭 상태 sessionStorage 키(닫힘은 프로모션 코드별) — 쿠키 동의 보관(6개월)과 별개
/**
 * Year-end 2026 promotion (Figma: Announcement Bar, Promotion Popup, Contact Promo Notice).
 * Figma: stop rendering after 2026-12-31 23:59; the time zone is TBD in the annotations.
 * KST is used because the visible Offer terms on Contact state "December 31, 2026 (KST)".
 */
export const YEAR_END_PROMO = {
  code: "year-end-2026",
  /** First instant after 2026-12-31 23:59 KST. */
  endsAt: Date.parse("2027-01-01T00:00:00+09:00"),
} as const;

/**
 * sessionStorage key for "Announcement Bar dismissed in this tab". Includes the promo code,
 * so a new promotion shows its bar again even in a tab that dismissed the previous one.
 */
export const ANNOUNCEMENT_DISMISSED_KEY = `mdk:announcement-dismissed:${YEAR_END_PROMO.code}`;

/** sessionStorage flag: the Announcement Bar was clicked in this session, so the Promotion Popup does not auto-open. */
export const PROMO_BAR_CLICKED_KEY = "mdk:promo-bar-clicked";

/** <html> attribute set before first paint when the bar is dismissed (no flash or layout shift). */
export const ANNOUNCEMENT_DISMISSED_ATTR = "data-announcement-dismissed";

export function isYearEndPromoActive(now: number = Date.now()): boolean {
  return now < YEAR_END_PROMO.endsAt;
}
