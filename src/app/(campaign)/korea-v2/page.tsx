import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { KoreaCta } from "../korea/KoreaCta";
import { KoreaFaq } from "../korea/KoreaFaq";
import { KoreaPageSignals } from "../korea/KoreaPageSignals";
import { KoreaLeadForm } from "../korea/KoreaLeadForm";
import { StickyFormCta } from "../korea/StickyFormCta";
import { FormulaCarousel } from "./FormulaCarousel";
import { Reveal } from "./Reveal";
import "./korea-v2.css";

/**
 * /korea의 디자인 판 2. 콜드메일 서명부 링크가 착지하는 페이지.
 *
 * v1과 **본문 문장이 같다.** 바뀐 것은 레이아웃·서체·색과 성분 섹션의 형태뿐이다.
 * 카피까지 같이 손대면 반응 차이가 디자인 때문인지 문장 때문인지 못 가린다.
 *
 * 섹션 순서도 v1을 그대로 따른다 (오프닝 → 성분 → 포지셔닝 → 물량 → 마무리).
 * `section_view`의 `section_id` 값이 같아야 두 판을 나란히 비교할 수 있다.
 *
 * 톤은 dyou.co에서 실측한 값을 옮겼다 — 표제 서체는 유료 Lemonde 대신
 * 같은 디돈 계열 Instrument Serif, 본문은 Montserrat.
 */
const META_DESCRIPTION =
  "Send one spec, or just the idea. Our production team comes back within a week with feasibility, MOQ, unit cost, and lead time.";

export const metadata: Metadata = {
  title: "Your next line, made in Korea",
  description: META_DESCRIPTION,
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/korea-v2` },
  keywords: [],
  openGraph: {
    title: "Your next line, made in Korea",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/korea-v2`,
    images: [],
  },
  twitter: {
    title: "Your next line, made in Korea",
    description: META_DESCRIPTION,
    images: [],
  },
};

const POSITIONING = {
  "arm-a":
    "Medi Da Kos is a Korean manufacturing agency for beauty brands — we hold the factory relationships, and our team runs formulation, QC, packaging, and export to your door from one place.",
  "arm-b":
    "We develop and produce in Korea — formulation, QC, packaging, and export to your door, run out of one place.",
} as const;

type Arm = keyof typeof POSITIONING;

function resolveArm(raw: string | string[] | undefined): Arm {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "arm-a" ? "arm-a" : "arm-b";
}

function firstValue(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value : undefined;
}

const HERO = {
  eyebrow: "A note from Korea",
  title: "Getting your next line made in Korea.",
  emphasis: "next line",
  sub: "Send one spec — or just the idea — and our production team comes back within a week with feasibility, MOQ, unit cost, and lead time.",
  note: "Or read on first. The form is at the bottom, and it's the only thing on this page to do.",
} as const;

/**
 * 사진은 제형 텍스처 컷이다. 완제품 사진을 쓰지 않는 이유 — 우리가 만드는 건
 * 남의 브랜드 제품이라, 우리 페이지에 병을 세우면 우리 라인처럼 읽힌다.
 * alt는 사진에 보이는 것만 적는다. 효능을 alt에 적으면 검증 못 하는 주장이 된다.
 */
const FORMULAS = [
  {
    name: "PDRN",
    kicker: "Anti-aging serums, ampoules, repair lines",
    body: "A PDRN line is the one most brands are being asked about right now — we can run that formula for you. PDRN showed up in eye formats early, so an eye serum is a natural second SKU next to what you already sell.",
    image: "/korea-v2/formula-pdrn.jpg",
    alt: "A pink gel swatch on a pink background.",
  },
  {
    name: "Encapsulated retinol",
    kicker: "Wrinkle and firming creams, night creams",
    body: "If a retinol line is on your roadmap, encapsulated retinol is where the formulation work sits — we run those.",
    image: "/korea-v2/formula-encapsulated-retinol.jpg",
    alt: "Shavings of a pale cream balm on a pink background.",
  },
  {
    name: "Retinal",
    kicker: "Wrinkle and firming, with Europe on the map",
    body: "If Europe is on your map, retinal sits outside the EU retinol cap — worth speccing that way from the start.",
    image: "/korea-v2/formula-retinal.jpg",
    alt: "A clear gel droplet spread on a grey background.",
  },
  {
    name: "Centella asiatica",
    kicker: "Sensitive skin and barrier lines",
    body: "Centella keeps showing up in reformulations worldwide — we can build a barrier line around it.",
    image: "/korea-v2/formula-centella.jpg",
    alt: "A teal-tinted gel droplet on a grey background.",
  },
  {
    name: "Plant-derived PDRN",
    kicker: "Vegan and clean-beauty positioning",
    body: "There's a plant-derived route to PDRN if animal-derived is off the table for you. It's a different input with a different profile, so we'd spec it as its own line rather than a swap.",
    image: "/korea-v2/formula-plant-pdrn.jpg",
    alt: "Two strokes of a golden gel with suspended particles on a sand background.",
  },
] as const;

