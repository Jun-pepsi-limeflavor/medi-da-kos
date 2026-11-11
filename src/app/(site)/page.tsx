// Home 페이지(/). SiteShell(Announcement Bar·Navbar·Footer) 안에 Figma 최종 디자인 섹션을 순서대로 렌더링한다.
// - SiteShell을 레이아웃이 아닌 Page 루트로 감싸 페이지 첫 요소가 문서 최상단에서 시작한다.
//   Next.js는 이동 시 Page 첫 요소 기준으로 스크롤하므로 다른 페이지에서 와도 항상 최상단에서 열린다.
// - SEO metadata(제목·설명·canonical·Open Graph)는 기존 (marketing) Home 값을 그대로 유지
// - Promotion 팝업(PromoPopup): 새 방문의 첫 페이지가 Home일 때 약 1초 뒤 방문당 1회 자동 표시
import type { Metadata } from "next";
import { Certifications } from "@/components/home/Certifications";
import { CtaBand } from "@/components/home/CtaBand";
import { HomeHero } from "@/components/home/HomeHero";
import { KeyMetrics } from "@/components/home/KeyMetrics";
import { ProductCategories } from "@/components/home/ProductCategories";
import { SocialSection } from "@/components/home/SocialSection";
import { Testimonials } from "@/components/home/Testimonials";
import { WhyMedidakos } from "@/components/home/WhyMedidakos";
import { PromoPopup } from "@/components/promo/PromoPopup";
import { SiteShell } from "@/components/layout/SiteShell";
import { SITE_URL } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Korean Cosmetics OEM & ODM Manufacturing Platform for Global Brands",
  description:
    "Medidakos connects global beauty brands with GMP-certified Korean OEM/ODM manufacturers. Custom formulation, MOQ from 3,000 units, direct global freight — brief to first sample in 5 weeks. Get a free quote.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title:
      "Korean Cosmetics OEM & ODM Manufacturing Platform for Global Brands | Medidakos",
    description:
      "Connect with GMP-certified Korean OEM/ODM manufacturers. Custom formulas, MOQ from 3,000 units, direct global freight. Brief to first sample in 5 weeks.",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — Korean Cosmetics OEM/ODM Platform for Global Beauty Brands",
      },
    ],
  },
};

/** Figma: Home — Final Design (1440 · desktop) (234:5299), in on-canvas order. */
export default function HomePage() {
  return (
    <SiteShell>
      <HomeHero />
      <KeyMetrics />
      <Certifications />
      <WhyMedidakos />
      <ProductCategories />
      {/* Live posts arrive with the Instagram·TikTok feed integration; until then the section shows its empty state. */}
      <SocialSection posts={[]} />
      <Testimonials />
      <CtaBand />
      <PromoPopup />
    </SiteShell>
  );
}
