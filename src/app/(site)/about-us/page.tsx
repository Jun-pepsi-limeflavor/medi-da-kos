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
import { OPEN_GRAPH_BASE } from "@/lib/config/seo";
import { SITE_URL } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "About Us — Korean Know-How for Global Beauty Brands",
  description:
    "From Seoul, Medidakos connects global beauty brands with Korea’s manufacturing expertise through a vetted partner network and end-to-end project management.",
  alternates: {
    canonical: `${SITE_URL}/about-us`,
  },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    title: "About Us — Korean Know-How for Global Beauty Brands | Medidakos",
    description:
      "From Seoul, Medidakos connects global beauty brands with Korea’s manufacturing expertise through a vetted partner network and end-to-end project management.",
    url: `${SITE_URL}/about-us`,
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
