// Services 5 · Payment & Shipping (#payment-shipping).
// - 결제·배송 조건 4개(2×2, 상단 차콜 구분선)와 관련 질문. md 미만은 한 열
import { ANCHOR_TARGET } from "@/components/services/anchors";
import { RelatedQuestions } from "@/components/services/RelatedQuestions";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: Terms (2×2) (255:430). */
const TERMS = [
  {
    label: "R&D payment",
    value: ["Sample development begins once payment for any applicable R&D and shipping fees has been received."],
  },
  {
    label: "Production payment",
    value: ["Full payment is due before production begins. Deposit terms for large-volume orders may be agreed separately."],
  },
  { label: "Shipping terms", value: ["Shipping arrangements follow the Incoterm agreed for each order."] },
  {
    label: "Payment methods",
    value: ["Sample development: SWIFT bank transfer or PayPal", "Production orders: SWIFT bank transfer only"],
  },
] as const;

export function ServicesPaymentShipping() {
  return (
    <section data-services-section="payment-shipping" className="bg-mdk-off-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <div id="payment-shipping" className={cx(ANCHOR_TARGET, "flex flex-col gap-6")}>
          <p className={EYEBROW}>Payment &amp; shipping</p>
          <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>Payment &amp; shipping at a glance</h2>
        </div>
        <dl className="grid gap-10 md:grid-cols-2">
          {TERMS.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-3 border-t border-mdk-charcoal pt-6">
              <dt className="text-mdk-label text-mdk-charcoal-muted">{label}</dt>
              <dd className="text-[20px] leading-7 tracking-[-0.015em] text-mdk-charcoal lg:text-[22px] lg:leading-[30px]">
                {value.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <RelatedQuestions
          items={[
            { id: "faq-020", question: "What are your payment terms and methods?" },
            { id: "faq-036", question: "How do export, shipping, and customs work?" },
          ]}
        />
      </div>
    </section>
  );
}
