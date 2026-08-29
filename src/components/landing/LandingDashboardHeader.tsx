"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Droplets,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { trackLandingEvent } from "@/lib/analytics";
import { SpecularButton } from "./SpecularButton";

export interface LandingDashboardHeaderProps {
  currentStep?: number;
  message?: string | null;
  isStarted?: boolean;
  onStart?: () => void;
}

const ROADMAP_STEPS = [
  {
    step: "01",
    title: "Submit Brief",
    duration: "~3 mins",
    description: "Share concept, volume & specs",
    active: true,
  },
  {
    step: "02",
    title: "Lab Sampling & Review",
    duration: "1–2 weeks",
    description: "Physical custom samples shipped to you",
    active: false,
  },
  {
    step: "03",
    title: "Production & Delivery",
    duration: "Sea / Air",
    description: "SWIFT wire & direct warehouse delivery",
    active: false,
  },
] as const;

const HERO_GALLERY_SLIDES = [
  {
    src: "/medidakos_main1.webp",
    alt: "Korean OEM/ODM clean manufacturing lab & formulation R&D",
  },
  {
    src: "/landing/catalog/pdrn-glow-booster.png",
    alt: "PDRN Glow Booster custom serum formulation & finished packaging",
  },
  {
    src: "/landing/catalog/cloud-root-soothing-serum.png",
    alt: "Cloud Root Soothing Serum calming formulation for sensitive skin",
  },
  {
    src: "/landing/catalog/retinol-matrix-repair-serum.png",
    alt: "Retinol Matrix Repair Serum active anti-aging formulation",
  },
  {
    src: "/landing/catalog/green-apple-capsule-serum.png",
    alt: "Green Apple Capsule Serum active pore-refining formulation",
  },
] as const;

