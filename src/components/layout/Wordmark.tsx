// 텍스트 로고 "Medidakos".
// - Navbar용·Footer용 두 가지 크기(Figma 값 그대로)
// - Footer용은 가장 가까운 @container(Footer 본문, 좌우 여백·스크롤바 제외 폭) 기준으로 줄어든다 —
//   이전 100vw 기준 식은 xl(1280px~)의 120px 여백과 클래식 스크롤바를 빼지 않아 1280~1300px에서 최대 34px 넘쳤다
import { cx } from "@/lib/utils/cx";

/**
 * Text wordmark "Medidakos" (Figma: Instrument Sans SemiBold, charcoal). Sizes are the exact Figma values.
 * navbar: 25.302px / 21.15px / -4% (Navbar › Wordmark · Medidakos)
 * footer: 256px / 214px / -6% (Footer › Wordmark (large)); shrinks only when its container (the Footer content
 *         box, already excluding side padding and any classic scrollbar) is narrower than 4.67 × 256px, so it never
 *         overflows. Text width is about 4.61 × font size.
 */
const sizes = {
  navbar: "text-[25.302px] leading-[21.15px] tracking-[-0.04em]",
  footer:
    "text-[min(256px,calc(100cqw/4.67))] leading-[0.8359] tracking-[-0.06em]",
} as const;

export function Wordmark({ size, className }: { size: keyof typeof sizes; className?: string }) {
  return (
    <span className={cx("font-mdk block font-semibold whitespace-nowrap text-mdk-charcoal", sizes[size], className)}>
      Medidakos
    </span>
  );
}
