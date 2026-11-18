// 검색 노출 설정: 운영 배포 판별, robots 메타, sitemap 대상, 공통 OG 속성, 로그인·회원가입 메타데이터.
// - 운영 판별은 Vercel 시스템 변수 VERCEL_ENV === "production"만 허용(허용 목록 방식).
//   staging(custom environment `dev` → dev.medidakos.com)·Preview·로컬 빌드는 전부 비운영 → noindex.
//   VERCEL_ENV는 빌드·런타임 모두 제공되며 프로젝트의 System Environment Variables 노출이 켜져 있어야 한다(2026-11-16 확인: 켜짐).
import type { Metadata } from "next";
import { ROUTES } from "@/lib/config/routes";
import { SITE_NAME, SITE_URL } from "@/lib/config/site";

type Env = Record<string, string | undefined>;

/**
 * og:type·og:site_name·og:locale(영어 로케일)·og:image. 페이지의 openGraph는 Layout의 openGraph를 통째로 대체하므로
 * Layout과 공개 페이지가 모두 펼쳐 넣는다.
 */
/** 공통 OG·Twitter 이미지: Figma `OG Image — Final (L)`(1586:2)에서 내보낸 1200×630 PNG 원본 그대로. */
export const OG_IMAGE = {
  url: "/og/og-image.png",
  width: 1200,
  height: 630,
  alt: "Medidakos wordmark in white on a charcoal background, with Korean Cosmetics OEM and ODM Partner text.",
  type: "image/png",
};

export const OPEN_GRAPH_BASE = {
  type: "website" as const,
  siteName: SITE_NAME,
  locale: "en_US",
  images: [OG_IMAGE],
};

/** Twitter 카드 공통값. title·description은 페이지 openGraph에서 Next.js가 채운다. */
export const TWITTER_BASE = {
  card: "summary_large_image" as const,
  site: "@medidakos",
  images: [OG_IMAGE],
};

/** 검색엔진 색인을 허용하는 배포인가 — Vercel 운영 배포(main)만. */
export function isIndexableDeployment(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production";
}

/** Root layout robots 메타. 비운영 배포는 모든 페이지를 noindex, nofollow. */
export function siteRobots(env: Env = process.env): Metadata["robots"] {
  if (!isIndexableDeployment(env)) return { index: false, follow: false };
  return {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  };
}

/** Sitemap에 넣는 공개 페이지(운영 www 기준). 로그인·회원가입·리다이렉트 경로는 넣지 않는다. */
export const SITEMAP_PAGES = [
  { path: ROUTES.home, changeFrequency: "weekly", priority: 1.0 },
  { path: ROUTES.aboutUs, changeFrequency: "yearly", priority: 0.6 },
  { path: ROUTES.services, changeFrequency: "monthly", priority: 0.8 },
  { path: ROUTES.portfolio, changeFrequency: "monthly", priority: 0.8 },
  { path: ROUTES.faq, changeFrequency: "monthly", priority: 0.7 },
  { path: ROUTES.contact, changeFrequency: "monthly", priority: 0.7 },
  { path: ROUTES.privacy, changeFrequency: "yearly", priority: 0.3 },
  { path: ROUTES.terms, changeFrequency: "yearly", priority: 0.3 },
] as const;

/** 운영 절대 URL. Home은 다른 페이지의 canonical과 같게 끝 슬래시 없이 SITE_URL. */
export function absoluteUrl(path: string): string {
  return path === ROUTES.home ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * 로그인·회원가입 메타데이터. 항상 noindex이고, 자기 URL을 canonical로 두며
 * 전역(Home) description·OG·Twitter를 물려받지 않도록 각 항목을 직접 지정한다.
 */
function authMetadata(title: string, description: string, path: string): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { ...OPEN_GRAPH_BASE, title: `${title} | ${SITE_NAME}`, description, url },
    twitter: { ...TWITTER_BASE, title: `${title} | ${SITE_NAME}`, description },
  };
}

export const LOGIN_METADATA = authMetadata("Log in", `Log in to your ${SITE_NAME} account.`, ROUTES.login);
export const SIGNUP_METADATA = authMetadata("Sign up", `Create a ${SITE_NAME} account.`, ROUTES.signup);
