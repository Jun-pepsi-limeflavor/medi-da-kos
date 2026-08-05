import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /korea — 콜드메일 수신자 전용 랜딩. 검색 유입 대상이 아니고
      // 기존 페이지와 중복 콘텐츠로 잡힐 이유도 없다.
      disallow: ["/dashboard/", "/login", "/test", "/korea"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
