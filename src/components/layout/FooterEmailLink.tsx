"use client";

// Footer 이메일 링크(Contact 'Prefer email?'에서도 재사용 — 측정 위치는 location으로 구분).
// - 한 번 클릭(또는 Enter)으로 mailto 메일 앱 열기와 주소 클립보드 복사를 함께 시도
// - 복사 성공 시에만 "Email copied!" 안내, 실패해도 메일 앱 열기는 그대로 진행
// - 기존 email_click 이벤트 측정과 직접 선택 복사(email_copy) 측정 유지
import { useEffect, useRef, useState } from "react";
import { trackEmailClick, trackEmailCopy, type EmailLinkLocation } from "@/lib/analytics/events";
import { copyText } from "@/lib/utils/clipboard";

export function FooterEmailLink({
  email,
  className,
  location = "footer",
}: {
  email: string;
  className?: string;
  location?: EmailLinkLocation;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleClick() {
    // No preventDefault: the browser still follows mailto:. Copy starts in the same user gesture.
    trackEmailClick(location, email);
    void copyText(email).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <span className="relative self-start">
      <a href={`mailto:${email}`} onClick={handleClick} onCopy={() => trackEmailCopy(location)} className={className}>
        {email}
      </a>
      {/* Floats above the link so the footer layout doesn't move. */}
      <span
        role="status"
        aria-live="polite"
        className={`pointer-events-none absolute bottom-full left-0 mb-2 rounded-mdk-sm bg-mdk-charcoal px-2.5 py-1 text-mdk-caption whitespace-nowrap text-mdk-white transition-opacity ${
          copied ? "opacity-100" : "opacity-0"
        }`}
      >
        {copied ? "Email copied!" : ""}
      </span>
    </span>
  );
}
