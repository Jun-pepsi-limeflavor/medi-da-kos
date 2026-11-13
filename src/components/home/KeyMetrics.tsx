// Home 2 · Key Metrics.
// - 큰 지표 숫자와 설명 3행(위·아래 구분선), 모바일은 설명을 숫자 아래로 내린다
import { SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: 2 · Key Metrics (234:5317). Values are the confirmed copy in the final frame. */
const METRICS = [
  { value: "300+", label: "Manufacturing & Packaging Partners" },
  { value: "200+", label: "Beauty Brands Served" },
  { value: "End-to-End", label: "Project Coordination" },
] as const;

export function KeyMetrics() {
  return (
    <section className="bg-mdk-white pt-16 pb-20 lg:pt-[118px] lg:pb-[134px]">
      <div className={SECTION_CONTAINER}>
        <dl className="border-b border-mdk-light-gray text-mdk-charcoal">
          {METRICS.map(({ value, label }) => (
            <div
              key={value}
              className="flex flex-col gap-2 border-t border-mdk-light-gray py-8 md:flex-row md:items-baseline md:justify-between md:gap-6 lg:py-11"
            >
              <dt className="order-2 text-mdk-lead font-medium md:w-[360px] md:shrink-0">{label}</dt>
              <dd className="order-1 text-[56px] leading-[56px] font-semibold tracking-[-0.045em] md:text-[clamp(56px,7.8vw,112px)] md:leading-[0.93]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
