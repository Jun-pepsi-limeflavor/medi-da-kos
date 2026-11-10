"use client";

// 페이지 안 앵커 이동 시 주소창 해시를 남기지 않는 공용 처리(화면에 그리는 것 없음). Services·FAQ·Privacy Policy·Terms of Service에서 사용.
// - 페이지 안 앵커 클릭(#scope, #getting-started, /services#… 등): 기본 해시 이동 대신 대상으로 직접 스크롤
//   (동작 줄이기 설정이면 즉시) → 해시·히스토리 기록이 남지 않고 query는 그대로. 대상에 포커스 이동(추가 스크롤 없음)
// - 다른 페이지·직접 접속·새로고침으로 들어온 /…#…: 브라우저·Next가 이동시킨 뒤(페이지 로드 완료 후) replaceState로 해시만 제거
//   (히스토리 추가 없음). clearIncomingHash={false}면 들어온 해시는 페이지가 직접 정리한다(FAQ: 질문을 연 뒤 clearHashAfterLoad)
// - 이동 위치는 각 대상의 scroll-margin을 그대로 따른다
// (기존 Services 전용 ServicesHashUrl을 그대로 옮겨 공용화)
import { useEffect } from "react";

/** Element for a link that points at this page (same path and query) with a hash, else null. */
function samePageTarget(link: HTMLAnchorElement) {
  const url = new URL(link.href);
  if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) {
    return null;
  }
  return document.getElementById(decodeURIComponent(url.hash.slice(1)));
}

/**
 * Drop the hash from the address bar once the page has loaded (the browser re-aligns a fragment target after late
 * layout shifts such as web fonts until then). Runs a tick later so Next's patched history.replaceState (installed in
 * the App Router's own effect) syncs the router too; passing null lets Next keep its internal history state.
 * Returns a cleanup function.
 */
export function clearHashAfterLoad(): () => void {
  let timer = 0;
  const clear = () => {
    timer = window.setTimeout(() => {
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    });
  };
  if (document.readyState === "complete") clear();
  else window.addEventListener("load", clear, { once: true });
  return () => {
    window.removeEventListener("load", clear);
    window.clearTimeout(timer);
  };
}

export function SamePageHashUrl({ clearIncomingHash = true }: { clearIncomingHash?: boolean }) {
  useEffect(() => {
    const cleanupIncoming = clearIncomingHash && location.hash ? clearHashAfterLoad() : undefined;

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
      cleanupIncoming?.();
    };
  }, [clearIncomingHash]);

  return null;
}
