import type { Metadata } from "next";
import Link from "next/link";
import { HeroCarousel } from "@/components/marketing/HeroCarousel";
import { FreeSamplePopup } from "@/components/marketing/FreeSamplePopup";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Korean Cosmetics OEM & ODM Manufacturing Platform for US Brands",
  description:
    "Medidakos connects US beauty brands with GMP-certified Korean OEM/ODM manufacturers. Custom formulation, low MOQ, direct US freight — brief to first sample in 5 weeks. Get a free quote.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title:
      "Korean Cosmetics OEM & ODM Manufacturing Platform for US Brands | Medidakos",
    description:
      "Connect with GMP-certified Korean OEM/ODM manufacturers. Custom formulas, low MOQ, direct US freight. Brief to first sample in 5 weeks.",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — Korean Cosmetics OEM/ODM Platform for US Beauty Brands",
      },
    ],
  },
};
import {
  Droplets,
  Factory,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

const SKY_TAG_CLASS = "bg-sky-50 text-sky-700";
const SKY_METRIC_CLASS = "text-sky-600";

/** 3 on top (2 cols each); bottom 2 span 3 cols — outer edges align with row above */
const ADVANTAGE_GRID_CLASS = [
  "lg:col-span-2 lg:col-start-1",
  "lg:col-span-2 lg:col-start-3",
  "lg:col-span-2 lg:col-start-5",
  "lg:col-span-3 lg:col-start-1",
  "lg:col-span-3 lg:col-start-4",
] as const;

const ADVANTAGES = [
  {
    icon: Sparkles,
    tag: "Cost efficiency",
    headline: "40%+ lower cost than domestic production",
    body: "Factory-direct pricing with margins domestic production can't match — more profit, every order.",
    metrics: [
      { value: "40%+", label: "avg. cost savings" },
      { value: "Factory-direct", label: "pricing model" },
    ],
  },
  {
    icon: Truck,
    tag: "On-time delivery",
    headline: "Your launch timeline is non-negotiable. So is ours.",
    body: "Strict lead-time commitments tracked from production kick-off to freight. Your launch schedule, protected.",
    metrics: [
      { value: "On-time", label: "every production run" },
      { value: "Real-time", label: "order tracking" },
    ],
  },
  {
    icon: Factory,
    tag: "Minimum order",
    headline: "Serious minimums for serious brands — starting at 3,000 units.",
    body: "Purpose-built for volume. Get the pricing leverage and production priority that only comes with real scale.",
    metrics: [
      { value: "3,000", label: "MOQ per SKU" },
      { value: "Volume-tier", label: "pricing available" },
    ],
  },
  {
    icon: Droplets,
    tag: "Custom R&D",
    headline: "Bring a concept. We'll build the formula.",
    body: "Share your vision — texture, efficacy, ingredient story. Our R&D team handles formulation from scratch.",
    metrics: [
      { value: "Concept-in", label: "formula-out" },
      { value: "Full-service", label: "R&D support" },
    ],
  },
  {
    icon: ShieldCheck,
    tag: "Regulatory compliance",
    headline: "Sell anywhere. Every certification, covered.",
    body: "From US and EU market entry to Halal and vegan consumer segments — we manufacture to the exact standards your market demands. No reformulation surprises.",
    certs: ["FDA (MoCRA)",
  "EU CPNP",
  "ISO 22716 GMP",
  "MFDS",
  "Halal",
  "Vegan Society",
  "Leaping Bunny"],
  },
  
] as const;

export default function HomePage() {
  return (
    <>
      <FreeSamplePopup />
      <HeroCarousel />

      <section className="bg-gradient-to-b from-sky-50/40 via-white to-white pb-16 pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <h2 className="mx-auto mt-4 font-serif max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
            Why Medi Da Kos
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-slate-600">
           Manufacture at scale. Deliver on time. Keep your margins.
          </p>
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
            {ADVANTAGES.map((item, index) => (
              <div
                key={item.tag}
                className={`flex h-full flex-col rounded-3xl border border-sky-100/90 bg-white/75 p-8 shadow-sm shadow-sky-100/40 backdrop-blur-sm transition hover:border-sky-200/80 hover:shadow-md hover:shadow-sky-100/50 ${ADVANTAGE_GRID_CLASS[index]}`}
              >
                <span className="inline-flex w-fit rounded-2xl bg-sky-50/90 p-3 ring-1 ring-sky-100/80">
                  <item.icon className="h-7 w-7 text-sky-500" />
                </span>
                <span
                  className={`mt-5 inline-block w-fit rounded-lg px-2.5 py-1 text-[11px] font-medium ${SKY_TAG_CLASS}`}
                >
                  {item.tag}
                </span>
                <h3 className="mt-2 text-[15px] font-medium leading-snug text-slate-800">
                  {item.headline}
                </h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-600">
                  {item.body}
                </p>
                {"metrics" in item && item.metrics ? (
                  <div className="mt-4 flex gap-[18px] border-t border-sky-100/90 pt-4">
                    {item.metrics.map((metric) => (
                      <div key={metric.label} className="flex flex-col gap-0.5">
                        <span
                          className={`text-lg font-medium leading-none ${SKY_METRIC_CLASS}`}
                        >
                          {metric.value}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {metric.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {"certs" in item && item.certs ? (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-sky-100/90 pt-4">
                    {item.certs.map((cert) => (
                      <span
                        key={cert}
                        className="rounded-lg border border-sky-100 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-sky-100/50 via-sky-50/40 to-white pb-24 pt-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
            Ready to manufacture smarter?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Tell us what you&apos;re building. We&apos;ll handle the rest — from
            formulation to finished product, on time and on budget.
          </p>
          <Link
            href="/login"
            className="mt-10 inline-block rounded-full bg-sky-500/90 px-10 py-3.5 text-sm font-semibold text-white shadow-md shadow-sky-200/50 transition hover:bg-sky-600"
          >
            Request a Custom Quote
          </Link>
        </div>
      </section>
    </>
  );
}
