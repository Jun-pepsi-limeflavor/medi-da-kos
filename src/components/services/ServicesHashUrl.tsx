"use client";

// Services 주소창 해시 정리(화면에 그리는 것 없음). 최종 주소는 항상 /services.
// - 페이지 안 앵커 클릭(#scope, #stage-03, /services#… 등): 기본 해시 이동 대신 대상으로 직접 스크롤 → 해시·히스토리 기록이 남지 않음
// - 다른 페이지·직접 접속·새로고침으로 들어온 /services#…: 브라우저·Next가 이동시킨 뒤(페이지 로드 완료 후) replaceState로 해시만 제거(히스토리 추가 없음)
// - 이동 위치는 각 대상의 scroll-margin을 그대로 따른다
import { useEffect } from "react";

/** Element for a link that points at this page (same path and query) with a hash, else null. */
function samePageTarget(link: HTMLAnchorElement) {
  const url = new URL(link.href);
  if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) {
    return null;
  }
  return document.getElementById(decodeURIComponent(url.hash.slice(1)));
}

export function ServicesHashUrl() {
  useEffect(() => {
    // Incoming hash: the browser (direct load) or next/link (client navigation) has already scrolled to it.
    // Keep the hash until the page has loaded, because the browser re-aligns a fragment target after late layout
    // shifts such as web fonts. Then drop it after a tick, so Next's patched history.replaceState (installed in the
    // App Router's own effect) syncs the router too. Passing null lets Next copy its internal history state.
    let timer = 0;
    const clearHash = () => {
      timer = window.setTimeout(() => {
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      });
    };
    if (location.hash) {
      if (document.readyState === "complete") clearHash();
      else window.addEventListener("load", clearHash, { once: true });
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const target = samePageTarget(link);
      if (!target) return;
      // Runs in the capture phase, before next/link's handler, which skips default-prevented clicks.
      event.preventDefault();
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "instant" : "smooth" });
      // Keep keyboard order where a hash jump would put it: move focus to the target without a second scroll.
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("load", clearHash);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
