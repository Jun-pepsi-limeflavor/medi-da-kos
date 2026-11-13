// 모달 공통 닫기(X) 버튼 — 40px 원형, 20px 아이콘(10×10 X, 1.5px 선). Figma 'Close (X)'.
// - bordered: SNS Post Modal(흰 배경 + 1px light-gray 테두리) / plain: Cookie Settings(배경 없음) / Promotion Popup은 흰 원형(on-image)
import { cx } from "@/lib/utils/cx";

type CloseButtonProps = {
  onClick: () => void;
  label: string;
  variant: "bordered" | "plain" | "on-image";
  className?: string;
  /** Receives focus when the modal opens (Modal looks for data-autofocus after showModal). */
  autoFocus?: boolean;
};

export function CloseButton({ onClick, label, variant, className, autoFocus }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-autofocus={autoFocus ? "" : undefined}
      className={cx(
        "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-mdk-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal",
        variant === "bordered" && "bg-mdk-white shadow-[inset_0_0_0_1px_var(--color-mdk-light-gray)]",
        variant === "on-image" && "bg-mdk-white focus-visible:outline-mdk-white",
        variant === "plain" && "hover:bg-mdk-off-white",
        className,
      )}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
