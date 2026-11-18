"use client";

// How it works 단계 목록(01~09) — lg 이상 왼쪽 sticky(top 148px = Navbar 72 + Anchor Bar 52 + 24).
// - 클릭하면 오른쪽 단계 상세(#stage-01~09)로 이동, Scroll Spy로 현재 단계 강조
//   (왼쪽 2px 차콜 막대 + 굵은 제목, aria-current). 클릭 이동 중에는 클릭한 단계 유지
// - 선택 전후 줄 수·높이 고정: 제목 칸은 항상 굵은(SemiBold) 글자 기준 크기를 차지(보이지 않는 굵은 사본을 같은 칸에 겹침)
//   + 왼쪽 여백 16px(활성 15px + 2px 막대 = 일반 16px + 1px 선과 같은 글자 위치) → 제목 폭 230px에서
//   06 'Contract & order confirmation'이 활성 상태에서도 한 줄(SemiBold 226px). 03은 두 상태 모두 두 줄
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
                  "flex gap-3.5 py-3.5 tracking-[-0.003em] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-charcoal",
                  current ? "border-l-2 border-mdk-charcoal pl-[15px]" : "border-l border-mdk-light-gray pl-4 hover:text-mdk-charcoal",
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
                {/* Both states size to the SemiBold text (hidden copy in the same grid cell), so lines never change. */}
                <span className="grid min-w-0 text-[16px] leading-[22px]">
                  <span
                    className={cx(
                      "col-start-1 row-start-1",
                      current ? "font-semibold text-mdk-charcoal" : "text-mdk-charcoal-muted",
                    )}
                  >
                    {title}
                  </span>
                  <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
                    {title}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
