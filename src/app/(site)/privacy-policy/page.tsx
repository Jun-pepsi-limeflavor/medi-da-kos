// Privacy Policy 페이지(/privacy-policy). SiteShell 안에 문서 Header → 목차 + 14개 조항을 렌더링한다(Announcement Bar 없음).
// - 본문 원문: components/legal/privacy-policy-data.ts(Figma 548:1012 그대로)
// - metadata 설명은 본문 1조 둘째 문단 원문(최종 SEO는 사이트 전체 SEO 작업에서 정리)
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY_POLICY } from "@/components/legal/privacy-policy-data";
import { SiteShell } from "@/components/layout/SiteShell";
import { ROUTES } from "@/lib/config/routes";
import { SITE_URL } from "@/lib/config/site";

const TITLE = "Privacy Policy";
const DESCRIPTION =
  "This Privacy Policy explains how we collect, use, disclose, retain, and protect personal information when users visit our website, use our sign-up and login features, contact us, or communicate with us regarding cosmetic product development and manufacturing services.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}${ROUTES.privacy}`,
  },
  openGraph: {
    title: `${TITLE} | Medidakos`,
    description: DESCRIPTION,
    url: `${SITE_URL}${ROUTES.privacy}`,
  },
};

/** Figma: Privacy Policy — Final Design (1440 · desktop) (548:1012). */
export default function PrivacyPolicyPage() {
  return (
    <SiteShell>
      <LegalDocument data={PRIVACY_POLICY} />
    </SiteShell>
  );
}
