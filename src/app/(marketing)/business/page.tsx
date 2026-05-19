import Link from "next/link";
import { Award, Beaker, Building2, Users } from "lucide-react";

export default function BusinessPage() {
  return (
    <div className="bg-gradient-to-b from-sky-50/80 to-white">
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600">
          Business
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-slate-800">
          Korea&apos;s most advanced cosmetic ODM network
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Medi Da Kos connects global beauty brands with Korean manufacturers
          known for cutting-edge R&D, rigorous quality systems, and competitive
          production economics.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {[
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
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-sky-100 bg-white p-8 shadow-sm"
            >
              <item.icon className="h-10 w-10 text-sky-600" />
              <h2 className="mt-4 text-xl font-semibold text-slate-800">
                {item.title}
              </h2>
              <p className="mt-3 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>

        <section className="mt-20 rounded-2xl border border-sky-100 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-800">
            Partner reference
          </h2>
          <p className="mt-4 text-slate-600">
            Our manufacturing network includes partners trusted by leading K-beauty
            and global brands. Reference inquiries available upon NDA for qualified
            brand operators.
          </p>
          <p className="mt-4 text-sm font-medium text-sky-700">
            Contact: contact@techasset.co.kr
          </p>
        </section>

        <div className="mt-12">
          <Link
            href="/login"
            className="inline-block rounded-full bg-sky-600 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Start your custom brief
          </Link>
        </div>
      </section>
    </div>
  );
}
