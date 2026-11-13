// About Us 5 · Who We Are & Company Information.
// - 광화문 와이드 이미지(2:1) + 왼쪽 소개 / 오른쪽 주소·이메일(mailto)·전화(tel) 목록과 Contact us 버튼
// - 이메일·전화 값은 사이트 공통 설정(SUPPORT_*)을 사용
// - 1440 제목은 Figma Heading 44/50
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/config/site";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

// Label beside the value, except mobile and the narrow lg–xl column where it sits above.
const ROW = "flex flex-col gap-1 border-t border-mdk-light-gray py-[19px] sm:flex-row sm:gap-8 lg:flex-col lg:gap-1 xl:flex-row xl:gap-8";
const LABEL = "text-mdk-label text-mdk-charcoal-muted sm:w-40 sm:shrink-0 lg:w-auto xl:w-40";
const VALUE = "min-w-0 text-[18px] leading-7 font-medium tracking-[-0.015em] sm:text-[20px]";
const LINK = `${VALUE} w-fit text-mdk-charcoal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal`;

/** Figma: 5 · Who We Are & Company Information (422:162). Address·email·phone values confirmed. */
export function AboutWhoWeAre() {
  return (
    <section className="bg-mdk-off-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-mdk-lg bg-mdk-light-gray md:aspect-[2/1]">
          <Image
            src="/images/about/seoul-gwanghwamun.jpg"
            alt="Gwanghwamun Square in central Seoul"
            fill
            sizes="(min-width: 1440px) 1200px, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-24">
          <div className="flex flex-col gap-6 lg:w-[504px] lg:shrink-0">
            <p className={EYEBROW}>Who we are</p>
            <h2 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-mdk-charcoal lg:text-mdk-heading lg:leading-[50px]">
              Your partner in Seoul,
              <br />
              the K-beauty hub
            </h2>
            <p className="text-mdk-lead text-mdk-charcoal">
              Based in Jongno, at the heart of Seoul, Medidakos connects global beauty brands with Korea’s manufacturing
              expertise and manages projects from development to export.
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start lg:pt-[42px]">
            <dl className="w-full">
              <div className={ROW}>
                <dt className={LABEL}>Address</dt>
                <dd className={`${VALUE} text-mdk-charcoal-muted`}>5F, 6 Jong-ro, Jongno-gu, Seoul</dd>
              </div>
              <div className={ROW}>
                <dt className={LABEL}>Email</dt>
                <dd>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div className={ROW}>
                <dt className={LABEL}>Phone</dt>
                <dd>
                  <a href={SUPPORT_PHONE_HREF} className={LINK}>
                    {SUPPORT_PHONE}
                  </a>
                </dd>
              </div>
            </dl>
            <Button href={ROUTES.contact} className="mt-7">
              Contact us
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