const STEPS = [
  {
    title: "You send one spec.",
    body: "Or the idea, if the spec isn't written yet.",
  },
  {
    title: "Our production team reviews it and prices it.",
    body: "Formula, format, packaging — all three, not just the bulk.",
  },
  {
    title: "You get an answer within a week.",
    body: "Feasibility, MOQ, unit cost, and lead time, in writing.",
  },
  {
    title: "If you go ahead, we run it.",
    body: "Formulation, QC, packaging, and export to your door.",
  },
] as const;

const CHECKS = [
  {
    title: "The packaging minimum",
    body: "Bulk formula minimums in Korea can start around 500 units. Packaging minimums start around 5,000. That gap is why quotes come back at numbers nobody asked for. We put the packaging minimum in the spec from day one, not as a surprise later.",
  },
  {
    title: "The regulator's own list",
    body: "Korea's Ministry of Food and Drug Safety publishes which cosmetics facilities hold CGMP status, and which part of the process it covers. We check our partner facilities against that published list. When your project has a facility attached, we'll tell you what the list says about that one — including where it says nothing.",
  },
  {
    title: "Samples",
    body: "There's no minimum on samples. If you want to hold the thing before you commit to a run, say so and we'll treat it as its own step.",
  },
] as const;

const VOLUME = {
  lead: "Ten thousand units and up is the range we're set up to run, so a new line doesn't have to start as a small test.",
  follow:
    "If you're not there yet, put that on the form anyway. We'd rather know now than build a quote around a number that was never yours.",
} as const;

const HONESTY =
  "And if it isn't a fit — wrong volume, wrong formula — we'll say so plainly. If we can't run it, we'll say that too.";

const CLOSING = {
  thanks: "Thank you for what you've built.",
  body: "We'd rather look at one real spec than send you a brochure. Send it whenever it suits.",
  signature: "Hally Kim and Thomas Lee, Medi Da Kos",
} as const;

/*
 * 톤 토큰 (dyou.co 실측).
 *   표제  #2A6DCB · Instrument Serif · 자간 -0.05em · 행간 1.0
 *   본문  #68809A · Montserrat 18px
 *   면    흰 바탕 + #F5F7FF 패널. 카드 모서리 4px, 패널 24px, 그림자 없음
 *   버튼  완전 pill. 솔리드 #2A6DCB / 아웃라인 #A7C5EE
 * 카드는 각지고 버튼만 둥근 대비가 이 톤의 핵심이라 radius를 섞지 않는다.
 */
const eyebrowClass = "font-body-alt text-sm text-[#2A6DCB]";
const sectionClass = "mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24";
const h2Class =
  "mt-4 font-display text-[40px] leading-none tracking-[-0.05em] text-[#2A6DCB] sm:text-[48px]";
