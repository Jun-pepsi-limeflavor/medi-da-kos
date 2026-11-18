// About Us 2 · The Challenge.
// - 왼쪽: Eyebrow·제목·설명 / 오른쪽: 브랜드가 겪는 부담 4개(상단 차콜 구분선)
// - 하단 결론 문장(차콜 구분선 + Heading 44, 가운데 정렬). lg 미만은 한 열로 쌓는다
// - 1440 행간은 Figma 값: 제목 70.6/70.6, 결론 44/50 (공통 제목의 md 행간이 lg까지 이어지지 않게 지정)
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: 2 · The Challenge (422:46). Four points and the closing line are confirmed copy. */
const POINTS = [
  {
    title: "Multiple specialist partners",
    body: "For most products, formulation, component sourcing, packaging, testing, and export are handled by different specialists. The exact partners depend on the product.",
  },
  {
    title: "Different timelines and requirements",
    body: "Each partner has its own schedule, specifications, and communication process.",
  },
  {
    title: "Minimums that don’t line up",
    body: "Product and packaging minimum order quantities may differ, leading to excess inventory or added costs.",
  },
  {
    title: "Everything passes through your team",
    body: "With different partners handling each stage, your team has to keep timelines, approvals, and information aligned from development through export.",
  },
] as const;

export function AboutChallenge() {
  return (
    <section className="bg-mdk-off-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-16 lg:gap-28`}>
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-24">
          <div className="flex flex-col gap-6 lg:w-[552px] lg:shrink-0">
            <p className={EYEBROW}>Our Story</p>
            <h2
              className={cx(
                "text-[40px] leading-[44px] font-semibold tracking-[-0.04em] md:text-[56px] md:leading-[58px]",
                // Below 360px: keep "back-and-forth," on one line (no break at the hyphen).
                "max-[359px]:text-[34px] max-[359px]:leading-[38px]",
                "lg:text-[70.6px] lg:leading-[70.6px]",
                "text-mdk-charcoal",
              )}
            >
              Endless
              <br />
              back-and-forth,
              <br />
              hard to manage
            </h2>
            <div className="flex max-w-[480px] flex-col gap-[30px] text-mdk-lead text-mdk-charcoal">
              <p>
                Developing a cosmetic product in Korea may seem straightforward. In practice, it involves formula
                development, component sourcing, packaging, testing, and export, with each step often handled by a
                different specialist.
              </p>
              <p>
                As a result, overseas brands often have to find and coordinate multiple partners themselves, each with
                its own point of contact, timeline, and requirements.
              </p>
            </div>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col lg:pt-11">
            {POINTS.map(({ title, body }) => (
              <li key={title} className="flex flex-col gap-2.5 border-t border-mdk-charcoal pt-6 pb-7">
                <h3 className="text-[22px] leading-[30px] font-medium tracking-[-0.01em] text-mdk-charcoal lg:text-[28px] lg:leading-9">
                  {title}
                </h3>
                <p className="max-w-[460px] text-mdk-body text-mdk-charcoal-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="border-t border-mdk-charcoal pt-10 text-center text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-mdk-charcoal lg:text-mdk-heading lg:leading-[50px]">
          In the end, you’re left to handle it all.
        </p>
      </div>
    </section>
  );
}
