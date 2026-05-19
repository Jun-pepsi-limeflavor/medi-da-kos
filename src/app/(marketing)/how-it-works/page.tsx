const steps = [
  {
    step: "01",
    title: "Create account & brief",
    description:
      "Register with your company details and start the 6-step Custom Manufacturing (CM) brief in your dashboard.",
  },
  {
    step: "02",
    title: "Define your product",
    description:
      "Select category, packaging, upload branding, specify MOQ, formula preferences, and compliance requirements.",
  },
  {
    step: "03",
    title: "Sample & refine",
    description:
      "Request samples from top formulas or custom prototypes. Iterate with our ODM partners until approved.",
  },
  {
    step: "04",
    title: "Production & QC",
    description:
      "Upon approval, bulk manufacturing begins with full quality control and documentation.",
  },
  {
    step: "05",
    title: "Ship & track",
    description:
      "International fulfillment via FedEx, DHL, or UPS. Monitor every shipment in your tracking dashboard.",
  },
  {
    step: "06",
    title: "Scale your brand",
    description:
      "Reorder, expand SKUs, and grow with dedicated account support from the Medi Da Kos team.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-gradient-to-b from-sky-50/80 to-white">
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">
          How it works
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-800">
          Your path from concept to launch
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          A transparent, structured workflow designed for brand operators who
          need true customization — not off-the-shelf private label.
        </p>

        <div className="mt-16 space-y-8">
          {steps.map((s) => (
            <article
              key={s.step}
              className="flex gap-6 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                {s.step}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">{s.title}</h2>
                <p className="mt-2 text-slate-600">{s.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
