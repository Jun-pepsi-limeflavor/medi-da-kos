// FAQ 3 · Contact CTA — Didn't find your answer?
// - 차콜 배경 제목 + 왼쪽 안내 문구 / 오른쪽 Contact Us(→ /contact). lg 미만은 세로로 쌓는다
// - 안내 문구 아래 회신 시간 보조 문구(REPLY_TIME_NOTE, 2026-11-10 확정: 5–7 business days)
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Reply time note (confirmed 2026-11-10; replaces Figma's "[N] business day(s). [Reply time TBD]" placeholder). */
const REPLY_TIME_NOTE: string | null = "Our project management team replies within 5–7 business days.";

/** Figma: 3 · Contact CTA — Didn't find your answer? (290:734). */
export function FaqContactCta() {
  return (
    <section className="bg-mdk-charcoal py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-16`}>
        <h2 className={cx(DISPLAY_TITLE, "max-w-[900px] text-mdk-white")}>Didn&apos;t find your answer?</h2>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-[560px] flex-col gap-2.5">
            <p className="text-mdk-lead text-mdk-white">
              Send us your question — whether it is about MOQ, samples, payment or documents — and our team will get
              back to you.
            </p>
            {REPLY_TIME_NOTE ? (
              <p className="text-[15px] leading-[25px] tracking-[-0.002em] text-mdk-mid-gray">{REPLY_TIME_NOTE}</p>
            ) : null}
          </div>
          <Button href={ROUTES.contact} variant="primary-inverse" className="self-start lg:self-auto">
            Contact Us
          </Button>
        </div>
      </div>
    </section>
  );
}
