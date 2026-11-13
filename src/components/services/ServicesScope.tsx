// Services 2 · Scope (#scope).
// - 제목 + 'Two ways to get started' OEM·ODM 카드 2개(이미지 588×380, 유형 태그, 제목, Start with·We coordinate 행)
// - 두 카드의 행 구분선이 같은 높이에 오도록 'We coordinate' 행 최소 높이 86px(Figma 주석)
// - 이미지는 Figma 레이어 크롭을 비율 고정 프레임 안에서 그대로 적용, lg 미만은 카드를 세로로 쌓는다
import Image from "next/image";
import { ANCHOR_TARGET } from "@/components/services/anchors";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: 2 · Scope (#scope) (254:400). `crop` = image layer box as % of the 588×380 frame. */
const CARDS = [
  {
    type: "OEM",
    title: "Already have a formula?",
    startWith: "Formula and product specifications",
    coordinate: "Production, packaging, QC, export, and more",
    image: "/images/services/scope-oem.png",
    crop: { l: -9.35, t: -11.32, w: 118.71, h: 122.63 },
  },
  {
    type: "ODM",
    title: "Starting with an idea?",
    startWith: "Product concept, target market, and references",
    coordinate: "Product planning, R&D, sampling, and project coordination through export",
    image: "/images/services/scope-odm.png",
    crop: { l: -5.61, t: -7.37, w: 111.22, h: 114.74 },
  },
] as const;

const ROW = "flex flex-col gap-1 border-t border-mdk-light-gray py-4 sm:flex-row sm:gap-6";
const ROW_LABEL = "text-mdk-label text-mdk-charcoal-muted sm:w-[140px] sm:shrink-0";
const ROW_VALUE = "min-w-0 text-[17px] leading-[26px] tracking-[-0.002em] text-mdk-charcoal";

export function ServicesScope() {
  return (
    <section data-services-section="scope" className="bg-mdk-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-[72px]`}>
        <div id="scope" className={cx(ANCHOR_TARGET, "flex flex-col gap-6")}>
          <p className={EYEBROW}>Scope</p>
          <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>Start where you are</h2>
        </div>
        <div className="flex flex-col gap-8">
          <h3 className="text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-mdk-charcoal lg:text-[28px] lg:leading-[34px]">
            Two ways to get started
          </h3>
          <ul className="flex flex-col gap-12 lg:flex-row lg:gap-6">
            {CARDS.map((card) => (
              <li key={card.type} className="flex min-w-0 flex-1 flex-col gap-7">
                <div className="relative aspect-[588/380] w-full overflow-hidden rounded-mdk-lg bg-mdk-light-gray">
                  <div
                    className="absolute"
                    style={{ left: `${card.crop.l}%`, top: `${card.crop.t}%`, width: `${card.crop.w}%`, height: `${card.crop.h}%` }}
                  >
                    <Image src={card.image} alt="" fill sizes="(min-width: 1024px) 700px, 120vw" className="object-cover" />
                  </div>
                </div>
                <div className="flex flex-col items-start gap-5">
                  <span className="rounded-full bg-mdk-charcoal px-3 py-[5px] text-mdk-caption text-mdk-white">{card.type}</span>
                  <h4 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-mdk-charcoal lg:text-[40px] lg:leading-[44px]">
                    {card.title}
                  </h4>
                  <dl className="w-full border-b border-mdk-light-gray">
                    <div className={ROW}>
                      <dt className={ROW_LABEL}>Start with</dt>
                      <dd className={ROW_VALUE}>{card.startWith}</dd>
                    </div>
                    <div className={cx(ROW, "lg:min-h-[86px]")}>
                      <dt className={ROW_LABEL}>We coordinate</dt>
                      <dd className={ROW_VALUE}>{card.coordinate}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
