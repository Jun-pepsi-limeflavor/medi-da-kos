// Services 6 · Quality & Compliance (#quality-compliance).
// - A·B·C 카드 3개(키 원형 배지·제목·체크 목록·하단 설명). lg 이상은 목록 영역 165px로 통일해 하단 구분선 높이를 맞춘다
// - 하단 인증 안내(Notice): 첫 문장 뒤 줄바꿈(md 이상), 좁은 화면은 자연 줄바꿈
import Image from "next/image";
import { ANCHOR_TARGET } from "@/components/services/anchors";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: Cards (A · B · C) (255:453). */
const CARDS = [
  {
    key: "A",
    title: "Partner facility standards",
    items: ["ISO 22716 GMP certified", "MFDS-registered facilities"],
    footer: "Our manufacturing partners’ certificates are reviewed during onboarding and updated regularly.",
  },
  {
    key: "B",
    title: "Product certifications",
    items: ["Halal", "Vegan Society", "Leaping Bunny"],
    footer:
      "Certification options depend on the manufacturer, formula, and product category. We’ll confirm what may be available for your project.",
  },
  {
    key: "C",
    title: "Regulatory & export documents",
    items: ["FDA MoCRA registration & listing docs", "EU CPNP notification docs", "COA", "MSDS", "Certificate of Origin"],
    footer: "We coordinate documentation support for regulatory submissions and export based on your target market.",
  },
] as const;

export function ServicesQualityCompliance() {
  return (
    <section data-services-section="quality-compliance" className="bg-mdk-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <div id="quality-compliance" className={cx(ANCHOR_TARGET, "flex flex-col gap-6")}>
          <p className={EYEBROW}>Quality &amp; compliance</p>
          <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>Regulatory support</h2>
        </div>
        <ul className="grid gap-4 lg:grid-cols-3">
          {CARDS.map(({ key, title, items, footer }) => (
            <li key={key} className="flex flex-col gap-6 rounded-mdk-lg bg-mdk-off-white p-7 sm:p-9">
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-mdk-charcoal text-mdk-label text-mdk-white"
              >
                {key}
              </span>
              <h3 className="text-[22px] leading-7 font-medium tracking-[-0.015em] text-mdk-charcoal">{title}</h3>
              <ul className="flex flex-col gap-2.5 lg:h-[165px]">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-mdk-body text-mdk-charcoal">
                    <Image src="/icons/check.svg" alt="" width={20} height={20} className="shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="border-t border-mdk-light-gray pt-5 text-[15px] leading-[23px] tracking-[-0.002em] text-mdk-charcoal-muted">
                {footer}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-3 rounded-mdk-md bg-mdk-off-white px-6 py-5">
          <Image src="/icons/circle-info.svg" alt="" width={20} height={20} className="mt-0.5 shrink-0" />
          <p className="text-[15px] leading-6 tracking-[-0.002em] text-mdk-charcoal">
            Certifications are held by partner manufacturers or issued for individual products by certification bodies.
            <br className="hidden md:inline" /> Availability depends on the manufacturer, product, and target market.
            We’ll confirm the applicable options for your project.
          </p>
        </div>
      </div>
    </section>
  );
}
