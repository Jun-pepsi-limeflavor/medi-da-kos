import { SITE_URL } from "@/lib/site";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Medidakos",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description:
    "Korean cosmetics OEM/ODM platform connecting US beauty brands with GMP-certified Korean manufacturers.",
  areaServed: ["US", "CA", "GB", "AU"],
  serviceType: [
    "OEM Cosmetics Manufacturing",
    "ODM Cosmetics Development",
    "K-beauty Private Label",
    "Custom Skincare Formulation",
  ],
  knowsAbout: [
    "K-beauty",
    "Korean cosmetics",
    "ISO 22716",
    "GMP manufacturing",
  ],
  sameAs: ["https://www.linkedin.com/company/medidakos"],
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
