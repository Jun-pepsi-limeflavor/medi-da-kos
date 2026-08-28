"use client";

import { ArrowRight } from "lucide-react";
import { trackCtaClick, type KoreaCtaId } from "./analytics";

/**
 * 폼으로 내려보내는 앵커. 위치별로 어느 CTA가 실제로 눌렸는지 세기 위해
 * 서버 컴포넌트의 `<a>` 대신 이걸 쓴다. 겉모습은 그대로다.
 */
export function KoreaCta({
  ctaId,
  className,
  children,
}: {
  ctaId: KoreaCtaId;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="#brief"
      data-cta={ctaId}
      className={className}
      onClick={() => trackCtaClick(ctaId)}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}
