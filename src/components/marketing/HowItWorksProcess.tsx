"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type DetailBlock = {
  heading: string;
  body: string;
};

type PaymentStep = {
  num: string;
  title: string;
  body: string;
};

type ProcessStep = {
  id: string;
  step: string;
  title: string;
  duration: string;
  summary: string;
  details: DetailBlock[];
  paymentSteps?: PaymentStep[];
  note: string;
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    id: "brief",
    step: "01",
    title: "Submit your brief",
    duration: "Day 1",
    summary:
      "Complete your dashboard brief — category, formula, packaging, MOQ, target launch date, and certifications. No email required to get started.",
    details: [
      {
        heading: "Platform",
        body: "One structured brief becomes the single project record. Your assigned project manager reviews it and initiates the manufacturing match.",
      },
      {
        heading: "You provide",
        body: "Product concept, target MOQ, launch window, and certification requirements.",
      },
    ],
    note: "Start in minutes, not email threads",
  },
  {
    id: "sampling",
    step: "02",
    title: "Sample Review & Order Confirmation",
    duration: "2–3 sample rounds · ~3 weeks",
    summary:
      "Physical samples are shipped directly to your address. Once you approve the formula, your PM guides you through the proforma invoice, PO, and escrow payment.",
    details: [
      {
        heading: "Sample evaluation",
        body: "Test texture, scent, color, and on-skin performance. Submit structured feedback through your PM — most projects reach approval within 2–3 rounds.",
      },
      {
        heading: "Review period",
        body: "Test the samples with your team and share feedback directly with your PM. We relay it to the lab and coordinate the next revision — so every round moves closer to your approved formula.",
      },
    ],
    paymentSteps: [
      {
        num: "1",
        title: "Proforma Invoice",
        body: "Issued before the formal contract. Confirms unit price, order quantity, and delivery timeline — the foundation of your production agreement.",
      },
      {
        num: "2",
        title: "Purchase Order (PO)",
        body: "Your team issues the PO to lock in item specifications, quantity, and pricing in writing.",
      },
      {
        num: "3",
        title: "Escrow Payment",
        body: "Payment is held in escrow and released against agreed production milestones. Medi Da Kos charges a 10% platform fee on the confirmed order value — shown on your proforma before you sign the PO, separate from factory unit pricing. Your PM walks you through each line item.",
      },
    ],
    note: "No surprises — every cost confirmed before production begins",
  },
  {
    id: "delivery",
    step: "03",
    title: "Export & Delivery",
    duration: "Sea: 2–4 weeks",
    summary:
      "Finished goods are shipped by sea or air to your warehouse, complete with export documentation and end-to-end tracking.",
    details: [
      {
        heading: "Pre-shipment",
        body: "Pre-shipment inspection and batch COA are completed and verified before goods leave the factory.",
      },
      {
        heading: "Export documentation",
        body: "COA, Certificate of Origin, MSDS, and market-specific filings (FDA / EU CPNP where required) are prepared and reviewed before customs clearance.",
      },
      {
        heading: "Freight to your door",
        body: "We coordinate sea or air freight with a carrier matched to your timeline and budget. You receive tracking updates from port departure through delivery to your warehouse.",
      },
    ],
    note: "Landed at your warehouse — not just shipped from ours",
  },
];

export function HowItWorksProcess() {
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  function toggleStep(id: string) {
    if (showAll) return;
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8  ">
      <h2 className="mt-20 text-2xl font-semibold text-slate-800 sm:text-3xl">
        The process
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
        Three milestones from brief to delivery. Expand each step for details.
      </p>

      <div className="mt-20 flex justify-center">
        <button
          type="button"
          onClick={() => {
            setShowAll((v) => !v);
            setOpenId(null);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-sky-200/90 bg-white/80 px-6 py-3 text-base font-semibold text-sky-700 shadow-sm shadow-sky-100/40 backdrop-blur-sm transition hover:bg-sky-50/80"
        >
          {showAll ? (
            <>
              Hide details
              <ChevronUp className="h-5 w-5" aria-hidden />
            </>
          ) : (
            <>
              View full process
              <ChevronDown className="h-5 w-5" aria-hidden />
            </>
          )}
        </button>
      </div>

      <ol className="mt-8 space-y-5">
        {PROCESS_STEPS.map((step) => {
          const isOpen = showAll || openId === step.id;
          return (
            <li
              key={step.id}
              className="overflow-hidden rounded-2xl border border-sky-100/90 bg-white/85 shadow-md shadow-sky-100/35"
            >
              <button
                type="button"
                onClick={() => toggleStep(step.id)}
                className={`flex w-full items-start justify-between gap-3 px-6 py-6 text-left transition sm:gap-5 sm:px-8 sm:py-7 ${
                  showAll ? "cursor-default" : "hover:bg-sky-50/30"
                }`}
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-wide text-sky-600">
                    Step {step.step}
                  </p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-800 sm:text-2xl">
                    {step.title}
                  </p>
                  {/* Below sm the duration sits under the title so it and the
                      title each get a full line, and the summary below is not
                      squeezed by a side column. At sm+ it moves back up right. */}
                  <span className="mt-2 block text-sm font-medium text-slate-400 sm:hidden">
                    {step.duration}
                  </span>
                  {!isOpen && (
                    <p className="mt-3 text-base leading-relaxed text-slate-500">
                      {step.summary}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
                  <span className="hidden whitespace-nowrap text-sm font-medium text-slate-400 sm:block">
                    {step.duration}
                  </span>
                  {!showAll && (
                    <ChevronDown
                      className={`h-5 w-5 text-sky-500 transition ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  )}
                </div>
              </button>

              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-sky-100/80 bg-sky-50/40 px-6 pb-7 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
                    <p className="text-base leading-relaxed text-slate-600">
                      {step.summary}
                    </p>

                    <ul className="mt-6 space-y-5">
                      {step.details.map((block) => (
                        <li key={block.heading}>
                          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                            {block.heading}
                          </p>
                          <p className="mt-2 text-base leading-relaxed text-slate-600">
                            {block.body}
                          </p>
                        </li>
                      ))}
                    </ul>

                    {step.paymentSteps && (
                      <div className="mt-8 rounded-xl border border-sky-100/90 bg-white/90 p-5 sm:p-6">
                        <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                          When you are ready to order
                        </p>
                        <ol className="mt-4 space-y-4">
                          {step.paymentSteps.map((ps) => (
                            <li key={ps.num} className="flex gap-4">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/90 text-sm font-bold text-white">
                                {ps.num}
                              </span>
                              <div>
                                <p className="text-base font-semibold text-slate-800">
                                  {ps.title}
                                </p>
                                <p className="mt-1 text-base leading-relaxed text-slate-600">
                                  {ps.body}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <p className="mt-6 text-sm font-semibold text-sky-700">
                      {step.note}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
