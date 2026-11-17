// sitemap.xml — 공개 페이지 8개만, 운영 www URL 기준(SITEMAP_PAGES).
import type { MetadataRoute } from "next";
import { SITEMAP_PAGES, absoluteUrl } from "@/lib/config/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
  }));
}
