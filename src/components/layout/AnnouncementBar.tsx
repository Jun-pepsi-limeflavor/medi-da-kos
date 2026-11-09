"use client";

// 연말 프로모션 상단 공지 바.
// - 클릭하면 프로모션 Contact 페이지로 이동
// - 닫으면 이번 방문(sessionStorage) 동안 숨김, 프로모션 종료 후에는 표시하지 않음
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { YEAR_END_PROMO, isYearEndPromoActive } from "@/lib/config/promo";

/**
 * Figma: Design System › Announcement Bar (229:3). 40px charcoal bar, centered message + link, close at right 120px.
 * - Whole bar and the link go to /contact?promo=year-end-2026.
 * - Close hides it for this visit (sessionStorage); a new visit shows it again.
 * - Not rendered after the promo end (see YEAR_END_PROMO).
 * - Clicking the link is remembered for this visit so the future Promotion Popup can skip auto-opening.
 */
const DISMISSED_KEY = "mdk:announcement-dismissed";
export const PROMO_BAR_CLICKED_KEY = "mdk:promo-bar-clicked";

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: the bar simply reappears on the next page load.
  }
}

/** Client snapshot: hidden when dismissed this session or the promo has ended. */
function isHidden() {
  return readSession(DISMISSED_KEY) === "1" || !isYearEndPromoActive();
}

export function AnnouncementBar() {
  const router = useRouter();
  // The server render shows the bar (promo active at build time); the client hides it if needed.
  const hidden = useSyncExternalStore(subscribe, isHidden, () => !isYearEndPromoActive());
  if (hidden) return null;

  function rememberClick() {
    writeSession(PROMO_BAR_CLICKED_KEY);
  }

  function dismiss() {
    writeSession(DISMISSED_KEY);
    listeners.forEach((listener) => listener());
  }

  return (
    <div
      // 40px single line where it fits (Figma); on narrow screens the message wraps instead of being cut off.
      className="font-mdk relative flex min-h-10 cursor-pointer flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-mdk-charcoal py-2 pr-12 pl-12 text-center text-[13px] leading-4 text-mdk-white"
      onClick={() => {
        rememberClick();
        router.push(YEAR_END_PROMO.contactHref);
      }}
    >
      <p className="font-normal">
        Year-end offer: 10% off eligible costs when you sign by December 31, 2026. Terms apply.
      </p>
      <Link
        href={YEAR_END_PROMO.contactHref}
        onClick={(event) => {
          event.stopPropagation();
          rememberClick();
        }}
        className="shrink-0 font-medium whitespace-nowrap underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-white"
      >
        Ask about the offer →
      </Link>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={(event) => {
          event.stopPropagation();
          dismiss();
        }}
        className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center sm:right-4 xl:right-[108px] focus-visible:outline-2 focus-visible:outline-mdk-white"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
