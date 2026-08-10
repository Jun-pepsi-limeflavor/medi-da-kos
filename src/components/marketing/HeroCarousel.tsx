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
    "Reduce production costs by 40% or more — without compromising on quality. Connect directly to certified Korean beauty manufacturers who deliver at scale, on spec, and on schedule.",
  primaryCta: "Request a Custom Quote",
  primaryHref: "/login",
  secondaryCta: "Let's Talk to Our Team",
  secondaryHref: "/contact",
};

/**
 * Hero copy layout (1512px design frame).
 * - HERO_COPY_LEFT_PX: distance from frame left edge
 * - HERO_COPY_OFFSET_Y_PX: shift from vertical center (+ down, − up)
 *
 * Two layouts, one markup tree, switched at lg:
 * - below lg: image in a 16/9 box, copy stacked underneath on white
 * - lg and up: full-bleed image with the copy overlaid (unchanged)
 * Every colour string therefore emits the dark-on-white variant unprefixed and
 * re-applies the light-on-photo variant behind lg:.
 */
const HERO_FRAME_MAX_PX = 1512;
const HERO_COPY_LEFT_PX = 0;
const HERO_COPY_OFFSET_Y_PX = -60;

const HERO_SLIDES = [
  {
    src: "/medidakos_main1.webp",
    // Slides 1 and 3 reserve their left ~45% as blank space for the desktop
    // copy overlay. Mobile stacks the copy below the image, so it gets an
    // art-directed source with that blank already cut off.
    mobileSrc: "/medidakos_main1_m.webp",
    lightText: false,
    alt: "Korean OEM ODM cosmetics manufacturer — GMP-certified production facility in Korea",
  },
  {
    src: "/medidakos_main2.webp",
    mobileSrc: "/medidakos_main2.webp",
    lightText: true,
    alt: "Custom K-beauty skincare formulation for US indie beauty brands — sampling stage",
  },
  {
    src: "/medidakos_main3.webp",
    mobileSrc: "/medidakos_main3_m.webp",
    lightText: false,
    alt: "ISO 22716 GMP certified Korean beauty manufacturer — export-ready packaging for US market",
  },
] as const;

function headlineColorClass(lightText: boolean) {
  return lightText
    ? "text-slate-900 lg:text-white lg:drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]"
    : "text-slate-900 lg:drop-shadow-[0_1px_12px_rgba(255,255,255,0.45)]";
}

function controlColorClass(lightText: boolean) {
  return lightText
    ? "border-slate-800/25 bg-white/50 text-slate-800 hover:bg-white/80 lg:border-white/40 lg:bg-white/25 lg:text-white lg:hover:bg-white/40"
    : "border-slate-800/25 bg-white/50 text-slate-800 hover:bg-white/80";
}

