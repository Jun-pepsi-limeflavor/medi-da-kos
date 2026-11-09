// 연말 프로모션(2026) 설정.
// - 프로모션 코드·종료 시각(KST)·Contact 링크
// - 현재 시각 기준 진행 여부 판정
import { ROUTES } from "@/lib/config/routes";

/**
 * Year-end 2026 promotion (Figma: Announcement Bar, Promotion Popup, Contact Promo Notice).
 * Figma: stop rendering after 2026-12-31 23:59; the time zone is TBD in the annotations.
 * KST is used because the visible Offer terms on Contact state "December 31, 2026 (KST)".
 */
export const YEAR_END_PROMO = {
  code: "year-end-2026",
  /** First instant after 2026-12-31 23:59 KST. */
  endsAt: Date.parse("2027-01-01T00:00:00+09:00"),
  contactHref: `${ROUTES.contact}?promo=year-end-2026`,
} as const;

export function isYearEndPromoActive(now: number = Date.now()): boolean {
  return now < YEAR_END_PROMO.endsAt;
}
