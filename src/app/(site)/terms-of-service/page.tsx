// Terms of Service 페이지(/terms-of-service). SiteShell 안에 문서 Header → 목차 + 12개 조항을 렌더링한다(Announcement Bar 없음).
// - 본문 원문: components/legal/terms-of-service-data.ts(Figma 549:1057 그대로)
// - metadata 설명은 본문 1조 둘째 문단 원문(최종 SEO는 사이트 전체 SEO 작업에서 정리)
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS_OF_SERVICE } from "@/components/legal/terms-of-service-data";
import { SiteShell } from "@/components/layout/SiteShell";
import { ROUTES } from "@/lib/config/routes";
import { SITE_URL } from "@/lib/config/site";

const TITLE = "Terms of Service";
const DESCRIPTION =
  "These Terms of Service (hereinafter referred to as the “Terms”) apply to the use of our website, user registration and login, the customer dashboard, consultations, quotations, and project-related services.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}${ROUTES.terms}`,
  },
  openGraph: {
    title: `${TITLE} | Medidakos`,
    description: DESCRIPTION,
    url: `${SITE_URL}${ROUTES.terms}`,
  },
};

/** Figma: Terms of Service — Final Design (1440 · desktop) (549:1057). */
export default function TermsOfServicePage() {
  return (
    <SiteShell>
      <LegalDocument data={TERMS_OF_SERVICE} />
    </SiteShell>
  );
}