function CopyLegibilityWash({ lightText }: { lightText: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 hidden rounded-3xl transition-opacity duration-700 lg:block ${
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
  const [hydrated, setHydrated] = useState(false);
  const lightText = HERO_SLIDES[index].lightText;

  // All slides sit inside a visible box, so lazy loading never fires and the
  // browser would fetch three hero images on first paint. Ship only the first
  // in the SSR HTML; the rest mount well before the first autoplay tick.
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-white lg:h-[100dvh] lg:min-h-[600px] lg:bg-slate-900">
      {/* Below lg the box is taller than the 4/3 it used to be: the copy is
          pulled up onto its lower half, so the extra height is what keeps a
          clean band of photo above the headline. */}
      <div className="relative aspect-[4/5] w-full bg-white lg:absolute lg:inset-0 lg:aspect-auto lg:bg-slate-900">
        {HERO_SLIDES.map((slide, i) =>
          i > 0 && !hydrated ? null : (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* Art direction: two sources, one visible per breakpoint. Both
                  are in the DOM, so `sizes` collapses the inactive one to the
                  smallest candidate (~1KB) instead of downloading it twice. */}
              <Image
                src={slide.mobileSrc}
                alt={slide.alt}
                fill
                className="object-cover object-top lg:hidden"
                priority={i === 0}
                sizes="(min-width: 1024px) 1px, 100vw"
              />
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="hidden object-cover object-center lg:block"
                priority={i === 0}
                sizes="(max-width: 1023px) 1px, 100vw"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent"
                aria-hidden
              />
            </div>
          ),
        )}

        {/* Below lg the copy sits on the photo, so the lower half fades to the
            page white. One scrim outside the slide map — it must not fade in
            and out with the crossfade. Ends fully opaque so the copy's lower
            lines and the buttons land on plain white, not on a half-tone. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-white via-white/92 to-transparent lg:hidden"
          aria-hidden
        />
      </div>

      {/* UI layer: centered 1512px frame — fixed px offsets, stable across viewport widths */}
      <div className="pointer-events-none relative z-10 lg:absolute lg:inset-0">
        <div
          className="relative mx-auto h-auto w-full lg:h-full"
          style={
            {
              maxWidth: HERO_FRAME_MAX_PX,
              ["--hero-copy-left" as string]: `${HERO_COPY_LEFT_PX}px`,
              ["--hero-copy-offset-y" as string]: `${HERO_COPY_OFFSET_Y_PX}px`,
            } as React.CSSProperties
          }
        >
          {/* The pull-up is a percentage, so it resolves against this frame's
              width — the same number that drives the image box's height. Both
              scale together, so the overlap stays proportional at any width
              instead of eating the photo on small screens. */}
          <div className="pointer-events-auto relative -mt-[52%] w-full px-4 pb-10 sm:px-6 lg:absolute lg:left-[var(--hero-copy-left)] lg:top-1/2 lg:mt-0 lg:w-[min(52rem,calc(100%-3rem))] lg:-translate-y-[calc(50%-var(--hero-copy-offset-y,0px))] lg:px-0 lg:py-0">
            <CopyLegibilityWash lightText={lightText} />
            <p
              className={`mb-4 text-sm font-medium uppercase tracking-[0.16em] transition-colors duration-700 sm:text-base ${
                // Below lg the eyebrow is the topmost line on the photo, where
                // the scrim is thinnest — the darkest slide leaves it at 0.40
                // background luminance. sky-950 is the lightest step that
                // still clears 4.5:1 there without whitening out the photo.
                lightText
                  ? "text-sky-950 lg:text-sky-100/90"
                  : "text-sky-950 lg:text-sky-700/90"
              }`}
            >
              {HERO_COPY.eyebrow}
            </p>
            <h1
              className={`font-serif text-[2.5rem] font-semibold leading-[1.02] tracking-tight transition-colors duration-700 sm:text-5xl lg:text-[3.75rem] ${headlineColorClass(lightText)}`}
            >
              {HERO_COPY.title}
            </h1>
            <h2
              className={`mt-1 max-w-none font-serif text-[1.75rem] font-semibold leading-[1.08] tracking-tight transition-colors duration-700 sm:text-3xl lg:whitespace-nowrap lg:text-[2.5rem] ${headlineColorClass(lightText)}`}
            >
              {HERO_COPY.subTitle2}
            </h2>
            <p
              className={`mt-5 max-w-2xl text-base leading-relaxed transition-colors duration-700 sm:text-lg ${
                lightText
                  ? "text-slate-700 lg:text-white/88 lg:drop-shadow-[0_1px_14px_rgba(0,0,0,0.4)]"
                  : "text-slate-700/95 lg:drop-shadow-[0_1px_10px_rgba(255,255,255,0.35)]"
              }`}
            >
              {HERO_COPY.subtitle}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                href={HERO_COPY.primaryHref}
                className={`inline-block rounded-full px-8 py-3.5 text-base font-semibold shadow-md transition-colors duration-700 sm:text-lg ${
                  lightText
                    ? "bg-sky-500/90 text-white shadow-sky-900/10 hover:bg-sky-600 lg:border lg:border-white/90 lg:bg-white lg:text-sky-600 lg:shadow-slate-900/20 lg:hover:bg-sky-50"
                    : "bg-sky-500/90 text-white shadow-sky-900/10 hover:bg-sky-600"
                }`}
              >
                {HERO_COPY.primaryCta}
              </Link>
              <Link
                href={HERO_COPY.secondaryHref}
                className={`inline-block rounded-full border px-8 py-3.5 text-base font-semibold backdrop-blur-[2px] transition-colors duration-700 sm:text-lg ${
                  lightText
                    ? "border-sky-200/90 bg-white/70 text-sky-700 hover:bg-white lg:border-white/70 lg:bg-white/10 lg:text-white lg:hover:bg-white/20"
                    : "border-sky-200/90 bg-white/70 text-sky-700 hover:bg-white"
                }`}
              >
                {HERO_COPY.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="pointer-events-auto relative flex items-center justify-between gap-4 px-4 pb-8 sm:px-6 lg:absolute lg:bottom-8 lg:left-6 lg:right-6 lg:px-0 lg:pb-0">
            <div className="flex gap-2">
              {HERO_SLIDES.map((slide, i) => (
                <button
                  key={slide.src}
                  type="button"
                  onClick={() => setIndex(i)}
                  // The bar itself is 6px tall, so the touch target has to live
                  // on the wrapper — border-box padding would clip to 6px.
                  className="inline-flex h-11 items-center px-1 lg:h-auto lg:px-0"
                  aria-label={`Go to slide ${i + 1}`}
                >
                  <span
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === index
                        ? lightText
                          ? "w-8 bg-slate-800/75 lg:bg-white/90"
                          : "w-8 bg-slate-800/75"
                        : lightText
                          ? "w-3 bg-slate-800/35 lg:bg-white/40"
                          : "w-3 bg-slate-800/35"
                    }`}
                  />
                </button>
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
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-[2px] transition lg:h-9 lg:w-9 ${controlColorClass(lightText)}`}
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % HERO_SLIDES.length)}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-[2px] transition lg:h-9 lg:w-9 ${controlColorClass(lightText)}`}
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
