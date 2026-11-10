"use client";

// 연말 프로모션 상단 공지 바.
// - 클릭하면 Contact(/contact)로 이동 — 일반 문의와 같은 주소·같은 초기 폼(2026-11-10 확정)
// - 닫으면 이 탭(sessionStorage, 프로모션 코드별 키) 동안 숨김, 프로모션 종료 후에는 표시하지 않음
// - 닫힌 탭에서는 루트 레이아웃의 사전 스크립트가 첫 페인트 전에 숨겨 깜빡임·레이아웃 이동을 막는다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  ANNOUNCEMENT_DISMISSED_ATTR,
  ANNOUNCEMENT_DISMISSED_KEY,
  isYearEndPromoActive,
} from "@/lib/config/promo";
import { ROUTES } from "@/lib/config/routes";

/**
 * Figma: Design System › Announcement Bar (229:3). 40px charcoal bar, centered message + link, close at right 120px.
 * - Whole bar and the link go to /contact (same page and initial form as any other Contact link).
 * - Close hides it for this tab (sessionStorage, keyed by promo code); a new tab or a new promo shows it again.
 * - Not rendered after the promo end (see YEAR_END_PROMO).
 * - Clicking the link is remembered for this visit so the future Promotion Popup can skip auto-opening.
 */
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
  return readSession(ANNOUNCEMENT_DISMISSED_KEY) === "1" || !isYearEndPromoActive();
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
    writeSession(ANNOUNCEMENT_DISMISSED_KEY);
    document.documentElement.setAttribute(ANNOUNCEMENT_DISMISSED_ATTR, "");
    listeners.forEach((listener) => listener());
  }

  return (
    <div
      data-announcement-bar=""
      // 40px single line where it fits (Figma); on narrow screens the message wraps instead of being cut off.
      className="font-mdk relative flex min-h-10 cursor-pointer flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-mdk-charcoal py-2 pr-12 pl-12 text-center text-[13px] leading-4 text-mdk-white"
      onClick={() => {
        rememberClick();
        router.push(ROUTES.contact);
      }}
    >
      <p className="font-normal">
        Year-end offer: 10% off eligible costs when you sign by December 31, 2026. Terms apply.
      </p>
      <Link
        href={ROUTES.contact}
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
