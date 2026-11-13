// FAQ 페이지(/faq). SiteShell 안에 Hero → 카테고리 목록·Accordion → Contact CTA 순서로 렌더링한다.
// - 질문 딥링크 /faq#faq-001~039(Services 'Related questions' 등), 카테고리 앵커 #getting-started 등
// - 카테고리 목록 클릭은 해시 없이 이동(공용 SamePageHashUrl), 들어온 해시는 질문을 연 뒤 FaqAccordion이 지운다 → 주소창은 /faq
// - metadata 문구는 Figma Hero 문구만 사용(최종 SEO·OG는 사이트 전체 SEO 작업에서 지정)
import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { FaqContactCta } from "@/components/faq/FaqContactCta";
import { FaqHero } from "@/components/faq/FaqHero";
import { SamePageHashUrl } from "@/components/layout/SamePageHashUrl";
import { ROUTES } from "@/lib/config/routes";
import { SITE_URL } from "@/lib/config/site";

const TITLE = "FAQ — Frequently Asked Questions";
const DESCRIPTION = "Answers to the questions brands ask most before starting a project.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}${ROUTES.faq}`,
  },
  openGraph: {
    title: `${TITLE} | Medidakos`,
    description: DESCRIPTION,
    url: `${SITE_URL}${ROUTES.faq}`,
  },
};

/** Figma: FAQ — Final Design (1440 · desktop) (290:542), in on-canvas order. */
export default function FaqPage() {
  return (
    <SiteShell>
      <FaqHero />
      <FaqAccordion />
      <FaqContactCta />
      {/* Incoming /faq#… hashes are cleared by FaqAccordion after the question opens. */}
      <SamePageHashUrl clearIncomingHash={false} />
    </SiteShell>
  );
}
