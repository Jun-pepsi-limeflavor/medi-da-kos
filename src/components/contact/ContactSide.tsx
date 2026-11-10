// Contact 오른쪽 영역 카드(Figma Side 291:808).
// - ContactOffer: Year-end offer 카드(프로모션 기간에만 페이지가 렌더링)
// - ContactSide: What happens next(3단계 + 샘플 정책) · Prefer email? · Visit our FAQ →
// - 두 컴포넌트를 나눈 이유: 1열 화면에서 Year-end offer → 문의 폼 → 나머지 카드 순서로 보이게 하고,
//   xl 이상 2열에서는 페이지 그리드가 두 카드를 오른쪽 열에 쌓는다(배치는 contact/page.tsx)
// - 이메일은 Footer와 같은 FooterEmailLink(메일 앱 열기 + 주소 복사, 클릭 측정 위치 'contact')
import { FooterEmailLink } from "@/components/layout/FooterEmailLink";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import { cx } from "@/lib/utils/cx";

/** Figma: What Happens Next steps (291:821). */
const STEPS = [
  { title: "We review your inquiry", text: "Our team checks your project details." },
  { title: "A project manager follows up", text: "with questions or to schedule a consultation" },
  { title: "Quote & sample plan", text: "We send a quote and sample timeline." },
] as const;

/** Figma: Promo Notice — Year-end offer (291:809). Shown during the promotion only. */
export function ContactOffer({ className }: { className?: string }) {
  return (
    <section aria-label="Year-end offer" className={cx("flex flex-col gap-[25px] rounded-mdk-lg bg-mdk-charcoal p-7 sm:p-8", className)}>
      <p className="text-[14px] leading-5 font-semibold text-mdk-white">Year-end offer</p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold tracking-[-0.04em] text-mdk-white uppercase">
            <span className="text-[72px] leading-[72px] sm:text-[88px] sm:leading-[80px]">10%</span>
            <span className="text-[38px] leading-[72px] font-medium tracking-[-0.02em] sm:text-[46px] sm:leading-[80px]"> off</span>
          </p>
          <p className="text-mdk-label text-mdk-mid-gray">your production quote</p>
        </div>
        <p className="text-[20px] leading-[30px] font-medium tracking-[-0.005em] text-mdk-white">
          Contract signed by
          <br />
          December 31, 2026
        </p>
      </div>
      <p className="text-mdk-body text-mdk-mid-gray">
        Planning your next beauty launch?
        <br />
        Get in touch early.
      </p>
      <div className="flex flex-col gap-1 border-t border-white/16 pt-4 text-mdk-caption">
        <p className="text-mdk-white">Offer terms</p>
        <p className="text-mdk-mid-gray">
          For new clients’ first production contract.
          <br />
          10% off the mass production quote, up to USD 10,000.
          <br />
          Cannot be combined with other offers.
          <br />
          Contract must be signed by December 31, 2026 (KST).
        </p>
      </div>
    </section>
  );
}

/** Figma: Side (sticky) (291:808) below the offer card — What happens next · Prefer email? · FAQ. */
export function ContactSide({ className }: { className?: string }) {
  return (
    <aside aria-label="Contact information" className={cx("flex flex-col gap-6", className)}>
      <section aria-labelledby="contact-next" className="flex flex-col gap-6 rounded-mdk-lg bg-mdk-off-white p-7 sm:p-8">
        <h2 id="contact-next" className="text-mdk-title text-mdk-charcoal">
          What happens next
        </h2>
        <ol className="flex flex-col gap-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-mdk-charcoal text-mdk-caption text-mdk-charcoal">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 pt-1">
                <span className="text-mdk-label text-mdk-charcoal">{step.title}</span>
                <span className="text-mdk-body text-mdk-charcoal-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="border-t border-mdk-light-gray pt-5 text-mdk-caption text-mdk-charcoal-muted">
          Your first sample round is free for up to 3 SKUs.
          <br />
          International shipping is charged separately.
        </p>
      </section>

      <section aria-labelledby="contact-email" className="flex flex-col gap-5 rounded-mdk-lg border border-mdk-light-gray bg-mdk-white p-7 sm:p-8">
        <h2 id="contact-email" className="text-mdk-title text-mdk-charcoal">
          Prefer email?
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="w-[72px] text-mdk-label text-mdk-charcoal-muted">Email</p>
          <FooterEmailLink
            email={SUPPORT_EMAIL}
            location="contact"
            className="text-mdk-body break-all text-mdk-charcoal hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
          />
        </div>
      </section>

      <Button href={ROUTES.faq} variant="secondary" className="self-start">
        Visit our FAQ →
      </Button>
    </aside>
  );
}
