"use client";

// Services 섹션 앵커 바(Navbar 아래 sticky, 차콜 배경·높이 52px·14px).
// - 5개 앵커(#scope 등)로 각 섹션 제목 묶음으로 이동(scroll-margin 164px, 주소창 해시 처리는 공용 SamePageHashUrl)
// - 현재 섹션을 Scroll Spy로 강조: 섹션 전체(상단 여백 포함)가 바 아래에 닿으면 활성(흰색 + 하단 2px 흰색 막대, aria-current)
// - 비활성 #B8B8B8, Hover 흰색, Focus 흰색 외곽선. 좁은 화면에서는 가로 스크롤
import { SERVICES_ANCHORS, SERVICES_SCROLL_OFFSET, findServicesSection } from "@/components/services/anchors";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { cx } from "@/lib/utils/cx";

const IDS = SERVICES_ANCHORS.map((a) => a.id);

/** Figma: Anchor Bar (sticky below navbar) (254:389). */
export function ServicesAnchorBar() {
  const { active, lock } = useScrollSpy(IDS, SERVICES_SCROLL_OFFSET, findServicesSection);

  return (
    <nav aria-label="Services sections" className="sticky top-[72px] z-30 bg-mdk-charcoal">
      <ul className="mx-auto flex h-[52px] max-w-[1440px] items-stretch gap-8 overflow-x-auto px-6 [scrollbar-width:none] lg:gap-10 xl:px-[120px] [&::-webkit-scrollbar]:hidden">
        {SERVICES_ANCHORS.map(({ id, label }) => {
          const current = id === active;
          return (
            <li key={id} className="flex shrink-0">
              <a
                href={`#${id}`}
                onClick={() => lock(id)}
                aria-current={current ? "true" : undefined}
                className={cx(
                  "flex items-center border-b-2 text-[14px] leading-5 font-medium tracking-[-0.003em] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-white",
                  current ? "border-mdk-white text-mdk-white" : "border-transparent text-mdk-mid-gray hover:text-mdk-white",
                )}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
