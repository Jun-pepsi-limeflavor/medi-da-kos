// Portfolio 1 · Hero.
// - Eyebrow, 대형 제목(104px, 두 줄), 소개 문단(560px) + 오른쪽 아래 이미지 안내 배지
// - lg 미만은 소개 문단과 안내 배지를 세로로 쌓는다
// - 상단 여백·텍스트 위치는 다른 페이지 Hero와 같고, 하단 여백만 줄여(56px, 모바일 32px) 제품 영역을 조금 위로 올린다
import Image from "next/image";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: Portfolio — Facial care › 1 · Hero (772:3273). Bottom padding 56 (was 96, 2026-11-10). */
export function PortfolioHero() {
  return (
    <section className="bg-mdk-white pt-10 pb-8 lg:pt-[72px] lg:pb-14">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-8`}>
        <div className="flex flex-col gap-5 lg:gap-7">
          <p className={EYEBROW}>Portfolio</p>
          <h1 className="text-[clamp(40px,7.22vw,104px)] leading-[0.94] font-semibold tracking-[-0.045em] text-mdk-charcoal">
            Your next bestseller <br className="hidden sm:inline" />
            starts here
          </h1>
        </div>
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[560px] text-mdk-lead text-mdk-charcoal">
            Explore the product categories and formulas we can develop for your brand with our Korean manufacturing
            partners
          </p>
          <p className="flex shrink-0 items-center gap-2 rounded-full bg-mdk-off-white py-2 pr-4 pl-3 text-[13px] leading-[18px] text-mdk-charcoal-muted">
            <Image src="/icons/circle-info.svg" alt="" width={16} height={16} />
            Images are for illustrative purposes only.
          </p>
        </div>
      </div>
    </section>
  );
}
