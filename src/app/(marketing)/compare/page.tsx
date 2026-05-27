import Link from "next/link";
import { ArrowRight } from "lucide-react";

const COMPARISON_ROWS = [
  {
    label: "Estimated serum unit cost",
    colA: "$5–15",
    colB: "$1.20–8",
    highlight: false,
  },
  {
    label: "Unit economics at scale",
    colA: "Varies by partner & volume",
    colB: "Often favorable with Korean ODM",
    highlight: false,
  },
  {
    label: "MOQ (minimum order quantity)",
    colA: "500–2,000 units",
    colB: "3,000–10,000 units",
    highlight: false,
  },
  {
    label: "Custom formula capability",
    colA: "Available",
    colB: "Core focus",
    highlight: false,
  },
  {
    label: "Typical production lead time",
    colA: "6–12 weeks",
    colB: "4–8 weeks",
    highlight: false,
  },
  {
    label: "Certifications & compliance",
    colA: "Varies by facility",
    colB: "Matched to your markets (e.g. FDA, GMP, Halal, Vegan)",
    highlight: false,
  },
  {
    label: "K-beauty positioning",
    colA: "Optional",
    colB: "Built into partner network",
    highlight: false,
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
  { value: "Free", label: "Platform & brief access" },
  { value: "$1.20–8", label: "Typical serum unit range" },
  { value: "4–8 wks", label: "Common production window" },
] as const;

export default function ComparePage() {
  return (
    <div className="bg-gradient-to-b from-sky-50/50 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">
          Compare
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Unit economics &amp; lead times at a glance
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
              How options often compare
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Reference ranges for custom skincare — not a guarantee of savings.
              Many brands choose Korean ODM for unit economics, lead time, and
              formulation depth; others prioritize lower MOQ or closer oversight
              with regional partners. We help you evaluate what fits your launch
              plan.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-sky-100/90 bg-white/85 shadow-sm shadow-sky-100/30">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-sky-100/90 bg-sky-50/50">
                    <th className="px-4 py-3.5 font-semibold text-slate-700 sm:px-6">
                      Item
                    </th>
                    <th className="px-4 py-3.5 font-semibold text-slate-600 sm:px-6">
                      Typical contract manufacturing
                    </th>
                    <th className="px-4 py-3.5 font-semibold text-sky-700 sm:px-6">
                      Medi Da Kos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className={`border-b border-sky-50 last:border-0 ${
                        row.highlight ? "bg-sky-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 font-medium text-slate-800 sm:px-6">
                        {row.label}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 sm:px-6">
                        {row.colA}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 sm:px-6">
                        {row.colB}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-800">
              Certifications we can support
            </p>
            <p className="mt-2 text-sm text-slate-600">
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
            <p className="mt-2 text-xs text-slate-500">
              Additional marks or regional filings may be available — confirm
              with your PM during brief review.
            </p>
          </div>

          <div className="mt-6 space-y-3 rounded-xl border border-sky-100/80 bg-sky-50/40 px-5 py-4 text-sm leading-relaxed text-slate-600">
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

        <div className="mt-14 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600"
          >
            Request a custom quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-4 text-sm text-slate-500">
            MOQ for custom formulation typically starts at 3,000 units. Sample
            fees apply per SKU.
          </p>
        </div>
      </div>
    </div>
  );
}
