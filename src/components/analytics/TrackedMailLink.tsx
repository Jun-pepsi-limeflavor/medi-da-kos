"use client";

// 기존(레거시) 페이지용 이메일 링크: 클릭 시 메일 앱 대신 주소 복사 + email_click·email_copy 측정.
// - 복사 로직은 공용 copyText(@/lib/utils/clipboard) 사용
import { useEffect, useRef, useState } from "react";
import { trackEmailClick, trackEmailCopy, type EmailLinkLocation } from "@/lib/analytics/events";
import { copyText } from "@/lib/utils/clipboard";

type Props = {
  email: string;
  location: EmailLinkLocation;
  className?: string;
};

/**
 * 클릭하면 메일 앱을 열지 않고 주소를 복사한다.
 * href는 우클릭 "주소 복사"와 JS 실패 시 대체용으로 남긴다.
 */
export function TrackedMailLink({ email, location, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    trackEmailClick(location, email);

    void copyText(email).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <span className="relative inline-block">
      <a
        href={`mailto:${email}`}
        onClick={handleClick}
        onCopy={() => trackEmailCopy(location)}
        className={className}
      >
        {email}
      </a>
      {/* 띄워서 표시한다. 흐름 안에 두면 가운데 정렬 줄이 흔들린다. */}
      <span
        role="status"
        aria-live="polite"
        className={`pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-xs text-white transition-opacity ${
          copied ? "opacity-100" : "opacity-0"
        }`}
      >
        {copied ? "Copied!" : ""}
      </span>
    </span>
  );
}
