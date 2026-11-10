// Services 페이지(/services). SiteShell 안에 Hero → 앵커 바(sticky) → 5개 앵커 섹션 → CTA Band 순서로 렌더링한다.
// - 앵커 id(#scope 등)는 Home·Footer의 SERVICES_SECTIONS 링크와 같다. 앵커 이동 후 주소창은 /services만 표시(공용 SamePageHashUrl)
// - metadata 문구는 Figma Hero의 확정 문구만 사용(OG 이미지는 최종 SEO 작업에서 지정)
import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ServicesAnchorBar } from "@/components/services/ServicesAnchorBar";
import { ServicesCtaBand } from "@/components/services/ServicesCtaBand";
import { ServicesHero } from "@/components/services/ServicesHero";
import { SamePageHashUrl } from "@/components/layout/SamePageHashUrl";
import { ServicesHowItWorks } from "@/components/services/ServicesHowItWorks";
import { ServicesPaymentShipping } from "@/components/services/ServicesPaymentShipping";
import { ServicesQualityCompliance } from "@/components/services/ServicesQualityCompliance";
import { ServicesSamplesMoq } from "@/components/services/ServicesSamplesMoq";
import { ServicesScope } from "@/components/services/ServicesScope";
import { ROUTES } from "@/lib/config/routes";
import { SITE_URL } from "@/lib/config/site";

const TITLE = "Services — From Idea to Launch, Fully Coordinated";
const DESCRIPTION =
  "Explore what we manage, how each stage works, and what to expect—from samples and MOQs to quality and compliance.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}${ROUTES.services}`,
  },
  openGraph: {
    title: `${TITLE} | Medidakos`,
    description: DESCRIPTION,
    url: `${SITE_URL}${ROUTES.services}`,
  },
};

/** Figma: Services — Final Design (1440 · desktop) (254:357), in on-canvas order. */
export default function ServicesPage() {
  return (
    <SiteShell>
      <SamePageHashUrl />
      <ServicesHero />
      <ServicesAnchorBar />
      <ServicesScope />
      <ServicesHowItWorks />
      <ServicesSamplesMoq />
      <ServicesPaymentShipping />
      <ServicesQualityCompliance />
      <ServicesCtaBand />
    </SiteShell>
  );
}
