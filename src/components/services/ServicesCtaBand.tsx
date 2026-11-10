// Services 7 · CTA Band.
// - 차콜 배경 제목 + 왼쪽 안내 문구 / 오른쪽 CTA 2개(Start your project → /contact, FAQ → /faq). lg 미만은 세로로 쌓는다
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: 7 · CTA Band (255:525). */
export function ServicesCtaBand() {
  return (
    <section className="bg-mdk-charcoal py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-16`}>
        <h2 className={cx(DISPLAY_TITLE, "text-mdk-white")}>Ready for your market?</h2>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[560px] text-mdk-lead text-mdk-white">
            Share your product requirements, and our team will review your project and guide you through the next steps.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href={ROUTES.contact} variant="primary-inverse">
              Start your project
            </Button>
            <Button href={ROUTES.faq} variant="secondary-inverse">
              FAQ
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
