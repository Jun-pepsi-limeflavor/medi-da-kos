// Portfolio 페이지(/portfolio). SiteShell 안에 Hero → 카테고리 필터·제품 그리드 → CTA Band 순서로 렌더링한다.
// - 기본 선택은 All, Home 카테고리 타일의 /portfolio?category=<slug>로 들어오면 해당 카테고리 선택
// - 요청마다 렌더링(connection)해 ?category=로 들어와도 첫 화면부터 해당 카테고리 제품을 보여준다(깜빡임 없음)
// - metadata 문구는 Figma Hero의 확정 문구만 사용(OG 이미지는 최종 SEO 작업에서 지정)
import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteShell } from "@/components/layout/SiteShell";
import { PortfolioCatalog } from "@/components/portfolio/PortfolioCatalog";
import { PortfolioCtaBand } from "@/components/portfolio/PortfolioCtaBand";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { ROUTES } from "@/lib/config/routes";
import { SITE_URL } from "@/lib/config/site";

const TITLE = "Portfolio — Your Next Bestseller Starts Here";
const DESCRIPTION =
  "Explore the product categories and formulas we can develop for your brand with our Korean manufacturing partners.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}${ROUTES.portfolio}`,
  },
  openGraph: {
    title: `${TITLE} | Medidakos`,
    description: DESCRIPTION,
    url: `${SITE_URL}${ROUTES.portfolio}`,
  },
};

/** Figma: Portfolio — Facial care (1440 · desktop) (772:3270), in on-canvas order. Default filter is All. */
export default async function PortfolioPage() {
  await connection();
  return (
    <SiteShell>
      <PortfolioHero />
      <PortfolioCatalog />
      <PortfolioCtaBand />
    </SiteShell>
  );
}
