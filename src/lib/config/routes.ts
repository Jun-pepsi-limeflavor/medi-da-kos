// 사이트 경로와 Navbar 관련 설정을 한곳에서 관리한다.
// - 페이지 경로, Services 섹션 앵커, 로그인·가입·로그아웃 후 이동 경로
// - Navbar 메뉴 목록과 현재 메뉴 판정, Announcement Bar 표시 페이지

/** App routes — change paths here to update links across the app. */
export const ROUTES = {
  home: "/",
  aboutUs: "/about-us",
  services: "/services",
  portfolio: "/portfolio",
  faq: "/faq",
  login: "/login",
  signup: "/signup",
  contact: "/contact",
  // Figma annotation: /privacy · /terms (final URL still marked TBD there).
  privacy: "/privacy",
  terms: "/terms",
} as const;

/** Section anchors on /services (Figma: Services Anchor Bar, Footer Services column). */
export const SERVICES_SECTIONS = {
  scope: `${ROUTES.services}#scope`,
  howItWorks: `${ROUTES.services}#how-it-works`,
  samplesMoq: `${ROUTES.services}#samples-moq`,
  paymentShipping: `${ROUTES.services}#payment-shipping`,
  qualityCompliance: `${ROUTES.services}#quality-compliance`,
} as const;

/** Where to send the user right after creating an account */
export const REDIRECT_AFTER_REGISTER = ROUTES.home;

/** Where to send the user right after logging in (Dashboard는 2차 개발 전까지 없다) */
export const REDIRECT_AFTER_LOGIN = ROUTES.home;

/** Where to send the user right after logging out (Phase 1) */
export const REDIRECT_AFTER_LOGOUT = ROUTES.home;

/** Navbar menu, in Figma order. Home and Contact have no menu item. */
export const NAV_ITEMS = [
  { href: ROUTES.aboutUs, label: "About Us" },
  { href: ROUTES.services, label: "Services" },
  { href: ROUTES.portfolio, label: "Portfolio" },
  { href: ROUTES.faq, label: "FAQ" },
] as const;

/**
 * Navbar item to mark active for a pathname (query and hash are not part of it,
 * so /portfolio?category=… and /services#scope stay active).
 */
export function activeNavHref(pathname: string): string | null {
  const item = NAV_ITEMS.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return item ? item.href : null;
}

/** Pages that show the Announcement Bar (Figma: Home · About Us · Services · Portfolio · FAQ). */
const ANNOUNCEMENT_BAR_PATHS: readonly string[] = [
  ROUTES.home,
  ROUTES.aboutUs,
  ROUTES.services,
  ROUTES.portfolio,
  ROUTES.faq,
];

export function showsAnnouncementBar(pathname: string): boolean {
  return ANNOUNCEMENT_BAR_PATHS.includes(pathname);
}
