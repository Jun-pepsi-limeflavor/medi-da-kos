import { SITE_NAME, SITE_URL } from "@/lib/config/site";

// Google 검색결과 사이트 이름용 WebSite 구조화 데이터(Search Central: site names). Home에서만 1회 출력한다.
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

export function WebSiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
    />
  );
}
