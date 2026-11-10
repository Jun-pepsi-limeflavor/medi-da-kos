// Contact 페이지(/contact). SiteShell 안에 Hero → 문의 폼 + 오른쪽 안내 영역 순서로 렌더링한다(Announcement Bar 없음).
// - ?promo=year-end-2026 진입 여부를 요청마다 읽어 폼에 전달(프로모션 기간에만 체크박스·Year-end offer 카드 표시)
// - Hero와 문의 영역 사이 전체 폭 구분선(Figma 섹션 상단 1px), 구분선 아래 48px(모바일 32px)에서 폼·오른쪽 카드가 같은 높이로 시작
// - 카드 순서(문서·Tab·스크린리더 순서와 같음): Year-end offer(프로모션 기간에만) → 문의 폼 → 나머지 안내 카드
//   1열(xl 미만)은 이 순서대로 쌓고, xl 이상 2열은 그리드로 왼쪽 폼 / 오른쪽 offer·안내 카드(Figma 데스크톱 배치) 유지.
//   안내 카드 묶음은 오른쪽 열 남은 높이 안에서 sticky top 96px(Navbar 72 + 24)
// - 문의 폼은 Mock 제출 단계 — 실제 저장·Channel Talk·메일 연동은 dev 통합 단계에서 구현
// - metadata는 기존 (marketing) Contact 값을 그대로 유지(최종 SEO는 사이트 전체 SEO 작업에서 정리)
import type { Metadata } from "next";
import { ContactHero } from "@/components/contact/ContactHero";
import { ContactOffer, ContactSide } from "@/components/contact/ContactSide";
import { InquiryForm } from "@/components/contact/InquiryForm";
import { SECTION_CONTAINER } from "@/components/home/styles";
import { SiteShell } from "@/components/layout/SiteShell";
import { YEAR_END_PROMO, isYearEndPromoActive } from "@/lib/config/promo";
import { SITE_URL } from "@/lib/config/site";
import { cx } from "@/lib/utils/cx";

export const metadata: Metadata = {
  title: "Contact — Get in Touch About Korean OEM/ODM Manufacturing",
  description:
    "Reach out to Medidakos about Korean cosmetics OEM/ODM manufacturing. No login required — tell us about your brand, product category, and timeline.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    title: "Contact Medidakos — Korean OEM/ODM for Global Beauty Brands",
    description:
      "Get in touch about Korean cosmetics manufacturing. Share your product idea, expected volume, and launch timeline.",
    url: `${SITE_URL}/contact`,
  },
};

/** Figma: Contact — Final Design (1440 · desktop) (291:689), in on-canvas order. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ promo?: string | string[] }> }) {
  const { promo } = await searchParams;
  const showPromo = isYearEndPromoActive();
  const promoFromLink = showPromo && promo === YEAR_END_PROMO.code;

  return (
    <SiteShell>
      <ContactHero />
      <section className="border-t border-mdk-light-gray bg-mdk-white pt-8 pb-20 lg:pt-12 lg:pb-40">
        <div
          className={cx(
            SECTION_CONTAINER,
            "grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_416px] xl:grid-rows-[auto_1fr] xl:gap-x-16 xl:gap-y-6",
          )}
        >
          {showPromo ? <ContactOffer className="xl:col-start-2 xl:row-start-1" /> : null}
          <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
            <InquiryForm showPromo={showPromo} promoFromLink={promoFromLink} />
          </div>
          <ContactSide
            className={cx("xl:sticky xl:top-24 xl:col-start-2", showPromo ? "xl:row-start-2" : "xl:row-span-2 xl:row-start-1")}
          />
        </div>
      </section>
    </SiteShell>
  );
}
