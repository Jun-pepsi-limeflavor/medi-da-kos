// About Us 페이지(/about-us). SiteShell(Announcement Bar·Navbar·Footer) 안에 Figma 최종 디자인 섹션을 순서대로 렌더링한다.
// - Home과 같이 SiteShell을 Page 루트에서 감싸 이동 시 최상단에서 열린다
// - SEO metadata(제목·설명·canonical·Open Graph)는 기존 (marketing) About Us 값을 그대로 유지
import type { Metadata } from "next";
import { AboutChallenge } from "@/components/about/AboutChallenge";
import { AboutCtaBand } from "@/components/about/AboutCtaBand";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutTransition } from "@/components/about/AboutTransition";
import { AboutWhoWeAre } from "@/components/about/AboutWhoWeAre";
import { AboutWhyApproach } from "@/components/about/AboutWhyApproach";
import { SiteShell } from "@/components/layout/SiteShell";
import { SITE_URL } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "About Us — Vetted Korean OEM/ODM Manufacturer Network for Global Brands",
  description:
    "Medidakos operates a pre-vetted network of ISO 22716 GMP-certified Korean OEM/ODM manufacturers with global export experience. English-speaking PMs, MFDS-registered facilities, direct global freight.",
  alternates: {
    canonical: `${SITE_URL}/about-us`,
  },
  openGraph: {
    title:
      "About Medidakos — Vetted Korean OEM/ODM Manufacturer Network for Global Brands",
    description:
      "Pre-vetted ISO 22716 GMP-certified Korean OEM/ODM manufacturers. English-speaking PMs, MFDS-registered facilities, global export experience.",
    url: `${SITE_URL}/about-us`,
    images: [
      {
        url: "/og-about-us.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — Vetted Korean OEM/ODM Manufacturer Network for Global Beauty Brands",
      },
    ],
  },
};

/** Figma: About Us — Final Design (1440 · desktop) (422:2), in on-canvas order. */
export default function AboutUsPage() {
  return (
    <SiteShell>
      <AboutHero />
      <AboutChallenge />
      <AboutTransition />
      <AboutWhyApproach />
      <AboutWhoWeAre />
      <AboutCtaBand />
    </SiteShell>
  );
}
