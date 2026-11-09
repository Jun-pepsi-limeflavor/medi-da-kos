// 라벨과 오류 문구를 포함한 공통 입력 필드.
// - 오류가 있으면 빨간 테두리와 입력창 아래 오류 문구 표시
// - aria-invalid·aria-describedby로 오류를 보조기기에 연결
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Figma: Design System — Components › Input Field (227:49), State = Default | Focus | Filled | Error.
 * Label (MDK/Label) → 8px → 56px field (radius 4, 18px side padding, MDK/Body) → 8px → error (MDK/Caption).
 * Borders are inset shadows so the 1px → 1.5px focus/error stroke does not shift layout (Figma: stroke inside).
 */
type InputProps = Omit<ComponentProps<"input">, "children"> & {
  label: ReactNode;
  /** Error text shown under the field; also sets aria-invalid. */
  error?: string;
};

export function Input({ label, error, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cx("font-mdk flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-mdk-label text-mdk-charcoal">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(error && errorId, rest["aria-describedby"]) || undefined}
        className={cx(
          "h-14 w-full rounded-[4px] bg-mdk-white px-[18px] text-mdk-body text-mdk-charcoal outline-none",
          "placeholder:text-mdk-charcoal-muted",
          error
            ? "shadow-[inset_0_0_0_1.5px_var(--color-mdk-error)]"
            : "shadow-[inset_0_0_0_1px_var(--color-mdk-light-gray)] focus:shadow-[inset_0_0_0_1.5px_var(--color-mdk-charcoal)]",
        )}
      />
      {error ? (
        <p id={errorId} className="text-mdk-caption text-mdk-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
