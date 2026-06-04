import type { Metadata } from "next";
import { HowItWorksPage } from "@/components/marketing/HowItWorksPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How It Works — Korean OEM/ODM Process, Brief to US Delivery",
  description:
    "Medidakos manages your entire Korean OEM/ODM journey in 5 steps: brief submission, custom formulation, physical sampling, packaging, and direct freight to your US warehouse. No factory sourcing needed.",
  alternates: {
    canonical: `${SITE_URL}/process`,
  },
  openGraph: {
    title:
      "How It Works — Korean OEM/ODM Process, Brief to US Delivery | Medidakos",
    description:
      "5-step Korean OEM/ODM process: brief submission, custom formulation, physical sampling, packaging, and direct US freight. No factory sourcing needed.",
    url: `${SITE_URL}/process`,
    images: [
      {
        url: "/og-process.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — From Brief to US Delivery in 5 Steps",
      },
    ],
  },
};

export default function ProcessRoute() {
  return <HowItWorksPage />;
}
