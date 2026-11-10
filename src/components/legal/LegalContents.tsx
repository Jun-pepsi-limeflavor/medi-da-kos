"use client";

// Privacy Policy·Terms of Service 목차(Figma 'Contents (sticky · anchor links)' · 'Policy · Local components (TOC Item)' 568:1120).
// - lg 이상: 왼쪽 열 sticky top 96px(Navbar 72 + 24). 'Contents' 라벨 + 조항 링크, Scroll Spy로 현재 조항 강조
//   (State=On: 왼쪽 2px 차콜 선·차콜 글자 / State=Off: 왼쪽 1px light-gray 선·muted 글자, 두 상태 글자 위치 동일)
// - 항목 상하 여백 9px(한 줄 항목 38px, 2026-11-10 사용자 검수로 7px → 9px). 두 상태 굵기가 같아 선택 전후 높이 동일
// - 목차 전체가 화면에 들어갈 때만 sticky(창 높이 ≥ top 96px + 목차 높이 + 24px). 낮은 창에서는 본문과 함께 스크롤돼
//   마지막 조항까지 항상 누를 수 있다(별도 스크롤 영역 없음)
// - lg 미만: 표시하지 않음(FAQ 카테고리 목록과 같은 기준, display:none이라 Tab·스크린리더 대상에서도 제외)
// - 링크 클릭 시 주소창에 해시를 남기지 않는 이동은 LegalDocument의 공용 SamePageHashUrl이 처리
// - 현재 조항 판정은 각 조항 제목(h2) 위치 기준 — 조항 위 48px 여백과 무관하게 제목이 기준선에 닿을 때 바뀐다
import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { cx } from "@/lib/utils/cx";

/** Navbar 72 + 24px: Scroll Spy line and sticky top. */
const OFFSET = 96;
const findTitle = (id: string) => document.getElementById(`${id}-title`);

export function LegalContents({ items }: { items: readonly { id: string; title: string }[] }) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const { active, lock } = useScrollSpy(ids, OFFSET, findTitle);
  const nav = useRef<HTMLElement>(null);
  const [fits, setFits] = useState(true);

  // Sticky only while the whole list fits below the Navbar; otherwise its last items could never come into view.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const check = () => setFits(window.innerHeight >= OFFSET + el.offsetHeight + 24);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    window.addEventListener("resize", check);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <nav
      ref={nav}
      aria-label="Contents"
      className={cx("hidden w-[240px] shrink-0 self-start lg:block xl:w-[288px]", fits && "lg:sticky lg:top-24")}
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
                  "block py-[9px] text-mdk-label focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-charcoal",
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
