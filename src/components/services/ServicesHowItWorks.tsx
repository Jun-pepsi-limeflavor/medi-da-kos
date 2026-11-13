// Services 3 · How It Works (#how-it-works).
// - 9단계 진행 절차: 왼쪽 sticky 단계 목록(ServicesStageNav) + 오른쪽 단계 상세(모두 펼침, #stage-01~09)
// - 각 단계: 번호·단계명·절차 문장·보조 설명(회색 안내 문구), 03단계는 'See sample costs →'(#samples-moq)
// - 하단 리드타임 안내와 FAQ 관련 질문 링크. lg 미만은 단계 목록 없이 상세만 표시
import { Button } from "@/components/ui/Button";
import { ANCHOR_TARGET } from "@/components/services/anchors";
import { RelatedQuestions } from "@/components/services/RelatedQuestions";
import { ServicesStageNav } from "@/components/services/ServicesStageNav";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: Stage details (9 · scroll targets) (260:397). Confirmed copy (2026-11-04). */
const STAGES = [
  {
    title: "Inquiry & consultation",
    text: "Share your product idea with us. We’ll review the details and follow up with any questions or to schedule a call.",
    note: "To help us respond faster, please include your product category, target market, estimated first order quantity, and planned launch date.",
  },
  {
    title: "Product requirements review",
    text: "We confirm your product concept, target market, and key requirements to define the next steps.",
    note: "Reference products, a target retail price, and your budget range help us recommend the right manufacturing partner.",
  },
  {
    title: "Formula development & sampling",
    text: "Our lab partners develop or adapt a formula based on your requirements and prepare samples. We coordinate each sample round and gather your feedback.",
    note: "Development or sample fees may apply, even when working from an existing formula. All costs are confirmed with you before sample preparation begins.",
    sampleCosts: true,
  },
  {
    title: "Packaging & testing",
    text: "We source packaging options for your product. Once the formula and packaging are selected, we coordinate the required testing, including compatibility, stability, and microbiological tests.",
    note: "Custom molds, printed packaging samples, and clinical or efficacy tests are quoted separately.",
  },
  {
    title: "Final quote",
    text: "With the formula and packaging specifications confirmed, we prepare a detailed quote for your project.",
    note: "Pricing depends on order quantity, formula, packaging, and decoration. Quotes are valid for a limited period, as raw material and component costs may change.",
  },
  {
    title: "Contract & order confirmation",
    text: "After you approve the quote, we finalize the contract. Once we receive your purchase order (PO), we issue a pro forma invoice (PI). Production is confirmed upon receipt of payment as agreed.",
    note: "Payment terms are set out in the contract. Specifications cannot be changed once production is confirmed without affecting cost and schedule.",
  },
  {
    title: "Production & QC",
    text: "Your order is manufactured by our production partner. We coordinate the production schedule and the agreed quality checks.",
    note: "Lead times usually run 4–6 months from order confirmation, depending on project complexity and component availability.",
  },
  {
    title: "Export documents",
    text: "We prepare and review the required export documents based on your destination market’s requirements.",
    note: "Product registration in your market remains the brand owner’s responsibility.",
  },
  {
    title: "Shipping & delivery",
    text: "We arrange shipping according to the agreed terms. Under FOB terms, your nominated forwarder handles international freight.",
    note: "Import duties, taxes, and customs clearance at the destination are the buyer’s responsibility unless otherwise agreed.",
  },
].map((stage, i) => {
  const number = String(i + 1).padStart(2, "0");
  return { ...stage, id: `stage-${number}`, number };
});

export function ServicesHowItWorks() {
  return (
    <section data-services-section="how-it-works" className="bg-mdk-off-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <div id="how-it-works" className={cx(ANCHOR_TARGET, "flex max-w-[856px] flex-col gap-6")}>
          <p className={EYEBROW}>How it works</p>
          <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>Your project, step by step</h2>
          <p className="max-w-[760px] text-mdk-lead text-mdk-charcoal">
            See what to expect at every stage, from your first inquiry to delivery.
          </p>
        </div>

        <div className="flex items-start gap-24">
          <ServicesStageNav stages={STAGES.map(({ id, number, title }) => ({ id, number, title }))} />
          <ol className="min-w-0 flex-1">
            {STAGES.map((stage, i) => (
              <li
                key={stage.id}
                id={stage.id}
                className={cx(
                  "flex scroll-mt-[124px] flex-col items-start gap-8 lg:scroll-mt-[148px]",
                  i === 0 ? "pb-10 lg:pb-14" : "border-t border-mdk-light-gray py-10 lg:py-14",
                )}
              >
                <div className="flex flex-col gap-2.5">
                  <p className="text-mdk-label text-mdk-charcoal-muted">{stage.number}</p>
                  <h3 className="text-[28px] leading-[34px] font-semibold tracking-[-0.025em] text-mdk-charcoal lg:text-[36px] lg:leading-[42px]">
                    {stage.title}
                  </h3>
                </div>
                <div className="flex flex-col gap-2.5 border-l-2 border-mdk-charcoal pl-6">
                  <p className="text-[19px] leading-[28px] font-medium tracking-[-0.01em] text-mdk-charcoal lg:text-[22px] lg:leading-[31px]">
                    {stage.text}
                  </p>
                  <p className="text-[15px] leading-[22px] tracking-[-0.002em] text-mdk-charcoal-muted">{stage.note}</p>
                </div>
                {"sampleCosts" in stage ? (
                  <Button href="#samples-moq" variant="secondary" size="s">
                    See sample costs →
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <p className="max-w-[900px] text-[15px] leading-6 tracking-[-0.002em] text-mdk-charcoal-muted">
          Lead times are estimates and vary by product, formula, packaging, order quantity, and partner availability.
          <br className="hidden md:inline" /> We’ll confirm your project timeline with you.
        </p>
        <RelatedQuestions
          items={[
            { id: "faq-030", question: "How does the development-to-delivery process work?" },
            { id: "faq-029", question: "How long does it take from development to launch?" },
          ]}
        />
      </div>
    </section>
  );
}
