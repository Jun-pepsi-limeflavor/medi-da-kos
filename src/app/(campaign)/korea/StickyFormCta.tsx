"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { trackCtaClick } from "./analytics";

/**
 * 모바일 전용 하단 CTA.
 *
 * 히어로가 화면을 벗어나면 나타나고, 폼이 보이기 시작하면 사라진다 —
 * 가리키는 대상을 자기가 덮지 않게. 데스크톱엔 띄우지 않는다(애드테크처럼 읽힌다).
 */
export function StickyFormCta() {
  const [pastHero, setPastHero] = useState(false);
  const [formInView, setFormInView] = useState(false);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const hero = document.querySelector("h1");
    if (hero) {
      const heroObserver = new IntersectionObserver(
        ([entry]) => setPastHero(!entry.isIntersecting),
        { threshold: 0 },
      );
      heroObserver.observe(hero);
      observers.push(heroObserver);
    }

    const brief = document.getElementById("brief");
    if (brief) {
      const briefObserver = new IntersectionObserver(
        ([entry]) => setFormInView(entry.isIntersecting),
        { threshold: 0 },
      );
      briefObserver.observe(brief);
      observers.push(briefObserver);
    }

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  const show = pastHero && !formInView;

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-sky-100/90 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm transition-transform duration-200 sm:hidden ${
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <a
        href="#brief"
        data-cta="sticky"
        tabIndex={show ? undefined : -1}
        onClick={() => trackCtaClick("sticky")}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600"
      >
        Send one spec
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}
