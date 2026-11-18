import { SITE_URL, SOCIAL_LINKS } from "@/lib/config/site";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Medidakos",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-192.png`,
  description:
    "Your idea, made in Korea. Medidakos manages product development to launch for global beauty brands with 300+ Korean manufacturing and packaging partners.",
  areaServed: { "@type": "Place", name: "Worldwide" },
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
  // Same official accounts as the Footer (LinkedIn, Facebook, Instagram, TikTok).
  sameAs: SOCIAL_LINKS.map((link) => link.href),
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
