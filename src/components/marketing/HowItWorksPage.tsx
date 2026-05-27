import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HowItWorksProcess } from "./HowItWorksProcess";

const TIMELINE = [
  { label: "Brief submitted", time: "Day 1" },
  { label: "Sample review", time: "2 weeks" },
  { label: "PI · PO · Escrow", time: "After approval" },
  { label: "Freight delivery", time: "Post-production" },
] as const;

const CERTIFICATIONS = [
  "FDA (MoCRA)",
  "EU CPNP",
  "ISO 22716",
  "Halal",
  "Vegan Society",
  "Cruelty-free",
] as const;

const FAQ = [
  {
    q: "Do I need to visit Korea?",
    a: "No. Your PM and the platform handle everything. Samples and documents ship to you.",
  },
  {
    q: "What if I don't approve the first sample?",
    a: "Most brands go through 2–3 rounds. Your PM coordinates revisions until you sign off.",
  },
  {
    q: "Can I own the formula IP?",
    a: "IP terms are set in your contract before R&D starts. Your PM will explain options upfront.",
  },
  {
    q: "What's the MOQ?",
    a: "Typically from 3,000 units per SKU, depending on format. Your brief sets the target MOQ for matching.",
  },
  {
    q: "How do you talk to the factory?",
    a: "You don't. Your PM handles all factory communication in English.",
  },
  {
    q: "What certifications can you support?",
    a: "It depends on your product and target markets. We match manufacturers that can meet your requirements — commonly including FDA (MoCRA), EU CPNP, ISO 22716 GMP, Halal, Vegan, and cruelty-free positioning, among others.",
  },
] as const;

export function HowItWorksPage() {
  return (
    <div className="bg-white">
      {/* Hero — airy / refresh tone (bright, cool, transparent) */}
      <section className="relative h-[min(72vh,640px)] w-full overflow-hidden bg-sky-50 sm:h-[min(78vh,720px)]">
        <div className="absolute inset-0">
          <Image
            src="/how_it_works_hero.png"
            alt="Medi Da Kos manufacturing process"
            fill
            unoptimized
            priority
            className="object-cover object-center brightness-[1.12] contrast-[1.04] saturate-[1.15] hue-rotate-[-6deg]"
            sizes="100vw"
          />
          {/* Cool clarity wash — light, not opaque */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-sky-50/20 to-cyan-100/35"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sky-100/25 via-transparent to-white/30"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-sky-300/10 mix-blend-soft-light"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(224,247,255,0.35)_0%,transparent_45%,rgba(186,230,253,0.2)_100%)]"
            aria-hidden
          />
        </div>

        <div className="absolute inset-0 z-10 flex items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-24 sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
            <div className="max-w-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 drop-shadow-[0_1px_4px_rgba(255,255,255,0.95)]">
                Process
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-800 drop-shadow-[0_1px_8px_rgba(255,255,255,0.95)] sm:text-4xl">
                From brief to delivery
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-700 drop-shadow-[0_1px_6px_rgba(255,255,255,0.9)]">
                Brief, sample &amp; payment, then freight to your warehouse — with
                clear milestones at each stage.
              </p>
            </div>
          </div>
        </div>
      </section>

      <HowItWorksProcess />

      <section className="border-y border-sky-100/80 bg-sky-50/30 py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-semibold text-slate-800">Timeline</h2>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {TIMELINE.map((item) => (
              <div key={item.label} className="text-sm">
                <span className="font-medium text-sky-600">{item.time}</span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              Korean manufacturing network
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Korea is a top global cosmetics exporter. Partner factories are
              GMP-certified (ISO 22716) and MFDS-registered. We match you by
              category and MOQ — you don&apos;t vet factories yourself.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
              <li>· Shipped to brands in 30+ countries</li>
              <li>· Batch COA on every production run</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Certifications we can support
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Not limited to a fixed list — we align factories to your brief.
              Examples:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CERTIFICATIONS.map((cert) => (
                <span
                  key={cert}
                  className="rounded-lg border border-sky-100 bg-sky-50/80 px-2.5 py-1 text-xs font-medium text-sky-800"
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-slate-800">FAQ</h2>
        <dl className="mt-6 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-sm font-semibold text-slate-800">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-sky-100/80 bg-sky-50/30 py-14">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600"
          >
            Start your product brief
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
