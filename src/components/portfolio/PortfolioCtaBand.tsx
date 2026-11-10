// Portfolio 4 · CTA Band (custom brief).
// - 차콜 배경 제목 + 왼쪽 안내 문구 / 오른쪽 CTA 2개(Start your project → /contact, Download brief template). lg 미만은 세로로 쌓는다
// - Download brief template: public/downloads의 Excel 브리프 양식을 정적 파일로 바로 내려받는다(파일명 공백은 URL 인코딩)
import { Button, buttonClassName } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Brief template (Figma: same single file as Contact), served as a static file from /public/downloads. */
const BRIEF_TEMPLATE_FILE = "Medidakos_Product Development Brief.xlsx";
const BRIEF_TEMPLATE_URL = `/downloads/${encodeURIComponent(BRIEF_TEMPLATE_FILE)}`;

/** Figma: 4 · CTA Band (custom brief) (772:3322). */
export function PortfolioCtaBand() {
  return (
    <section className="bg-mdk-charcoal py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-16`}>
        <h2 className={cx(DISPLAY_TITLE, "text-mdk-white")}>Have a different product in mind?</h2>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[600px] text-mdk-lead text-mdk-white">
            Share your idea—even if your formula or product specifications aren’t finalized. We’ll review your project
            and guide you through the next steps.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href={ROUTES.contact} variant="primary-inverse">
              Start your project
            </Button>
            {/* Plain <a download>: a static file, so no client routing or prefetch from next/link. */}
            <a href={BRIEF_TEMPLATE_URL} download={BRIEF_TEMPLATE_FILE} className={buttonClassName("secondary-inverse")}>
              Download brief template
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
