"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Gift } from "lucide-react";

const POPUP_KEY = "mdk_free_sample_popup_seen";

const BULLETS = [
  "GMP-certified Korean manufacturing",
  "Sample production cost — on us",
  "International freight — on us",
  "No minimum order requirement.",
];

export function FreeSamplePopup() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(POPUP_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(POPUP_KEY, "1");
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sky-900/20 p-4 backdrop-blur-[3px]"
      onClick={dismiss}
    >
      <div
        // Content runs 640-700px tall at 375px, so it clips on a 667px viewport
        // without max-h + inner scroll — the CTA becomes unreachable.
        className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-[440px] overflow-y-auto rounded-2xl border border-sky-100/80 bg-white/95 p-6 shadow-2xl shadow-sky-100/50 transition-all duration-200 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + badge */}
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex rounded-2xl bg-sky-50/90 p-3.5 ring-1 ring-sky-100/80">
            <Gift className="h-7 w-7 text-sky-500" />
          </span>
          <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-sky-500 uppercase">
            Qualified Brands Only · Complimentary Sample
          </p>

          {/* Headline */}
          <h2 className="mt-3 font-serif text-2xl font-bold leading-snug tracking-tight text-slate-900">
            Experience Korean GMP Quality —<br />
            Before You Commit to MOQ.
          </h2>

          {/* Sub */}
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            We cover production and international shipping costs.
            Evaluate formula, texture, and finish before committing to production.
          </p>
        </div>

        {/* Bullets */}
        <ul className="mt-5 space-y-2">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="mt-0.5 text-sky-500 font-semibold">✓</span>
              {b}
            </li>
          ))}
        </ul>

        <div className="my-6 border-t border-sky-100/80" />

        {/* CTA */}
        <Link
          href="/login"
          onClick={dismiss}
          className="block w-full rounded-xl bg-sky-500/90 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600"
        >
          Request Your Complimentary Sample →
        </Link>

        <button
          onClick={dismiss}
          className="mt-3 block w-full text-center text-xs text-slate-400 underline underline-offset-2 transition hover:text-slate-500"
        >
          I&apos;ll explore on my own
        </button>

        {/* Fine print */}
        <p className="mt-4 text-center text-xs italic text-slate-400">
          Available to qualified beauty brands. Subject to capacity.
        </p>
      </div>
    </div>
  );
}
