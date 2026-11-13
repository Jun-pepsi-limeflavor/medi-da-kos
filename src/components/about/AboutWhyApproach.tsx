// About Us 3 · Why Medidakos → Our approach.
// - Why Medidakos: 목적 문장(강조 구문 회색) + 이미지(552×400)·설명 행. 제목 'vendor' → 'partner'(2026.11.11 확정, Figma와 동일)
// - Our approach: 비교 카드 2개(Without = 선 6개 / With = 선 1개, HTML·CSS 도식) + 장점 3개
// - 도식의 선은 장식(aria-hidden), 비교 의미는 카드 제목·메시지 텍스트로 전달
// - 640px 미만: Without은 파트너명 줄바꿈 허용, With는 'Your team / 선 / Medidakos'를 세로로 배치
// - Heading 44 텍스트(Our approach 제목, 도식의 Medidakos)는 Figma 행간 50px
import Image from "next/image";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: Infographic · six separate lines — partners are illustrative examples. */
const PARTNERS = [
  "Manufacturers",
  "Packaging suppliers",
  "Carton suppliers",
  "Testing laboratories",
  "Document review",
  "Shipping & export",
] as const;

const REASONS = [
  {
    title: "End-to-end project management",
    body: "Your project management team manages timelines and keeps each stage on track, from the initial brief through shipment.",
  },
  {
    title: "A vetted partner network",
    body: "Our network includes 300+ partners, vetted for relevant certifications and capabilities. We also coordinate testing, and export specialists as needed.",
  },
  {
    title: "Clear communication in English",
    body: "Your project manager communicates with you in English and coordinates with Korean manufacturing and packaging partners.",
  },
] as const;

const CARD = "flex flex-1 flex-col gap-9 rounded-mdk-lg bg-mdk-off-white p-6 sm:p-10";
const CARD_TITLE = "text-mdk-title text-mdk-charcoal";

function CardMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-mdk-light-gray pt-6">
      <p className={CARD_TITLE}>{title}</p>
      <p className="text-mdk-body text-mdk-charcoal-muted">{body}</p>
    </div>
  );
}

/** Figma: 3 · Why Medidakos → Our Approach (422:88). */
export function AboutWhyApproach() {
  return (
    <section className="bg-mdk-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-24 lg:gap-36`}>
        <div className="flex flex-col gap-10 lg:gap-16">
          <p className={EYEBROW}>Why Medidakos</p>
          <h2 className="text-[36px] leading-[40px] font-semibold tracking-[-0.035em] text-mdk-charcoal md:text-[48px] md:leading-[54px] lg:text-[60px] lg:leading-[66px]">
            A full-service partner,
            <br />
            <span className="text-[#969696]">not just a matching service</span>
          </h2>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-24">
            <div className="relative aspect-[552/400] w-full overflow-hidden rounded-mdk-sm bg-mdk-light-gray lg:w-[552px] lg:shrink-0">
              <Image
                src="/images/about/why-vendor-team.png"
                alt=""
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover object-[85%_50%]"
              />
            </div>
            <p className="max-w-[531px] text-[20px] leading-[30px] tracking-[-0.005em] text-mdk-charcoal lg:text-[25px] lg:leading-[37.5px]">
              Medidakos coordinates the specialist partners behind your product, from formula development and production
              to quality checks and export preparation, and manages them as one project. Your brand works with one
              Medidakos PM team instead of following up with each partner on its own.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-10 lg:gap-14">
          <div className="flex flex-col gap-4">
            <p className={EYEBROW}>Our approach</p>
            <h2 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-mdk-charcoal lg:text-mdk-heading lg:leading-[50px]">
              Every step in one place
            </h2>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className={CARD}>
              <p className={CARD_TITLE}>Without Medidakos</p>
              <ul className="flex flex-col">
                {PARTNERS.map((partner) => (
                  <li key={partner} className="flex h-[52px] items-center gap-3 sm:gap-4">
                    <span className="shrink-0 text-mdk-label text-mdk-charcoal-muted sm:w-[92px]">Your team</span>
                    <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-mdk-mid-gray" />
                    <span className="min-w-0 text-[15px] leading-5 font-medium text-mdk-charcoal sm:w-[190px] sm:shrink-0 sm:text-[18px] sm:leading-6">
                      {partner}
                    </span>
                  </li>
                ))}
              </ul>
              <CardMessage
                title="Multiple separate contacts"
                body="Your team follows up with each partner and coordinates every handoff."
              />
            </div>
            <div className={CARD}>
              <p className={CARD_TITLE}>With Medidakos</p>
              {/* Below sm the one line runs vertically so both labels fit narrow cards. */}
              <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5 lg:min-h-[312px] lg:flex-none">
                <span className="shrink-0 text-[18px] leading-6 font-medium tracking-[-0.01em] text-mdk-charcoal sm:text-[26px] sm:leading-8">
                  Your team
                </span>
                <span aria-hidden="true" className="h-8 w-0.5 bg-mdk-charcoal sm:h-0.5 sm:w-auto sm:min-w-6 sm:flex-1" />
                <span className="shrink-0 text-[28px] leading-[34px] font-semibold tracking-[-0.03em] text-mdk-charcoal sm:text-mdk-heading sm:leading-[50px]">
                  Medidakos
                </span>
              </div>
              <CardMessage
                title="One point of contact"
                body="One dedicated team coordinates your project across all partners."
              />
            </div>
          </div>

          <ul className="flex flex-col gap-8 md:flex-row md:gap-12">
            {REASONS.map(({ title, body }) => (
              <li key={title} className="flex flex-1 flex-col gap-2.5 border-t border-mdk-light-gray pt-6">
                <h3 className="text-mdk-lead text-mdk-charcoal">{title}</h3>
                <p className="text-mdk-body text-mdk-charcoal-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
