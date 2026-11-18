// Home 8 · CTA Band. 어두운 배경이라 data-launcher-theme="dark"(Channel Talk 런처가 이 위에서 On Dark 색으로 바뀜).
// - 차콜 배경 위 제목·안내 문구·CTA 2개(Contact, Services How it works)와 오른쪽 이미지
// - lg 미만은 텍스트 아래에 이미지를 쌓는다(이미지 비율·크롭 유지)
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ROUTES, SERVICES_SECTIONS } from "@/lib/config/routes";
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: 8 · CTA Band (234:5423). */
export function CtaBand() {
  return (
    <section data-launcher-theme="dark" className="bg-mdk-charcoal py-20 lg:py-30">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-24`}>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-10 lg:gap-12">
          <h2 className={cx(DISPLAY_TITLE, "max-w-[664px] text-mdk-white")}>Bring your idea to life</h2>
          <p className="max-w-[560px] text-mdk-lead text-mdk-white">
            Share your product requirements, and our team will review your project and get in touch to discuss the next
            steps.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href={ROUTES.contact} variant="primary-inverse">
              Start your project
            </Button>
            <Button href={SERVICES_SECTIONS.howItWorks} variant="secondary-inverse">
              How it works?
            </Button>
          </div>
        </div>
        {/* 440×480, radius 16; the image layer is 581×775 at (−71, −124) in the Figma frame. */}
        <div className="relative aspect-[440/480] w-full max-w-[440px] shrink-0 overflow-hidden rounded-mdk-lg lg:w-[440px]">
          <div className="absolute top-[-25.83%] left-[-16.14%] h-[161.46%] w-[132.05%]">
            <Image
              src="/images/home/cta-visual.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 581px, 132vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
