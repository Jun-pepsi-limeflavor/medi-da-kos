// 필터 칩(선택·미선택 토글 버튼).
// - 선택 상태를 색상과 aria-pressed로 표시
import type { ComponentProps } from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Figma: Design System — Components › Filter Chip (227:31), State = Default | Selected.
 * 40px tall, 18px side padding, Medium 14/20 -0.3%. Exposes the selection via aria-pressed.
 */
type ChipProps = Omit<ComponentProps<"button">, "type"> & { selected: boolean };

export function Chip({ selected, className, ...rest }: ChipProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={cx(
        "font-mdk inline-flex h-10 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full px-[18px]",
        "text-[14px] leading-[20px] font-medium tracking-[-0.003em]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal",
        selected
          ? "bg-mdk-charcoal text-mdk-white"
          : "bg-mdk-white text-mdk-charcoal shadow-[inset_0_0_0_1px_var(--color-mdk-light-gray)]",
        className,
      )}
    />
  );
}
