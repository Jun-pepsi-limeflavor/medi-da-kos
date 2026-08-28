import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { KoreaCta } from "./KoreaCta";
import { KoreaFaq } from "./KoreaFaq";
import { KoreaPageSignals } from "./KoreaPageSignals";
import { KoreaLeadForm } from "./KoreaLeadForm";
import { StickyFormCta } from "./StickyFormCta";

/**
 * 콜드메일 서명부 링크가 착지하는 페이지.
 *
 * 섹션 순서는 v7 메일 슬롯 순서를 그대로 따른다:
 * 오프닝 → 성분 → 포지셔닝 → 물량 → 낮은 압박 마무리.
 * 성분이 포지셔닝보다 앞선다 — 뒤집으면 회사 소개 페이지가 되고,
 * 피봇 결론("성분을 미끼로 던진 뒤 제조 역량을 붙인다")과 어긋난다.
 */
const META_DESCRIPTION =
  "Send one spec, or just the idea. Our production team comes back within a week with feasibility, MOQ, unit cost, and lead time.";

export const metadata: Metadata = {
  title: "Your next line, made in Korea",
  description: META_DESCRIPTION,
  // 콜드메일 수신자만 보는 페이지 — 검색 유입을 받을 이유가 없고,
  // 기존 페이지와 중복 콘텐츠로 잡힐 이유도 없다.
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/landing/korea` },
  // 루트 layout의 keywords·openGraph·twitter가 그대로 상속되면
  // 이 페이지 <head>에 "ISO 22716 GMP certified" · "MOQ from 3,000 units"가 남는다.
  // og:description은 링크를 슬랙·링크드인에 붙였을 때 미리보기로 실제로 읽히는 문장이라
  // 본문에서 지운 주장이 거기서 되살아난다. 전부 여기서 덮어쓴다.
  keywords: [],
  openGraph: {
    title: "Your next line, made in Korea",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/landing/korea`,
    images: [],
  },
  twitter: {
    title: "Your next line, made in Korea",
    description: META_DESCRIPTION,
    images: [],
  },
};

/**
 * utm_content로 갈리는 유일한 블록. 이 문단 외에는 arm 사이에 차이가 없어야 한다
 * (title·description·OG 포함) — 그래야 A/B가 포지셔닝 하나만 측정한다.
 */
const POSITIONING = {
  "arm-a":
    "Medi Da Kos is a Korean manufacturing agency for beauty brands — we hold the factory relationships, and our team runs formulation, QC, packaging, and export to your door from one place.",
  "arm-b":
    "We develop and produce in Korea — formulation, QC, packaging, and export to your door, run out of one place.",
} as const;

type Arm = keyof typeof POSITIONING;

/**
 * 정확히 "arm-a"가 아니면 전부 arm-b.
 * 카테고리 명사 자기규정은 기본 금지이고 arm-a는 한시 예외라,
 * 출처 불명 트래픽은 기본 정책 쪽에 떨어져야 한다.
 * 2차 접촉(utm_content=followup-1)도 이 규칙으로 자동 처리된다.
 */
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
  sub: "Send one spec — or just the idea — and our production team comes back within a week with feasibility, MOQ, unit cost, and lead time.",
  note: "Or read on first. The form is at the bottom, and it's the only thing on this page to do.",
} as const;

