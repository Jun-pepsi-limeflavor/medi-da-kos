// Home 1 · Hero.
// - Eyebrow, 대형 제목, 질감 이미지, 소개 문구와 CTA 2개가 올라간 배너
// - lg 이상은 Figma처럼 배너 이미지 위에 글을 겹치고, 그 미만은 이미지 아래에 글을 둔다
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: Home — Final Design › 1 · Hero (234:5302). */
export function HomeHero() {
  return (
    <section className="bg-mdk-white pt-10 pb-16 lg:pt-14 lg:pb-[54px]">
      <div className={SECTION_CONTAINER}>
        <div className="relative">
          <p className="text-[16px] leading-6 font-medium tracking-[-0.005em] text-mdk-charcoal-muted md:text-[20px] md:leading-7">
            Korean Cosmetics OEM · ODM Partner
          </p>
          <h1 className="mt-4 text-[clamp(40px,12.5vw,152px)] leading-[1.04] md:text-[clamp(40px,10.55vw,152px)] font-semibold tracking-[-0.045em] text-mdk-charcoal md:mt-6">
            Your idea,
            <br />
            made in Korea
          </h1>
          {/* 1440 frame: 447×150 at the container's right edge, 15px below the title top. */}
          <div className="relative mt-6 aspect-[447/150] w-full overflow-hidden rounded-mdk-sm md:absolute md:top-[calc(28px+24px+15px)] md:right-0 md:mt-0 md:w-[min(447px,31vw)]">
            <Image
              src="/images/home/hero-texture.png"
              alt=""
              fill
              sizes="(min-width: 768px) 447px, 100vw"
              className="scale-[1.114] object-cover"
              priority
            />
          </div>
        </div>

        <div className="relative mt-10 flex flex-col overflow-hidden rounded-mdk-lg bg-mdk-off-white lg:h-[442px] lg:justify-center lg:py-12 lg:pr-16 lg:pl-20">
          <div className="relative aspect-[4/3] w-full lg:absolute lg:inset-0 lg:aspect-auto">
            <Image
              src="/images/home/hero-banner.png"
              alt=""
              fill
              sizes="(min-width: 1440px) 1200px, 100vw"
              className="object-cover object-[98%_50%] lg:object-[50%_36%]"
              priority
            />
          </div>
          <div className="relative flex flex-col gap-10 p-6 sm:p-10 lg:w-[480px] lg:p-0">
            <p className="text-mdk-lead text-mdk-charcoal">
              Medidakos provides a one-stop solution covering the process from product development through launch. We
              manage end to end, coordinating Korean manufacturers and packaging suppliers and overseeing project
              timelines.
            </p>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-3">
                <Button href={ROUTES.contact}>Start your project</Button>
                <Button href={ROUTES.services} variant="secondary">
                  Explore our services
                </Button>
              </div>
              <p className="text-[14px] leading-[22px] tracking-[-0.002em] text-mdk-charcoal-muted">
                Share your idea or brief. Our project management team reviews every request and replies with next steps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
