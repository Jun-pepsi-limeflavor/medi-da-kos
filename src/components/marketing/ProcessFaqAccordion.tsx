"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    id: "visit-korea",
    q: "Do I need to visit Korea at any point?",
    a: "No. Everything is managed remotely through the platform and your dedicated PM. Physical samples are shipped directly to your address, and all documentation is handled digitally.",
  },
  {
    id: "sample-approval",
    q: "What if I don't approve the first sample?",
    a: "That's expected — most projects go through 2–3 rounds before formula approval. Your PM coordinates each revision with the lab and keeps the project on schedule.",
  },
  {
    id: "formula-ip",
    q: "Who owns the formula after development?",
    a: "Formula IP terms are defined in your contract before R&D begins. Ownership structures vary by manufacturer and project scope — your PM will walk you through the available options before you commit.",
  },
  {
    id: "moq",
    q: "What is the minimum order quantity?",
    a: "Our manufacturing partners are best matched at 3,000 units or more per SKU — this is where factory pricing and lead times are most competitive. Projects starting at 1,000 units can still be submitted; your PM will confirm feasibility based on product format and partner availability.",
  },
  {
    id: "factory-comms",
    q: "Do I communicate directly with the factory?",
    a: "No — and that's intentional. Your PM manages all factory communication on your behalf, in English, so nothing gets lost in translation and your timeline stays on track.",
  },
  {
    id: "certifications",
    q: "What certifications can you support?",
    a: "Our partner network covers the most common requirements for US and international market entry: FDA (MoCRA), EU CPNP, ISO 22716 GMP, Halal, Vegan Society, and Leaping Bunny cruelty-free, among others. Your PM will confirm which certifications apply to your product category and target markets.",
  },
] as const;

export function ProcessFaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      <h2 className="mt-10 text-2xl font-semibold text-slate-800 sm:text-3xl">
        FAQ
      </h2>
      <div className="mt-8 space-y-5">
        {FAQ.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-sky-100/90 bg-white/85 shadow-md shadow-sky-100/35"
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between gap-4 px-6 py-6 text-left transition hover:bg-sky-50/40 sm:px-8 sm:py-7"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-slate-800 sm:text-base">
                  {item.q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-sky-500 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="border-t border-sky-100/80 px-6 pb-7 pt-5 text-sm leading-relaxed text-slate-600 sm:px-8 sm:pb-8 sm:pt-6">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
