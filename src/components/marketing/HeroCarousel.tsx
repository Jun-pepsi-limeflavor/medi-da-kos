"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HERO_COPY = {
  eyebrow: "OEM/ODM Manufacturing Platform",
  title: "Scale smarter.",
  subTitle2: "Manufacture with confidence.",
  subtitle:
    "Reduce production costs by 30% or more — without compromising on quality. Connect directly to certified Korean beauty manufacturers who deliver at scale, on spec, and on schedule.",
  primaryCta: "Request a Custom Quote",
  primaryHref: "/login",
};

/**
 * Hero copy layout (1512px design frame).
 * - HERO_COPY_LEFT_PX: distance from frame left edge
 * - HERO_COPY_OFFSET_Y_PX: shift from vertical center (+ down, − up)
 */
const HERO_FRAME_MAX_PX = 1512;
const HERO_COPY_LEFT_PX = 0;
const HERO_COPY_OFFSET_Y_PX = -60;

const HERO_SLIDES = [
  { src: "/medidakos_main1.png", lightText: false },
  { src: "/medidakos_main2.png", lightText: true },
  { src: "/medidakos_main3.png", lightText: false },
] as const;

function headlineColorClass(lightText: boolean) {
  return lightText
    ? "text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]"
    : "text-slate-900 drop-shadow-[0_1px_12px_rgba(255,255,255,0.45)]";
}

function CopyLegibilityWash({ lightText }: { lightText: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 rounded-3xl transition-opacity duration-700 ${
        lightText
          ? "bg-[radial-gradient(ellipse_at_left_center,rgba(15,23,42,0.22)_0%,transparent_72%)]"
          : "bg-[radial-gradient(ellipse_at_left_center,rgba(255,255,255,0.16)_0%,transparent_72%)]"
      }`}
      aria-hidden
    />
  );
}

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const lightText = HERO_SLIDES[index].lightText;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative h-[100dvh] min-h-[600px] w-full overflow-hidden bg-slate-900">
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.src}
            alt=""
            fill
            className="object-cover object-center"
            priority={i === 0}
            sizes="100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent"
            aria-hidden
          />
        </div>
      ))}

      {/* UI layer: centered 1512px frame — fixed px offsets, stable across viewport widths */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div
          className="relative mx-auto h-full w-full"
          style={
            {
              maxWidth: HERO_FRAME_MAX_PX,
              ["--hero-copy-left" as string]: `${HERO_COPY_LEFT_PX}px`,
              ["--hero-copy-offset-y" as string]: `${HERO_COPY_OFFSET_Y_PX}px`,
            } as React.CSSProperties
          }
        >
          <div className="pointer-events-auto absolute left-6 top-1/2 w-[min(52rem,calc(100%-3rem))] -translate-y-[calc(50%-var(--hero-copy-offset-y,0px))] md:left-[var(--hero-copy-left)]">
            <CopyLegibilityWash lightText={lightText} />
            <p
              className={`mb-4 text-sm font-medium uppercase tracking-[0.16em] transition-colors duration-700 sm:text-base ${
                lightText ? "text-sky-100/90" : "text-sky-700/90"
              }`}
            >
              {HERO_COPY.eyebrow}
            </p>
            <h1
              className={`text-6xl font-semibold leading-[1.02] tracking-tight transition-colors duration-700 sm:text-7xl sm:leading-[1.02] lg:text-[3.75rem] ${headlineColorClass(lightText)}`}
            >
              {HERO_COPY.title}
            </h1>
            <h2
              className={`mt-1 max-w-none text-[1.75rem] font-semibold leading-[1.08] tracking-tight transition-colors duration-700 sm:text-4xl sm:leading-[1.08] lg:text-[2.5rem] lg:whitespace-nowrap ${headlineColorClass(lightText)}`}
            >
              {HERO_COPY.subTitle2}
            </h2>
            <p
              className={`mt-5 max-w-2xl text-lg leading-relaxed transition-colors duration-700 sm:text-medium ${
                lightText
                  ? "text-white/88 drop-shadow-[0_1px_14px_rgba(0,0,0,0.4)]"
                  : "text-slate-700/95 drop-shadow-[0_1px_10px_rgba(255,255,255,0.35)]"
              }`}
            >
              {HERO_COPY.subtitle}
            </p>
            <div className="mt-9">
              <Link
                href={HERO_COPY.primaryHref}
                className={`inline-block rounded-full px-8 py-3.5 text-base font-semibold shadow-md transition-colors duration-700 sm:text-lg ${
                  lightText
                    ? "border border-white/90 bg-white text-sky-600 shadow-slate-900/20 hover:bg-sky-50"
                    : "bg-sky-500/90 text-white shadow-sky-900/10 hover:bg-sky-600"
                }`}
              >
                {HERO_COPY.primaryCta}
              </Link>
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-6 left-6 right-6 flex items-center justify-between sm:bottom-8">
            <div className="flex gap-2">
              {HERO_SLIDES.map((slide, i) => (
                <button
                  key={slide.src}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === index
                      ? lightText
                        ? "w-8 bg-white/90"
                        : "w-8 bg-slate-800/75"
                      : lightText
                        ? "w-3 bg-white/40"
                        : "w-3 bg-slate-800/35"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setIndex(
                    (i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length,
                  )
                }
                className={`rounded-full border p-2 backdrop-blur-[2px] transition ${
                  lightText
                    ? "border-white/40 bg-white/25 text-white hover:bg-white/40"
                    : "border-slate-800/25 bg-white/50 text-slate-800 hover:bg-white/80"
                }`}
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % HERO_SLIDES.length)}
                className={`rounded-full border p-2 backdrop-blur-[2px] transition ${
                  lightText
                    ? "border-white/40 bg-white/25 text-white hover:bg-white/40"
                    : "border-slate-800/25 bg-white/50 text-slate-800 hover:bg-white/80"
                }`}
                aria-label="Next slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
