"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    id: "formula",
    q: "Do I need a formula already?",
    a: "No. Send the idea and our production team will spec it. If you do have a formula, send that instead — we'll tell you whether we can run it as written.",
  },
  {
    id: "sample",
    q: "Can I get a sample first?",
    a: "Yes. There's no minimum on samples. Say so on the form and we'll treat it as its own step rather than folding it into the quote.",
  },
  {
    id: "volume",
    q: "What if my volume is under ten thousand?",
    a: "Put the real number on the form. Packaging is usually what decides it, and we'll tell you straight whether it works at that number.",
  },
  {
    id: "markets",
    q: "Which markets can you spec for?",
    a: "Tell us where you're selling — US, EU, or both — and we'll factor those markets into the spec from the start rather than reworking it later.",
  },
  {
    id: "call",
    q: "Is there a call?",
    a: "Not unless you want one. The first thing you get back is a written quote.",
  },
] as const;

export function KoreaFaq() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-sky-100/90 overflow-hidden rounded-2xl border border-sky-100/90 bg-white/85 shadow-md shadow-sky-100/35">
      {FAQ.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-sky-50/40"
              aria-expanded={isOpen}
            >
              <span className="text-base font-medium text-slate-800">
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
                <p className="px-6 pb-5 pr-10 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
