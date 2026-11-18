// 페이지 진입 방식 기록(사용자가 실제로 누른 링크 주소 · 뒤로가기/앞으로가기 시점). 화면 없음, 루트의 NavigationIntent가 설치.
// - 이유: Next.js 16.2.6은 해시가 붙은 링크(/faq#faq-030)로 처음 이동한 경로의 canonicalUrl을 해시째 캐시해,
//   이후 일반 /faq 링크도 /faq#faq-030으로 push한다(segment-cache/navigation.js). 주소창 해시만으로는
//   딥링크인지 알 수 없으므로, 받는 페이지가 "누른 링크의 실제 주소"를 확인할 수 있게 한다
// - 링크 클릭은 capture 단계에서 기록(next/link 처리보다 먼저), 새 탭·수정키 클릭은 제외
// - pageEntry(): 이 페이지에 어떻게 들어왔는지 — 방금 누른 링크 / 뒤로·앞으로 / 문서 로드(직접 접속·새로고침·문서 단위 뒤로)

/** How long after a click or popstate the new page still counts as reached by it. */
const WINDOW_MS = 3000;

let lastLink: { url: URL; at: number } | null = null;
let lastPopAt = 0;

/** Record link clicks and history traversals. Returns a cleanup function. */
export function installNavigationIntent(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href);
    if (url.origin === location.origin) lastLink = { url, at: Date.now() };
  };
  const onPopState = () => {
    lastPopAt = Date.now();
  };
  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", onPopState);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("popstate", onPopState);
  };
}

export type PageEntry =
  | { kind: "link"; hash: string }
  | { kind: "traversal" }
  | { kind: "document"; type: string };

/**
 * How the page at `pathname` was just reached: a link the user clicked to it (with that link's own hash),
 * a browser back/forward within the app, or a document load (direct visit, reload, cross-document back).
 * Not consumed, so React's development double-mount reads the same answer.
 */
export function pageEntry(pathname: string): PageEntry {
  const now = Date.now();
  const link = lastLink && now - lastLink.at < WINDOW_MS && lastLink.url.pathname === pathname ? lastLink : null;
  const popped = now - lastPopAt < WINDOW_MS;
  if (link && (!popped || link.at > lastPopAt)) return { kind: "link", hash: link.url.hash };
  if (popped) return { kind: "traversal" };
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return { kind: "document", type: nav?.type ?? "navigate" };
}
