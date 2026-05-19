import Link from "next/link";
import { HeroCarousel } from "@/components/marketing/HeroCarousel";
import {
  Droplets,
  Factory,
  Globe,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

export default function HomePage() {
  return (
    <>
      <HeroCarousel />

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-sky-600">
            Why Medi Da Kos
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-semibold text-slate-800">
            Full custom ODM — beyond private label
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
            Unlike catalog-only platforms, we broker true custom manufacturing
            with Korea&apos;s leading cosmetic ODM partners.
          </p>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Factory,
                title: "Advanced K-Beauty Manufacturing",
                text: "GMP-certified facilities with pharmaceutical-grade QC and scalable production.",
              },
              {
                icon: Droplets,
                title: "Hydration-First Formulation",
                text: "Science-led textures and active systems tailored to your brand positioning.",
              },
              {
                icon: ShieldCheck,
                title: "Trusted & Transparent",
                text: "End-to-end visibility from brief to bulk production with dedicated account care.",
              },
              {
                icon: Globe,
                title: "Global Shipping Ready",
                text: "Sample and bulk logistics via FedEx, DHL, UPS with full tracking support.",
              },
              {
                icon: Sparkles,
                title: "Competitive Quality–Price",
                text: "Direct factory relationships that deliver premium products at strong margins.",
              },
              {
                icon: Workflow,
                title: "6-Step Digital Brief",
                text: "Structured CM workflow from category to compliance — save drafts anytime.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-sky-50 bg-gradient-to-b from-sky-50/50 to-white p-6"
              >
                <item.icon className="h-8 w-8 text-sky-600" />
                <h3 className="mt-4 font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-sky-950 to-sky-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold">Ready to build your line?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sky-100">
            Start your custom manufacturing brief or request samples from our
            top-selling Korean formulas.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-sky-900 shadow-lg hover:bg-sky-50"
          >
            Get started — it&apos;s free
          </Link>
        </div>
      </section>
    </>
  );
}
