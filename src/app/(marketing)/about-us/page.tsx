import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SplitHeroBrand } from "@/components/marketing/SplitHeroBrand";

const NETWORK_STATS = [
  // TODO: replace with verified figure
  { value: "300+", label: "Certified manufacturing partners" },
  // TODO: replace with verified figure
  {
    value: "40%+",
    label: "Lower unit cost ",
  },
  // TODO: replace with verified figure
  { value: "2-3 weeks", label: "Brief to first sample, typical timeline" },
] as const;

const SCREENING_CRITERIA = [
  "MFDS-registered facility (Korean Ministry of Food and Drug Safety)",
  "ISO 22716 GMP certified",
  "Minimum 3 years active cosmetics export history",
  "English-language documentation capability",
  "Demonstrated on-time delivery track record",
  "Category-specific formulation capability verified per brief",
] as const;

const WHY_KOREA = [
  {
    title: "Formulation depth",
    body: "Korean R&D labs have spent decades engineering textures, delivery systems, and active profiles that perform at the standard US prestige retail demands. The same factories supplying leading K-beauty brands at Sephora and Ulta are accessible through this platform.",
  },
  {
    title: "Export-ready compliance",
    body: "Your partner factories have active export experience to the US, EU, and GCC markets. FDA MoCRA registration, EU CPNP filing, and ISO 22716 GMP are standard, not exceptions.",
  },
  {
    title: "Competitive unit economics",
    body: "Factory-direct pricing through a platform-managed brief removes the intermediary markup typical of traditional import agents. Brands typically see 30-50% lower unit costs versus comparable US contract manufacturing.",
  },
  {
    title: "KORUS FTA trade terms",
    body: "Under the US-Korea Free Trade Agreement, most cosmetic product categories enter the US at 0% import duty. Your logistics partner confirms HS codes, and your PM flags the relevant classifications upfront.",
    note: "Tariff terms are subject to change. Confirm current rates with your customs broker.",
  },
] as const;

const CERTIFICATIONS = [
  "FDA (MoCRA)",
  "EU CPNP",
  "ISO 22716 GMP",
  "MFDS",
  "Halal",
  "Vegan Society",
  "Leaping Bunny",
] as const;

const RESPONSIBILITIES = [
  {
    step: "01",
    title: "You",
    items: [
      "Submit your brief on the dashboard",
      "Evaluate physical samples",
      "Approve formula and packaging",
      "Confirm the purchase order",
    ],
  },
  {
    step: "02",
    title: "Your PM",
    items: [
      "Reviews your brief and matches a manufacturer",
      "Coordinates formula development and sampling",
      "Manages all factory communication in English",
      "Oversees compliance documentation",
    ],
  },
  {
    step: "03",
    title: "Partner factory",
    items: [
      "Develops and produces the formula",
      "Conducts batch QC and pre-shipment inspection",
      "Issues COA, MSDS, and export documentation",
      "Ships finished goods to your warehouse",
    ],
  },
] as const;

export default function AboutUsPage() {
  return (
    <div className="bg-white">
      <section className="relative -mt-16 h-[100dvh] min-h-[600px] w-full overflow-hidden bg-sky-50">
        <Image
          src="/About_Us1.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        <div className="absolute inset-0 z-10 flex w-full items-center justify-center">
          <SplitHeroBrand
            title="Medi Da Kos"
            leftTagline="Beauty engineered to perform. Built to scale."
            rightTagline="Beauty engineered to perform. Built to scale."
          />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
      </section>

      <section className="bg-gradient-to-b from-sky-50/65 via-white to-white/95">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">
            About Medi Da Kos
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
            The fastest path from brief to certified Korean OEM/ODM - without
            sourcing a factory yourself.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Medi Da Kos connects US beauty brands with a pre-vetted network of
            Korean manufacturers. We manage formula development, sampling,
            compliance, and freight so your team stays focused on brand, not
            supply chain.
          </p>
        </div>

        <div className="border-y border-sky-100/80 bg-sky-50/40">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
            {NETWORK_STATS.map((item) => (
              <div
                key={item.label}
                className="text-center md:text-left"
              >
                <p className="text-2xl font-semibold text-sky-600">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <section className="mt-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Certifications our network supports
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-7">
              {CERTIFICATIONS.map((cert) => (
                <span
                  key={cert}
                  className="rounded-lg border border-sky-100/80 bg-white px-3 py-5 text-center text-s font-rg text-sky-600 shadow-sm"
                >
                  {cert}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Certification availability varies by manufacturer and product
              category. Your PM confirms applicable marks during brief review.
            </p>
          </section>
          </div>

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <section className="grid gap-8 lg:grid-cols-5 lg:items-start">
            <div className="lg:col-span-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-800">
                We screen every factory before you ever see their name.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-600">
                Most brands spend weeks cold-emailing factories, chasing
                responses, and guessing at certifications. We do that work
                upfront. Every manufacturer in our network passes a structured
                review before we match them to your brief.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                When your brief comes in, we match it against category
                capability, certification status, MOQ range, and export track
                record. You get one recommendation, not a list to sort through.
              </p>
            </div>
            <div className="lg:col-span-3">
              <div className="rounded-xl border border-sky-100 bg-white/85 p-6 shadow-sm shadow-sky-100/30 sm:p-7">
                <p className="text-sm font-semibold text-slate-800">
                  Partner screening criteria
                </p>
                <ul className="mt-4 space-y-3">
                  {SCREENING_CRITERIA.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-sky-500"
                        aria-hidden
                      />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-slate-500">
                  Screening criteria are applied at onboarding and reviewed
                  annually.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-800">
              Why brands choose Korean ODM - and why it works for the US market.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {WHY_KOREA.map((item) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-sky-100/90 bg-white/85 p-6 shadow-sm shadow-sky-100/30"
                >
                  <div className="border-t-2 border-sky-500/70 pt-4">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {item.body}
                    </p>
                    {"note" in item ? (
                      <p className="mt-3 text-xs text-slate-500">{item.note}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-800">
              Your brand focuses on the product. We handle the supply chain.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {RESPONSIBILITIES.map((column) => (
                <article
                  key={column.title}
                  className="rounded-xl border border-sky-100/90 bg-white/85 p-6 shadow-sm shadow-sky-100/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                      {column.step}
                    </span>
                    <h3 className="text-lg font-semibold text-slate-800">
                      {column.title}
                    </h3>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {column.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <ArrowRight
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-800">
              Built by people who know Korean manufacturing.
            </h2>
            <div className="mt-5 max-w-3xl border-l-2 border-sky-200 pl-5">
              <p className="text-base leading-relaxed text-slate-600">
                Medi Da Kos is operated by KTA Inc., a Korea-based company
                with direct relationships in the Korean cosmetic manufacturing
                industry. Our operations are built around one goal: making
                Korean ODM accessible and low-friction for international brands,
                starting with the US market.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Every project is managed by an English-speaking project manager
                with hands-on experience coordinating between international
                brands and Korean factories. We do not outsource communication.
                Your PM is accountable from brief to delivery.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Operational inquiries: contact@medidakos.com
              </p>
            </div>
          </section>
        </div>
      </section>

      <section className="bg-sky-50/60 py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-2xl font-semibold text-slate-800 sm:text-3xl">
            Ready to see if Korean ODM fits your next launch?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Submit your brief - it takes less than 10 minutes.
            <br></br>
           And your PM
            follows up within 1 business day.
          </p>
          <div className="mt-7">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600"
            >
              Start Your Product Brief
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
