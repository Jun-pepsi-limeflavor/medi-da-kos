// robots.txt — 운영(VERCEL_ENV=production)만 전체 허용 + sitemap, 그 외 배포는 전체 차단.
// /login·/signup은 robots로 막지 않는다(막으면 크롤러가 페이지의 noindex를 읽지 못한다).
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config/site";
import { isIndexableDeployment } from "@/lib/config/seo";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
