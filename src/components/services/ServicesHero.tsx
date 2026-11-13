// Services 1 · Hero.
// - Eyebrow, 대형 제목(104px), 소개 문단, Start your project(→ /contact), 텍스처 이미지(1200×442)
// - md 이상은 Figma 이미지 레이어 크롭(1551×517, -176/-38) 그대로, 모바일은 3:2 프레임으로 cover
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: Services — Final Design › 1 · Hero (254:376). */
export function ServicesHero() {
  return (
    <section className="bg-mdk-white pt-10 pb-12 lg:pt-[72px] lg:pb-20">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-12`}>
        <div className="flex flex-col gap-5 lg:gap-7">
          <p className={EYEBROW}>Services</p>
          <h1 className="text-[clamp(40px,7.22vw,104px)] leading-[0.94] font-semibold tracking-[-0.045em] text-mdk-charcoal">
            From idea to launch,
            <br />
            fully coordinated
          </h1>
        </div>
        <div className="flex flex-col items-start gap-9">
          <p className="max-w-[560px] text-mdk-lead text-mdk-charcoal">
            Explore what we manage, how each stage works, and what to expect—from samples and MOQs to quality and
            compliance.
          </p>
          <Button href={ROUTES.contact}>Start your project</Button>
        </div>
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-mdk-lg bg-mdk-light-gray md:aspect-[1200/442]">
          <div className="absolute inset-0 md:inset-auto md:top-[-8.6%] md:left-[-14.67%] md:h-[116.97%] md:w-[129.25%]">
            <Image
              src="/images/services/hero-textures.png"
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 1551px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