export function LandingDashboardHeader({
  message,
  isStarted,
  onStart,
}: LandingDashboardHeaderProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % HERO_GALLERY_SLIDES.length);
    }, 4200);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="mb-6 flex flex-col gap-4" data-testid="landing-dashboard-header">
      {/* 50/50 Split Hero Grid with Reduced Gap */}
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-6">
        {/* Left Column: Title, Value Proposition, Stepper & CTA */}
        <div className="flex flex-col gap-3.5 lg:col-span-7">
          <div>
            {message && (
              <div className="mb-2">
                <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {message}
                </span>
              </div>
            )}

            <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Product Manufacturing Brief
            </h1>

            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-600 sm:text-sm">
              Tell us what you&apos;re building. We handle the rest — matching with
              verified Korean OEM/ODM labs, formulation from scratch, and direct global
              delivery with protected margins.
            </p>
          </div>

          {/* How It Works 3-Step Process Stepper */}
          <div className="rounded-2xl border border-sky-100/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-sm sm:p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                How It Works
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                Stage 1 in progress
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-2.5">
              {ROADMAP_STEPS.map((item, idx) => {
                const isCurrent = idx === 0;
                return (
                  <div
                    key={item.step}
                    className={`relative flex flex-col justify-between rounded-xl border p-2.5 transition ${
                      isCurrent
                        ? "border-sky-400 bg-sky-50/60 shadow-2xs ring-1 ring-sky-300/40"
                        : "border-slate-200/80 bg-slate-50/40 opacity-85"
                    }`}
                  >
                    {/* Top Row: Step Number & Duration Badge (Right-aligned to avoid overflow) */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          isCurrent
                            ? "bg-sky-600 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {item.step}
                      </span>
                      <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 shadow-2xs ring-1 ring-slate-200/80 whitespace-nowrap">
                        {item.duration}
                      </span>
                    </div>

                    {/* Middle: Title with Full Width */}
                    <h2
                      className={`mt-2 text-xs font-semibold leading-tight ${
                        isCurrent ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {item.title}
                    </h2>

                    {/* Bottom: Description */}
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">
                      {item.description}
                    </p>

                    {idx < ROADMAP_STEPS.length - 1 && (
                      <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 z-10 sm:block">
                        <div className="rounded-full bg-white p-0.5 text-slate-400 shadow-2xs ring-1 ring-slate-200">
                          <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Premium Visual Rotating Gallery with Floating Badges */}
        <div className="relative mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-100/50 p-2 shadow-lg shadow-sky-100/50">
            {/* Gallery Image Slides with Ken Burns Crossfade */}
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-900">
              {HERO_GALLERY_SLIDES.map((slide, idx) => {
                const isActive = idx === currentSlideIndex;
                return (
                  <div
                    key={slide.src}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      isActive
                        ? "opacity-100 z-0"
                        : "opacity-0 pointer-events-none -z-10"
                    }`}
                  >
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      priority={idx === 0}
                      className={`object-cover object-center brightness-[1.03] contrast-[1.02] transition-transform duration-[6000ms] ease-out ${
                        isActive ? "scale-105" : "scale-100"
                      }`}
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                  </div>
                );
              })}

              {/* Soft overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-white/15 pointer-events-none z-10" />

              {/* Slide Indicator Dots (bottom-right) */}
              <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-1 backdrop-blur-md">
                {HERO_GALLERY_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.src}
                    type="button"
                    onClick={() => setCurrentSlideIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentSlideIndex
                        ? "w-4 bg-white"
                        : "w-1.5 bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>

              {/* Floating Badge 1: 40%+ Cost Savings */}
              <div className="animate-float absolute left-3 top-3 z-20 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/85 px-3 py-1.5 shadow-md shadow-sky-950/10 backdrop-blur-md transition hover:scale-105">
                <div className="rounded-lg bg-sky-500 p-1.5 text-white">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">40%+ Savings</p>
                  <p className="text-[10px] text-slate-500">Factory direct</p>
                </div>
              </div>

              {/* Floating Badge 2: 1-2 Wks Sampling */}
              <div className="animate-float-delayed absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/85 px-3 py-1.5 shadow-md shadow-sky-950/10 backdrop-blur-md transition hover:scale-105">
                <div className="rounded-lg bg-amber-500 p-1.5 text-white">
                  <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">1–2 Wks</p>
                  <p className="text-[10px] text-slate-500">Custom samples</p>
                </div>
              </div>

              {/* Floating Badge 3: ISO 22716 GMP */}
              <div className="animate-float-slow absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/85 px-3 py-1.5 shadow-md shadow-sky-950/10 backdrop-blur-md transition hover:scale-105">
                <div className="rounded-lg bg-emerald-600 p-1.5 text-white">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">ISO 22716 GMP</p>
                  <p className="text-[10px] text-slate-500">FDA · EU CPNP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Brief CTA Banner with Reduced Padding */}
      {onStart && (
        <div className="pt-0.5">
          {!isStarted ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50/80 via-white to-sky-50/50 p-5 text-center shadow-2xs sm:p-6">
              <div className="max-w-xl">
                <h3 className="text-base font-semibold text-slate-800 sm:text-lg">
                  Ready to start your manufacturing brief?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Select your product category, volume &amp; specs in 6 quick steps.
                  Our PM and R&amp;D team will evaluate your formula and match the best Korean GMP manufacturer.
                </p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <SpecularButton
                    onClick={() => {
                      trackLandingEvent("cta_click", "dashboard", { cta_id: "start_brief" });
                      onStart();
                    }}
                    data-cta="start_brief"
                    data-testid="start-brief-btn"
                    size="md"
                    radius={28}
                    bg="#0ea5e9"
                    bgHover="#0284c7"
                    textColor="#ffffff"
                    lineColor="#ffffff"
                    baseColor="#7dd3fc"
                    intensity={2.5}
                    shineSize={28}
                    shineFade={50}
                    thickness={1.4}
                    proximity={450}
                    speed={0.45}
                    followMouse
                    className="shadow-md shadow-sky-300/60 active:scale-[0.98]"
                  >
                    <span className="inline-flex items-center gap-2 font-semibold">
                      Start Your Product Brief
                      <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
                    </span>
                  </SpecularButton>
                  <span className="text-[11px] text-slate-500">
                    Takes ~3 minutes · Free consultation · No account required
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2 font-medium text-sky-800">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Brief in progress — editing below
              </span>
              <button
                type="button"
                data-cta="scroll_to_form"
                onClick={() => {
                  trackLandingEvent("cta_click", "dashboard", { cta_id: "scroll_to_form" });
                  onStart();
                }}
                className="font-medium text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
              >
                Scroll to form ↓
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
