"use client";

// How it works 단계 목록(01~09) — lg 이상 왼쪽 sticky(top 148px = Navbar 72 + Anchor Bar 52 + 24).
// - 클릭하면 오른쪽 단계 상세(#stage-01~09)로 이동, Scroll Spy로 현재 단계 강조
//   (왼쪽 2px 차콜 막대 + 굵은 제목, aria-current). 클릭 이동 중에는 클릭한 단계 유지
import { useMemo } from "react";
import { STAGE_SCROLL_OFFSET } from "@/components/services/anchors";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { cx } from "@/lib/utils/cx";

export type StageLink = { id: string; number: string; title: string };

/** Figma: Stage Nav (sticky · scroll-to · 9 stages) (260:372). */
export function ServicesStageNav({ stages }: { stages: readonly StageLink[] }) {
  const ids = useMemo(() => stages.map((s) => s.id), [stages]);
  const { active, lock } = useScrollSpy(ids, STAGE_SCROLL_OFFSET);

  return (
    <nav aria-label="Project stages" className="hidden w-[280px] shrink-0 self-start lg:sticky lg:top-[148px] lg:block">
      <ol>
        {stages.map(({ id, number, title }) => {
          const current = id === active;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => lock(id)}
                aria-current={current ? "step" : undefined}
                className={cx(
                  "flex gap-3.5 py-3.5 pl-5 tracking-[-0.003em] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-charcoal",
                  current ? "border-l-2 border-mdk-charcoal" : "border-l border-mdk-light-gray hover:text-mdk-charcoal",
                )}
              >
                <span
                  className={cx(
                    "shrink-0 text-[15px] leading-5 font-medium",
                    current ? "text-mdk-charcoal" : "text-mdk-mid-gray",
                  )}
                >
                  {number}
                </span>
                <span
                  className={cx(
                    "min-w-0 text-[16px] leading-[22px]",
                    current ? "font-semibold text-mdk-charcoal" : "text-mdk-charcoal-muted",
                  )}
                >
                  {title}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
