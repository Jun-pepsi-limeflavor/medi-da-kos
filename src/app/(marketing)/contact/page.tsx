import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/contact/ContactForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — Get in Touch About Korean OEM/ODM Manufacturing",
  description:
    "Reach out to Medidakos about Korean cosmetics OEM/ODM manufacturing. No login required — tell us about your brand, product category, and timeline.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    title: "Contact Medidakos — Korean OEM/ODM for US Beauty Brands",
    description:
      "Get in touch about Korean cosmetics manufacturing. Share your product idea, expected volume, and launch timeline.",
    url: `${SITE_URL}/contact`,
  },
};

function ContactFormFallback() {
  return (
    <div className="rounded-xl border border-sky-100/80 bg-white px-6 py-8 shadow-sm shadow-sky-100/30 sm:px-8">
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-sky-50" />
        ))}
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="py-14">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
            Contact us
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Have a product in mind? Tell us about your brand and we&apos;ll help
            you explore Korean OEM/ODM options — no account needed.
          </p>
        </div>

        <Suspense fallback={<ContactFormFallback />}>
          <ContactForm />
        </Suspense>
      </div>
    </div>
  );
}
