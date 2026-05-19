"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1920&q=80",
    title: "Custom K-Beauty ODM, Built for Your Brand",
    subtitle:
      "Connect with Korea's most advanced cosmetic manufacturers. Full customization — not just private label.",
    cta: "Start Your Custom Brief",
    href: "/login",
  },
  {
    image:
      "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1920&q=80",
    title: "Pharmaceutical-Grade Quality. Factory-Ready Scale.",
    subtitle:
      "Transparent processes, rigorous QC, and competitive pricing from trusted Korean ODM partners.",
    cta: "Explore How It Works",
    href: "/how-it-works",
  },
  {
    image:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1920&q=80",
    title: "From Concept to Shelf — One Platform",
    subtitle:
      "Six-step custom brief wizard, sample requests, order tracking, and dedicated account support.",
    cta: "View Pricing",
    href: "/pricing",
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[index]!;

  return (
    <section className="relative h-[min(88vh,720px)] w-full overflow-hidden bg-sky-950">
      {slides.map((s, i) => (
        <div
          key={s.title}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={s.image}
            alt=""
            fill
            className="object-cover opacity-50"
            priority={i === 0}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-sky-950/90 via-sky-900/70 to-cyan-900/40" />
        </div>
      ))}

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-cyan-200">
          Korea ODM Brokerage Platform
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          {slide.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-sky-100">{slide.subtitle}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={slide.href}
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-sky-900 shadow-lg transition hover:bg-sky-50"
          >
            {slide.cta}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-white/40 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Talk to Our Team
          </Link>
        </div>

        <div className="absolute bottom-8 left-4 right-4 flex items-center justify-between sm:left-6 sm:right-6 lg:left-8 lg:right-8">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-white" : "w-4 bg-white/40"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setIndex((i) => (i - 1 + slides.length) % slides.length)
              }
              className="rounded-full border border-white/30 p-2 text-white hover:bg-white/10"
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              className="rounded-full border border-white/30 p-2 text-white hover:bg-white/10"
              aria-label="Next slide"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
