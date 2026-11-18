// 디자인 시스템 공통 버튼.
// - Primary·Secondary·Inverse 4가지 스타일, L(56px)·S(40px) 2가지 크기
// - href가 있으면 Next.js Link, 없으면 <button>으로 렌더링
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Figma: Design System — Components › Button (227:20).
 * Style = Primary | Secondary | Primary Inverse | Secondary Inverse (inverse = on dark backgrounds).
 * Size  = L (56px, Label 15/20) | S (40px, Medium 14/20).
 * Hover and Disabled have no Figma definition; disabled uses a provisional opacity.
 */
export type ButtonVariant = "primary" | "secondary" | "primary-inverse" | "secondary-inverse";
export type ButtonSize = "l" | "s";

const base =
  "font-mdk inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full " +
  "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-mdk-charcoal text-mdk-white focus-visible:outline-mdk-charcoal",
  secondary:
    "bg-transparent text-mdk-charcoal shadow-[inset_0_0_0_1px_var(--color-mdk-charcoal)] focus-visible:outline-mdk-charcoal",
  "primary-inverse": "bg-mdk-white text-mdk-charcoal focus-visible:outline-mdk-white",
  "secondary-inverse":
    "bg-transparent text-mdk-white shadow-[inset_0_0_0_1px_var(--color-mdk-white)] focus-visible:outline-mdk-white",
};

const sizes: Record<ButtonSize, string> = {
  l: "h-14 px-7 text-mdk-label",
  s: "h-10 px-5 text-[14px] leading-[20px] tracking-[-0.003em] font-medium",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps & Omit<ComponentProps<"button">, keyof CommonProps> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, keyof CommonProps>;

export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "l") {
  return cx(base, variants[variant], sizes[size]);
}

/** Renders a Next.js `Link` when `href` is given, otherwise a `<button>` (type="button" by default). */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "l", className, children, ...rest } = props;
  const classes = cx(buttonClassName(variant, size), className);

  if (rest.href !== undefined) {
    return (
      <Link {...(rest as Omit<ButtonAsLink, keyof CommonProps>)} className={classes}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button {...buttonRest} type={type} className={classes}>
      {children}
    </button>
  );
}
