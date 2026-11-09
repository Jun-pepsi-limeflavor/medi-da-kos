// 텍스트 로고 "Medidakos".
// - Navbar용·Footer용 두 가지 크기(Figma 값 그대로)
import { cx } from "@/lib/utils/cx";

/**
 * Text wordmark "Medidakos" (Figma: Instrument Sans SemiBold, charcoal). Sizes are the exact Figma values.
 * navbar: 25.302px / 21.15px / -4% (Navbar › Wordmark · Medidakos)
 * footer: 256px / 214px / -6% (Footer › Wordmark (large)); shrinks only when the viewport is
 *         narrower than the 1440 design, so it never overflows.
 */
const sizes = {
  navbar: "text-[25.302px] leading-[21.15px] tracking-[-0.04em]",
  footer:
    "text-[min(256px,calc((100vw-48px)/4.67))] leading-[0.8359] tracking-[-0.06em]",
} as const;

export function Wordmark({ size, className }: { size: keyof typeof sizes; className?: string }) {
  return (
    <span className={cx("font-mdk block font-semibold whitespace-nowrap text-mdk-charcoal", sizes[size], className)}>
      Medidakos
    </span>
  );
}
