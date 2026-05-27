import Image from "next/image";
import Link from "next/link";
import { Award, Beaker, Building2, Users } from "lucide-react";
import { SplitHeroBrand } from "@/components/marketing/SplitHeroBrand";

const STRENGTHS = [
  {
    icon: Building2,
    title: "State-of-the-art facilities",
    text: "Automated filling lines, clean-room environments, and ISO 22716–aligned processes modeled after leading biopharma standards.",
  },
  {
    icon: Beaker,
    title: "Deep formulation expertise",
    text: "From hyaluronic systems to PDRN and barrier-care — our partner labs develop market-proven actives and textures.",
  },
  {
    icon: Award,
    title: "Proven quality & trust",
    text: "Long-standing supply relationships with brands worldwide. Every project receives dedicated technical and account oversight.",
  },
  {
    icon: Users,
    title: "Customer-first partnership",
    text: "We manage communication, timelines, and compliance so you can focus on brand growth and go-to-market.",
  },
] as const;

export default function AboutUsPage() {
  return (
    <div className="bg-white">
      <section className="relative -mt-16 h-[100dvh] min-h-[600px] w-full overflow-hidden bg-sky-50">
        <Image
          src="/About_Us1.png"
          alt=""
          fill
          unoptimized
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        <div className="absolute inset-0 z-10 flex w-full items-center justify-center">
          <SplitHeroBrand
            title="Medi Da Kos"
            leftTagline="Beauty engineered to perform. Built to scale."
            rightTagline="Beauty engineered to perform. Built to scale."
          />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
      </section>

      <section className="bg-gradient-to-b from-white via-sky-50/40 to-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600">
            About Us
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
            Korea&apos;s most advanced cosmetic ODM network
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Medi Da Kos connects global beauty brands with Korean manufacturers
            known for cutting-edge R&D, rigorous quality systems, and competitive
            production economics.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {STRENGTHS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-sky-100/90 bg-white/85 p-8 shadow-sm shadow-sky-100/30 backdrop-blur-sm"
              >
                <item.icon className="h-10 w-10 text-sky-600" />
                <h2 className="mt-4 text-xl font-semibold text-slate-800">
                  {item.title}
                </h2>
                <p className="mt-3 leading-relaxed text-slate-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          <section className="mt-20 rounded-2xl border border-sky-100/90 bg-white/85 p-8 shadow-sm shadow-sky-100/30 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-slate-800">
              Partner reference
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              Our manufacturing network includes partners trusted by leading
              K-beauty and global brands. Reference inquiries available upon NDA
              for qualified brand operators.
            </p>
            <p className="mt-4 text-sm font-medium text-sky-700">
              Contact: contact@techasset.co.kr
            </p>
          </section>

          <div className="mt-12">
            <Link
              href="/login"
              className="inline-block rounded-full bg-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-700"
            >
              Start your custom brief
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