const bodyClass = "font-body-alt text-base leading-relaxed text-[#68809A]";
const panelClass = "rounded-3xl bg-[#F5F7FF] px-6 py-12 sm:px-10";
const cardClass = "rounded-[4px] bg-[#F5F7FF] p-7";
const ctaClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2A6DCB] px-8 py-3.5 font-body-alt text-base text-white transition hover:bg-[#254F79] sm:w-auto";

export default async function KoreaLandingPageV2({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const arm = resolveArm(params.utm_content);

  const utm = {
    utmSource: firstValue(params.utm_source),
    utmMedium: firstValue(params.utm_medium),
    utmCampaign: firstValue(params.utm_campaign),
    utmContent: firstValue(params.utm_content),
    utmTerm: firstValue(params.utm_term),
  };

  const [headBefore, headAfter] = HERO.title.split(HERO.emphasis);

  return (
    <div className="bg-white">
      <KoreaPageSignals arm={arm} variant="v2" />

      {/* §1 히어로 — 표제 안 한 단어만 이탤릭으로 눌러준다 (dyou의 <shade> 자리) */}
      <section
        className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
        data-section="hero"
      >
        <Reveal as="p" className={eyebrowClass}>
          {HERO.eyebrow}
        </Reveal>
        <Reveal
          as="h1"
          delay={80}
          className="mt-4 max-w-4xl font-display text-[44px] leading-[1.05] tracking-[-0.05em] text-[#2A6DCB] sm:text-[64px]"
        >
          {headBefore}
          <em className="italic">{HERO.emphasis}</em>
          {headAfter}
        </Reveal>
        <Reveal
          as="p"
          delay={160}
          className="mt-8 max-w-2xl font-body-alt text-lg leading-relaxed text-[#68809A]"
        >
          {HERO.sub}
        </Reveal>
        <Reveal delay={240} className="mt-10">
          <KoreaCta ctaId="hero" className={ctaClass}>
            Send one spec
          </KoreaCta>
        </Reveal>
        <Reveal
          as="p"
          delay={300}
          className="font-body-alt mt-4 text-sm text-[#68809A]/70"
        >
          {HERO.note}
        </Reveal>
      </section>

      {/* §2 성분 — 자기소개보다 앞. 가로 캐러셀이 v1과 갈리는 지점이다 */}
      <section className={sectionClass} data-section="formulas">
        <Reveal as="p" className={eyebrowClass}>
          Where we&apos;d start
        </Reveal>
        <Reveal as="h2" delay={80} className={h2Class}>
          Five formulas we can <em className="italic">run</em> for you.
        </Reveal>
        <Reveal as="p" delay={140} className={`mt-6 max-w-2xl ${bodyClass}`}>
          Pick the one closest to what you already sell. If none of them is it,
          the formula you already have is fine to send.
        </Reveal>

        {/* 캐러셀은 리빌로 감싸지 않는다 — 안쪽 카드가 자기 리듬으로 들어오고,
            바깥이 같이 움직이면 가로 스크롤 위치가 첫 프레임에 흔들린다. */}
        <div className="mt-12">
          <FormulaCarousel formulas={FORMULAS} />
        </div>

        <Reveal
          as="p"
          className="font-body-alt mt-6 text-sm text-[#68809A]/70"
        >
          Send whichever one you want quoted. If we can&apos;t run it as
          written, we&apos;ll say so.
        </Reveal>
      </section>

      {/* §3 포지셔닝 — utm_content로 갈리는 유일한 블록. 제목을 일부러 안 단다 */}
      <section
        className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"
        data-section="positioning"
      >
        <Reveal className={`${panelClass} text-center`}>
          <p className="mx-auto max-w-3xl font-display text-[28px] leading-[1.15] tracking-[-0.03em] text-[#2A6DCB] sm:text-[32px]">
            {POSITIONING[arm]}
          </p>
        </Reveal>
      </section>

      {/* §4 진행 방식 — 포지셔닝의 동사를 관찰 가능한 행동으로 */}
      <section className={sectionClass} data-section="steps">
        <Reveal as="p" className={eyebrowClass}>
          How a project runs
        </Reveal>
        <Reveal as="h2" delay={80} className={h2Class}>
          Four steps, and the first one is yours.
        </Reveal>

        <div className="mt-12 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            // 순서대로 들어오게 벌린다. 네 장이라 80ms면 마지막이 320ms —
            // 이보다 벌리면 늦게 오는 카드가 고장처럼 보인다.
            <Reveal key={step.title} delay={index * 80} className={cardClass}>
              <span className="font-body-alt text-sm text-[#2A6DCB]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-body-alt mt-6 text-base font-medium text-[#254F79]">
                {step.title}
              </p>
              <p className="font-body-alt mt-3 text-sm leading-relaxed text-[#68809A]">
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* §5 견적 전 확인 — 의심이 최고조인 지점을 흡수한다 */}
      <section className={sectionClass} data-section="checks">
        <Reveal as="p" className={eyebrowClass}>
          Before we quote
        </Reveal>
        <Reveal as="h2" delay={80} className={h2Class}>
          Three things we settle before a number goes out.
        </Reveal>

        <div className="mt-12 grid gap-2 lg:grid-cols-3">
          {CHECKS.map((check, index) => (
            <Reveal key={check.title} delay={index * 80} className={cardClass}>
              <p className="font-display text-[26px] leading-tight tracking-[-0.04em] text-[#2A6DCB]">
                {check.title}
              </p>
              <p className="font-body-alt mt-4 text-sm leading-relaxed text-[#68809A]">
                {check.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* §6 물량 — 1만 개 필터. 거절이 아니라 자격 안내로 읽히게 성분 뒤에 둔다 */}
      <section
        className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
        data-section="volume"
      >
        <Reveal as="p" className={eyebrowClass}>
          Volume
        </Reveal>
        <Reveal as="h2" delay={80} className={h2Class}>
          The range we&apos;re set up to run.
        </Reveal>
        <Reveal
          as="p"
          delay={140}
          className="mt-8 font-display text-[26px] leading-tight tracking-[-0.03em] text-[#2A6DCB] sm:text-[30px]"
        >
          {VOLUME.lead}
        </Reveal>
        <Reveal as="p" delay={200} className={`mt-6 ${bodyClass}`}>
          {VOLUME.follow}
        </Reveal>
      </section>

      {/* §7 정직 카드 — 필터가 쓴 신뢰를 되산다 */}
      <section
        className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8"
        data-section="honesty"
      >
        <Reveal className={`${panelClass} text-center`}>
          <p className="mx-auto max-w-2xl font-display text-[24px] leading-snug tracking-[-0.03em] text-[#2A6DCB] sm:text-[28px]">
            {HONESTY}
          </p>
        </Reveal>
      </section>

      {/* §8 폼 — 이 페이지의 유일한 전환 장치 */}
      <section
        id="brief"
        data-section="brief"
        className="mx-auto max-w-2xl scroll-mt-8 px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
      >
        <Reveal
          as="h2"
          className="font-display text-[40px] leading-none tracking-[-0.05em] text-[#2A6DCB] sm:text-[48px]"
        >
          Send one spec.
        </Reveal>
        <Reveal as="p" delay={80} className={`mt-6 ${bodyClass}`}>
          Or just the idea. Either is enough to price.
        </Reveal>
        <Reveal
          as="p"
          delay={120}
          className="font-body-alt mt-2 text-sm text-[#68809A]/70"
        >
          No call needed, and nothing to sign.
        </Reveal>

        {/* 폼 자체는 리빌하지 않는다 — 입력 칸이 뒤늦게 올라오면 누르려던 손이 빗나간다. */}
        <div className="mt-10">
          <KoreaLeadForm positioningArm={arm} utm={utm} />
        </div>
      </section>

      {/* §9 FAQ — 뒤로가기가 될 반론 회수 */}
      <section
        className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"
        data-section="faq"
      >
        <Reveal
          as="h2"
          className="font-display text-[40px] leading-none tracking-[-0.05em] text-[#2A6DCB] sm:text-[48px]"
        >
          Before you send it.
        </Reveal>
        <div className="mt-10">
          <KoreaFaq />
        </div>
        <p className="font-body-alt mt-8 text-sm text-[#68809A]/70">
          Still the wrong question answered? Put it in the message box — the
          form takes plain sentences.
        </p>
      </section>

      {/* §10 서명 마무리 — 발신 계정이 둘이라 두 이름을 같이 쓴다 */}
      <section
        className="mx-auto max-w-2xl px-4 pb-24 text-center sm:px-6 lg:px-8 lg:pb-32"
        data-section="closing"
      >
        <Reveal
          as="p"
          className="font-display text-[32px] leading-tight tracking-[-0.04em] text-[#2A6DCB]"
        >
          {CLOSING.thanks}
        </Reveal>
        <Reveal as="p" delay={80} className={`mt-6 ${bodyClass}`}>
          {CLOSING.body}
        </Reveal>
        <Reveal delay={140} className="mt-10">
          <KoreaCta ctaId="closing" className={ctaClass}>
            Send one spec
          </KoreaCta>
        </Reveal>
        <Reveal
          as="p"
          delay={200}
          className="font-body-alt mt-10 text-sm text-[#68809A]/70"
        >
          — {CLOSING.signature}
        </Reveal>
      </section>

      <StickyFormCta />
    </div>
  );
}