const FORMULAS = [
  {
    name: "PDRN",
    kicker: "Anti-aging serums, ampoules, repair lines",
    body: "A PDRN line is the one most brands are being asked about right now — we can run that formula for you. PDRN showed up in eye formats early, so an eye serum is a natural second SKU next to what you already sell.",
    wide: true,
  },
  {
    name: "Encapsulated retinol",
    kicker: "Wrinkle and firming creams, night creams",
    body: "If a retinol line is on your roadmap, encapsulated retinol is where the formulation work sits — we run those.",
    wide: false,
  },
  {
    name: "Retinal",
    kicker: "Wrinkle and firming, with Europe on the map",
    body: "If Europe is on your map, retinal sits outside the EU retinol cap — worth speccing that way from the start.",
    wide: false,
  },
  {
    name: "Centella asiatica",
    kicker: "Sensitive skin and barrier lines",
    body: "Centella keeps showing up in reformulations worldwide — we can build a barrier line around it.",
    wide: false,
  },
  {
    name: "Plant-derived PDRN",
    kicker: "Vegan and clean-beauty positioning",
    body: "There's a plant-derived route to PDRN if animal-derived is off the table for you. It's a different input with a different profile, so we'd spec it as its own line rather than a swap.",
    wide: false,
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

const eyebrowClass =
  "text-sm font-semibold uppercase tracking-[0.18em] text-sky-500";
const sectionClass = "mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20";
const h2Class =
  "mt-3 font-serif text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl";
const cardClass =
  "rounded-2xl border border-sky-100/90 bg-white/85 p-6 shadow-md shadow-sky-100/35";
const ctaClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600 sm:w-auto";

export default async function KoreaLandingPage({
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

  return (
    <>
      <KoreaPageSignals arm={arm} />

      {/* §1 히어로 — 메일 제목 "A note from Korea about your next line"과 톤을 맞춘다 */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28" data-section="hero">
        <p className={eyebrowClass}>{HERO.eyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-serif text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          {HERO.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          {HERO.sub}
        </p>
        <div className="mt-8">
          <KoreaCta ctaId="hero" className={ctaClass}>
            Send one spec
          </KoreaCta>
        </div>
        <p className="mt-3 text-sm text-slate-500">{HERO.note}</p>
      </section>

      {/* §2 성분 — 자기소개보다 앞. 계속 읽을 이유를 먼저 준다 */}
      <section className={sectionClass} data-section="formulas">
        <p className={eyebrowClass}>Where we&apos;d start</p>
        <h2 className={h2Class}>Five formulas we can run for you.</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Pick the one closest to what you already sell. If none of them is it,
          the formula you already have is fine to send.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FORMULAS.map((formula) => (
            <div
              key={formula.name}
              className={`${cardClass} ${formula.wide ? "sm:col-span-2" : ""}`}
            >
              <p className="font-serif text-lg font-semibold text-slate-800">
                {formula.name}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-sky-600">
                {formula.kicker}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {formula.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Send whichever one you want quoted. If we can&apos;t run it as
          written, we&apos;ll say so.
        </p>
      </section>

      {/* §3 포지셔닝 — utm_content로 갈리는 유일한 블록. 제목을 일부러 안 단다 */}
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8" data-section="positioning">
        <div className="rounded-2xl border border-sky-100/90 bg-sky-50/40 px-6 py-10 text-center shadow-sm shadow-sky-100/30 sm:px-10">
          <p className="mx-auto max-w-3xl font-serif text-xl leading-relaxed text-slate-800 sm:text-2xl">
            {POSITIONING[arm]}
          </p>
        </div>
      </section>

      {/* §4 진행 방식 — 포지셔닝의 동사를 관찰 가능한 행동으로 */}
      <section className={sectionClass} data-section="steps">
        <p className={eyebrowClass}>How a project runs</p>
        <h2 className={h2Class}>Four steps, and the first one is yours.</h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-sky-100/90 bg-white/85 p-6 shadow-sm shadow-sky-100/30"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-700">
                {index + 1}
              </span>
              <p className="mt-4 text-base font-semibold text-slate-800">
                {step.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* §5 견적 전 확인 — 의심이 최고조인 지점을 흡수한다 */}
      <section className={sectionClass} data-section="checks">
        <p className={eyebrowClass}>Before we quote</p>
        <h2 className={h2Class}>
          Three things we settle before a number goes out.
        </h2>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {CHECKS.map((check) => (
            <div key={check.title} className={cardClass}>
              <p className="text-base font-semibold text-slate-800">
                {check.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {check.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* §6 물량 — 1만 개 필터. 거절이 아니라 자격 안내로 읽히게 성분 뒤에 둔다 */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" data-section="volume">
        <p className={eyebrowClass}>Volume</p>
        <h2 className={h2Class}>The range we&apos;re set up to run.</h2>
        <p className="mt-6 font-serif text-xl leading-relaxed text-slate-800 sm:text-2xl">
          {VOLUME.lead}
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          {VOLUME.follow}
        </p>
      </section>

      {/* §7 정직 카드 — 필터가 쓴 신뢰를 되산다 */}
      <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8" data-section="honesty">
        <div className="rounded-2xl border border-sky-100/90 bg-sky-50/40 p-6 text-center shadow-sm shadow-sky-100/30">
          <p className="font-serif text-lg leading-relaxed text-slate-800 sm:text-xl">
            {HONESTY}
          </p>
        </div>
      </section>

      {/* §8 폼 — 이 페이지의 유일한 전환 장치 */}
      <section
        id="brief"
        data-section="brief"
        className="mx-auto max-w-2xl scroll-mt-8 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
          Send one spec.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Or just the idea. Either is enough to price.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          No call needed, and nothing to sign.
        </p>

        <div className="mt-8">
          <KoreaLeadForm positioningArm={arm} utm={utm} />
        </div>
      </section>

      {/* §9 FAQ — 뒤로가기가 될 반론 회수 */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20" data-section="faq">
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
          Before you send it.
        </h2>
        <div className="mt-8">
          <KoreaFaq />
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Still the wrong question answered? Put it in the message box — the
          form takes plain sentences.
        </p>
      </section>

      {/* §10 서명 마무리 — 발신 계정이 둘이라 두 이름을 같이 쓴다 */}
      <section className="mx-auto max-w-2xl px-4 pb-20 text-center sm:px-6 lg:px-8 lg:pb-28" data-section="closing">
        <p className="font-serif text-xl leading-relaxed text-slate-800">
          {CLOSING.thanks}
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          {CLOSING.body}
        </p>
        <div className="mt-8">
          <KoreaCta ctaId="closing" className={ctaClass}>
            Send one spec
          </KoreaCta>
        </div>
        <p className="mt-8 text-sm text-slate-500">— {CLOSING.signature}</p>
      </section>

      <StickyFormCta />
    </>
  );
}
