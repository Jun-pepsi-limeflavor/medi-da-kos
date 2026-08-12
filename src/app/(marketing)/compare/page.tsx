import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Korean OEM/ODM vs Local Contract Manufacturing — Cost, MOQ & Lead Time",
  description:
    "Compare Korean OEM/ODM vs local contract manufacturing for beauty brands: unit cost, MOQ, lead time, and GMP certification coverage. See why indie brands worldwide choose Korean manufacturers.",
  alternates: {
    canonical: `${SITE_URL}/compare`,
  },
  openGraph: {
    title:
      "Korean OEM/ODM vs Local Contract Manufacturing — Cost, MOQ & Lead Time | Medidakos",
    description:
      "Compare Korean OEM/ODM vs local contract manufacturing: unit cost, MOQ, lead time, and GMP certification. See why indie brands worldwide choose Korea.",
    url: `${SITE_URL}/compare`,
    images: [
      {
        url: "/og-compare.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — Korean OEM/ODM vs Local Contract Manufacturing",
      },
    ],
  },
};

const COMPARISON_ROWS = [
  {
    label: "Estimated serum unit cost",
    colA: "$5–15",
    colB: "$1.20–8",
  },
  {
    label: "Unit economics at scale",
    colA: "Varies by partner & volume",
    colB: "Structurally lower at volume",
  },
  {
    label: "Minimum order quantity",  // "MOQ (minimum order quantity)" → 풀어쓰기
    colA: "500–2,000 units",
    colB: "3,000–10,000 units",
  },
  {
    label: "Custom formula capability",
    colA: "Varies by facility",  // "Available" → 더 정직하고 구체적
    colB: "Core focus",
  },
  {
    label: "Typical production lead time",
    colA: "6–12 weeks",
    colB: "4–8 weeks",
  },
  {
    label: "Certifications & compliance",
    colA: "Varies by facility",
    colB: "ISO 22716, FDA, EU CPNP, Halal, Vegan — matched to your markets",
  },
  {
    label: "K-beauty positioning",
    colA: "Not applicable",  // "Optional" → 더 명확
    colB: "Built into partner network",
  },
] as const;

const CERT_EXAMPLES = [
  "FDA (MoCRA)",
  "EU CPNP",
  "ISO 22716",
  "Halal",
  "Vegan",
  "Cruelty-free",
] as const;

const HIGHLIGHTS = [
  { value: "Free", label: "No upfront cost to submit your brief" },
  { value: "$1.20–8", label: "Typical serum unit range" },
  { value: "4–8 wks", label: "Typical production lead time" },
] as const;

