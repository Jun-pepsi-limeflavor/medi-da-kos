// About Us 1 · Hero.
// - Eyebrow, 미션 제목(H1 96px), 소개 문단, 생산 라인 이미지(1200×442)
// - md 이상은 Figma 이미지 레이어 크롭(1200×514, 위로 37px) 그대로, 모바일은 3:2 프레임으로 cover
import Image from "next/image";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: About Us — Final Design › 1 · Hero (422:39). */
export function AboutHero() {
  return (
    <section className="bg-mdk-white pt-10 pb-20 lg:pt-[72px] lg:pb-32">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-12`}>
        <div className="flex flex-col gap-5 lg:gap-7">
          <p className={EYEBROW}>About Medidakos</p>
          <h1 className="text-[clamp(40px,6.67vw,96px)] leading-[0.98] font-semibold tracking-[-0.04em] text-mdk-charcoal">
            Where global beauty brands meet Korean know-how
          </h1>
        </div>
        <p className="max-w-[640px] text-mdk-lead text-mdk-charcoal">
          We help global beauty brands tap into South Korea’s advanced cosmetics manufacturing capabilities through our
          vetted partner network and end-to-end project management.
        </p>
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-mdk-lg bg-mdk-light-gray md:aspect-[1200/442]">
          <div className="absolute inset-x-0 top-0 h-full md:top-[-8.37%] md:h-[116.29%]">
            <Image
              src="/images/about/hero-production-line.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1440px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
