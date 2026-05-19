import Link from "next/link";

const plans = [
  {
    name: "Explorer",
    price: "Free",
    description: "For brands evaluating Korean ODM partners.",
    features: [
      "Account & CM brief wizard",
      "Top 10 sample requests",
      "Email support",
    ],
  },
  {
    name: "Brand Builder",
    price: "Custom quote",
    description: "For active custom formulation projects.",
    features: [
      "Dedicated account manager",
      "Formula development support",
      "Sample & bulk production",
      "Compliance documentation",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom quote",
    description: "For multi-SKU lines and volume brands.",
    features: [
      "Priority manufacturing slots",
      "Exclusive packaging options",
      "Regulatory filing assistance",
      "SLA-backed response times",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="bg-gradient-to-b from-sky-50/80 to-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-sky-600">
          Pricing
        </p>
        <h1 className="mt-3 text-center text-4xl font-semibold text-slate-800">
          Transparent partnership models
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
          Platform access is free. Production, samples, and formulation are
          quoted per project based on MOQ, complexity, and packaging.
        </p>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-sky-400 bg-white shadow-lg ring-2 ring-sky-100"
                  : "border-sky-100 bg-white shadow-sm"
              }`}
            >
              <h2 className="text-xl font-semibold text-slate-800">{plan.name}</h2>
              <p className="mt-2 text-3xl font-bold text-sky-600">{plan.price}</p>
              <p className="mt-3 text-sm text-slate-600">{plan.description}</p>
              <ul className="mt-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-sky-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          MOQ for custom formulation typically starts at 3,000 units depending on
          product type. Sample fees apply per SKU.
        </p>
        <div className="mt-8 text-center">
          <Link
            href="/contact"
            className="inline-block rounded-full border border-sky-200 px-8 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            Request a quote
          </Link>
        </div>
      </div>
    </div>
  );
}
