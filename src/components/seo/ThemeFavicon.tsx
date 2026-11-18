"use client";

// 테마 favicon 갱신: Chrome은 SVG favicon을 URL당 한 번만 래스터화해 두고, 테마가 바뀌어도
// 같은 URL이면 다시 그리지 않는다(라이트 → 다크 → 라이트 전환 시 이전 색이 남음).
// SVG <link>의 URL에 현재 테마(?theme=light|dark)를 붙여, 테마가 바뀔 때마다 새 URL로 다시 받아 그리게 한다.
// 파일은 /icons/favicon.svg 하나이며 색 전환은 파일 안의 prefers-color-scheme가 담당한다.
import { useEffect } from "react";

export function ThemeFavicon() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    // Next.js can render the metadata icon links twice (server HTML + client), so update every SVG icon link.
    const apply = () => {
      const theme = media.matches ? "dark" : "light";
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')) {
        const url = new URL(link.href);
        url.searchParams.set("theme", theme);
        if (link.href !== url.href) link.href = url.href;
      }
    };
    apply();
    media.addEventListener("change", apply);
    // The client copy of the links can be added after this effect runs; theme it as well.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true });
    return () => {
      media.removeEventListener("change", apply);
      observer.disconnect();
    };
  }, []);
  return null;
}