export default function ComparePage() {
  return (
    <div className="bg-gradient-to-b from-sky-50/50 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">
          Compare
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl font-serif text-center text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          "See how Medi Da Kos stacks up — cost, lead time, and capability"
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-slate-600">
          Platform access is free. Below are typical industry benchmarks for
          cost, MOQ, lead time, and compliance — your PM provides numbers
          specific to your brief.
        </p>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-sky-100/90 bg-white/80 px-5 py-5 text-center shadow-sm shadow-sky-100/30 backdrop-blur-sm"
            >
              <p className="text-2xl font-semibold text-sky-600">{item.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
             Medi Da Kos vs. typical contract manufacturing
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Reference ranges for custom skincare — not a guarantee of savings.
              We help you find the right fit for your formula, timeline, and budget.
            </p>
          </div>

          {/* Below sm a 3-column table either scrolls sideways or wraps the
              longest cell to ~8 lines, so it becomes a two-column comparison
              with one sticky header instead of a label repeated on every row.
              No overflow-hidden on this wrapper — it would become the sticky
              header's scroll container and kill the sticky. */}
          <div className="relative rounded-xl border border-sky-100/90 bg-white/85 shadow-sm shadow-sky-100/30 sm:hidden">
            {/* Both cells must be fully opaque: once pinned, the rows scroll
                underneath and any alpha lets their text bleed through. */}
            <div className="sticky top-16 z-10 grid grid-cols-2 overflow-hidden rounded-t-xl border-b border-sky-100/90 shadow-sm shadow-sky-100/50">
              <p className="bg-white px-4 py-2.5 text-xs font-medium leading-snug text-slate-500">
                Typical contract manufacturing
              </p>
              <p className="flex items-start gap-1.5 border-l border-sky-100 bg-sky-100 px-4 py-2.5 text-xs font-semibold leading-snug text-sky-800">
                <Check size={14} className="mt-0.5 shrink-0" aria-hidden />
                Medi Da Kos
              </p>
            </div>

            <ul>
              {COMPARISON_ROWS.map((row, i) => {
                const last = i === COMPARISON_ROWS.length - 1;
                return (
                  <li
                    key={row.label}
                    className="border-t border-sky-100/70 first:border-t-0"
                  >
                    {/* Full-width band. Most labels are wider than half the
                        card, so without a background of their own they sat
                        half on white and half on the tinted column and read
                        as intruding on it. The band settles the question. */}
                    <p className="border-b border-sky-100/70 bg-slate-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {row.label}
                    </p>
                    <div className="grid grid-cols-2">
                      {/* The visible column identity is the sticky header;
                          these restore it for screen readers at no cost. */}
                      <p className="px-4 py-3 text-sm tabular-nums text-slate-500">
                        <span className="sr-only">
                          Typical contract manufacturing:{" "}
                        </span>
                        {row.colA}
                      </p>
                      {/* The card cannot carry overflow-hidden — it would
                          become the sticky header's scroll container — so the
                          last tinted cell trims its own corner. */}
                      <p
                        className={`border-l border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-semibold tabular-nums text-sky-900 ${
                          last ? "rounded-br-xl" : ""
                        }`}
                      >
                        <span className="sr-only">Medi Da Kos: </span>
                        {row.colB}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-sky-100/90 bg-white/85 shadow-sm shadow-sky-100/30 sm:block">
            <div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-sky-100/90 bg-sky-50/50">
                    <th className="px-4 py-3.5 font-semibold text-slate-700 sm:px-6">
                      Item
                    </th>
                    <th className="px-4 py-3.5 font-semibold text-slate-500 sm:px-6">
                      Typical contract manufacturing
                    </th>
                    <th className="bg-sky-100/60 px-4 py-3.5 text-base font-semibold text-sky-800 sm:px-6">
                      <span className="flex items-center gap-2">
                        <Check size={18} className="shrink-0" aria-hidden />
                        Medi Da Kos
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-sky-50 last:border-0"
                    >
                      <td className="px-4 py-3.5 font-medium text-slate-800 sm:px-6">
                        {row.label}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-500 sm:px-6">
                        {row.colA}
                      </td>
                      <td className="bg-sky-50/60 px-4 py-3.5 font-semibold tabular-nums text-sky-900 sm:px-6">
                        {row.colB}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-16">
          <h2 className="text-xl font-semibold text-slate-800">
              Certifications we can support
            </h2>
            <p className="mt-6 text-sm text-slate-600">
              Requirements vary by product and market. We match you to
              manufacturers that can meet your brief — examples include:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CERT_EXAMPLES.map((cert) => (
                <span
                  key={cert}
                  className="rounded-lg border border-sky-100 bg-sky-50/80 px-2.5 py-1 text-xs font-medium text-sky-800"
                >
                  {cert}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Additional marks or regional filings may be available — confirm
              with your PM during brief review.
            </p>
          </div>

          <div className="mt-8 space-y-3 rounded-xl border border-sky-100/80 bg-sky-50/40 px-5 py-4 text-sm leading-relaxed text-slate-600">
            <p>
              <span className="font-semibold text-slate-800">Import duty: </span>
              Under agreements such as KORUS FTA, many cosmetic categories may
              qualify for low or zero import duty, depending on classification
              and destination. Your logistics partner can confirm HS codes for
              your SKU.
            </p>
            <p className="text-xs text-slate-500">
              Figures in the table are approximate industry benchmarks. Actual
              quotes, MOQ, lead times, and certification scope depend on your
              project. Request a quote for numbers tied to your brief.
            </p>
          </div>
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600"
          >
            Request a custom quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-4 text-sm text-slate-500">
          MOQ for custom formulation starts at 3,000 units per SKU. 
          Sample fees are quoted per project.
          </p>
        </div>
      </div>
    </div>
  );
}
