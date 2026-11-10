"use client";

// Privacy Policy·Terms of Service 목차(Figma 'Contents (sticky · anchor links)' · 'Policy · Local components (TOC Item)' 568:1120).
// - lg 이상: 왼쪽 열 sticky top 96px(Navbar 72 + 24). 'Contents' 라벨 + 조항 링크, Scroll Spy로 현재 조항 강조
//   (State=On: 왼쪽 2px 차콜 선·차콜 글자 / State=Off: 왼쪽 1px light-gray 선·muted 글자, 두 상태 글자 위치 동일)
// - 항목 상하 여백 9px(한 줄 항목 38px, 2026-11-10 사용자 검수로 7px → 9px). 두 상태 굵기가 같아 선택 전후 높이 동일
// - 공간이 부족할 때만 7px: 9px 기준 목차 높이가 쓸 수 있는 높이(창 높이 − 120px)를 넘으면 상하 여백을 7px로 줄인다.
//   창 너비가 아니라 실제 목차 높이로 판정(줄바꿈·조항 수 반영), 9px로 돌아가도 들어갈 때만 되돌림. 7px로도 넘치면 안쪽 스크롤
// - lg 이상은 창 높이와 관계없이 항상 sticky(2026-11-10 확정). 최대 높이 = 창 높이 − 120px(top 96 + 아래 여백 24),
//   목차가 더 길 때만 목차 안쪽 세로 스크롤 — 스크롤바는 표시하지 않음(휠·트랙패드·키보드 스크롤은 그대로, 너비 변화 없음)
// - 현재 조항이 목차 보이는 범위 밖이면 목차 안쪽만 스크롤해 보이게 한다(페이지 스크롤은 건드리지 않음)
// - lg 미만: 표시하지 않음(FAQ 카테고리 목록과 같은 기준, display:none이라 Tab·스크린리더 대상에서도 제외)
// - 링크 클릭 시 주소창에 해시를 남기지 않는 이동은 LegalDocument의 공용 SamePageHashUrl이 처리
// - 현재 조항 판정은 각 조항 제목(h2) 위치 기준 — 조항 위 48px 여백과 무관하게 제목이 기준선에 닿을 때 바뀐다
import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { cx } from "@/lib/utils/cx";

/** Navbar 72 + 24px: Scroll Spy line and sticky top. */
const OFFSET = 96;
/** Sticky top 96 + 24px bottom gap: the list's max height is the viewport height minus this. */
const RESERVED = 120;
/** Each item's padding goes 9px → 7px when compact: 4px less per item. */
const COMPACT_SAVING = 4;
const findTitle = (id: string) => document.getElementById(`${id}-title`);

export function LegalContents({ items }: { items: readonly { id: string; title: string }[] }) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const { active, lock } = useScrollSpy(ids, OFFSET, findTitle);
  const nav = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);

  // Use 7px item padding only when the list at 9px would be taller than the space below the Navbar.
  useEffect(() => {
    const el = nav.current;
    const list = el?.querySelector("ul");
    if (!el || !list) return;
    const check = () => {
      if (window.getComputedStyle(el).display === "none") return;
      const available = window.innerHeight - RESERVED;
      const content = el.scrollHeight; // full list height, even when max-height clips it
      setCompact((current) => (current ? content + COMPACT_SAVING * items.length : content) > available);
    };
    const observer = new ResizeObserver(check);
    observer.observe(list);
    window.addEventListener("resize", check);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [items.length]);

  // When the list scrolls inside itself, keep the active item in its visible part. Only the list moves, never the page.
  useEffect(() => {
    const el = nav.current;
    const link = el?.querySelector<HTMLElement>('a[aria-current="true"]');
    if (!el || !link || el.scrollHeight <= el.clientHeight) return;
    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;
    const margin = 24;
    let target: number | null = null;
    if (top - margin < el.scrollTop) target = top - margin;
    else if (bottom + margin > el.scrollTop + el.clientHeight) target = bottom + margin - el.clientHeight;
    if (target === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: Math.max(0, target), behavior: reduce ? "instant" : "smooth" });
  }, [active]);

  return (
    <nav
      ref={nav}
      aria-label="Contents"
      className={cx(
        "hidden w-[240px] shrink-0 self-start lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto xl:w-[288px]",
        // Inner scroll stays (wheel, trackpad, keyboard) but no scrollbar is drawn and no width is reserved for one:
        // scrollbar-width for Firefox and current Chrome/Safari, ::-webkit-scrollbar for older WebKit.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      <p className="pb-2 text-mdk-eyebrow text-mdk-charcoal-muted">Contents</p>
      <ul>
        {items.map(({ id, title }) => {
          const current = id === active;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => lock(id)}
                aria-current={current ? "true" : undefined}
                className={cx(
                  "block text-mdk-label focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-charcoal",
                  compact ? "py-[7px]" : "py-[9px]",
                  current
                    ? "border-l-2 border-mdk-charcoal pl-[15px] text-mdk-charcoal"
                    : "border-l border-mdk-light-gray pl-4 text-mdk-charcoal-muted hover:text-mdk-charcoal",
                )}
              >
                {title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
