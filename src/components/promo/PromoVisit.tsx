"use client";

// Promotion 팝업용 방문 기록(화면 없음, 루트 레이아웃에 한 번). 문서를 열 때 새 방문 여부를 판정하고(lib/promo/visit)
// 페이지 이동·클릭·키 입력·스크롤·탭 이탈 때 마지막 활동 시각을 이 탭 sessionStorage에 남긴다(최대 1분에 한 번).
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { markActivity } from "@/lib/promo/visit";

const THROTTLE_MS = 60 * 1000;

export function PromoVisit() {
  const pathname = usePathname();

  useEffect(() => {
    markActivity();
  }, [pathname]);

  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      markActivity();
    };
    const onHide = () => markActivity();
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((type) => window.addEventListener(type, onActivity, { passive: true }));
    window.addEventListener("pagehide", onHide);
    return () => {
      events.forEach((type) => window.removeEventListener(type, onActivity));
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
