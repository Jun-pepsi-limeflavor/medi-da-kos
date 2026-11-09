// About Us 6 · CTA Band.
// - 차콜 배경 두 줄 제목 + 왼쪽 안내 문구 / 오른쪽 CTA 2개(Contact, Portfolio). lg 미만은 세로로 쌓는다
// - 1440 제목 행간은 Figma 72/72 (공통 제목의 md 행간 58px이 lg까지 이어지지 않게 지정)
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: 6 · CTA Band (422:190). Confirmed copy. */
export function AboutCtaBand() {
  return (
    <section className="bg-mdk-charcoal py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-16`}>
        <h2 className={cx(DISPLAY_TITLE, "max-w-[900px] text-mdk-white lg:leading-[72px]")}>
          Focus on your brand.
          <br />
          We manage the rest.
        </h2>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[560px] text-mdk-lead text-mdk-white">
            Share your product requirements, and our team will review your project and get in touch to discuss the next
            steps.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href={ROUTES.contact} variant="primary-inverse">
              Start your project
            </Button>
            <Button href={ROUTES.portfolio} variant="secondary-inverse">
              Discover our work
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
