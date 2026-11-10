// 루트 레이아웃. 모든 페이지에 공통 적용된다.
// - 폰트 변수 등록: Geist·Noto Serif(기존), Instrument Sans(리뉴얼)
// - 사이트 메타데이터·구조화 데이터, 인증 Provider
// - GA4·Meta Pixel·Channel Talk 연결(각 환경변수가 있을 때만 동작)
// - data-scroll-behavior="smooth": 전역 smooth 스크롤을 페이지 이동 때만 끄고 즉시 상단 이동(Next 16)
// - Announcement Bar를 닫은 탭이면 첫 페인트 전에 <html>에 표시해 바를 숨긴다(sessionStorage)
// - NavigationIntent: 누른 링크·뒤로가기 시점 기록(FAQ가 일반 진입·딥링크·방문 기록 이동을 구분하는 데 사용)
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Sans, Noto_Serif } from "next/font/google";
import { AuthProvider } from "@/lib/auth/auth-context";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { ChannelTalk } from "@/components/channel-talk/ChannelTalk";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";
import { NavigationIntent } from "@/components/layout/NavigationIntent";
import { SITE_NAME, SITE_URL } from "@/lib/config/site";
import { ANNOUNCEMENT_DISMISSED_ATTR, ANNOUNCEMENT_DISMISSED_KEY } from "@/lib/config/promo";

/** Runs before first paint; storage errors (private mode, blocked storage) just leave the bar visible. */
const ANNOUNCEMENT_PREPAINT_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(ANNOUNCEMENT_DISMISSED_KEY)})==="1")document.documentElement.setAttribute(${JSON.stringify(ANNOUNCEMENT_DISMISSED_ATTR)},"")}catch(e){}`;
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Renewal font (Figma: Instrument Sans 400/500/600). Applied per component via `font-mdk`;
// the body stays on Geist until every legacy page (e.g. Contact) is migrated.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

/**
 * viewportFit: "cover" is required for env(safe-area-inset-*) to resolve to a
 * non-zero value on notched devices — StickyFormCta relies on it.
 * Deliberately no maximumScale/userScalable: blocking pinch-zoom to stop iOS
 * input zoom would fail WCAG 1.4.4. 16px inputs are the fix instead.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#38bdf8",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  category: "beauty manufacturing",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  title: {
    default:
      "Korean Cosmetics OEM & ODM Manufacturer for Global Brands | Medidakos",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Launch your K-beauty line in global markets. Medidakos connects you with GMP-certified Korean OEM/ODM manufacturers — custom formulas, MOQ from 3,000 units, and direct global freight. Free consultation.",
  keywords: [
    "Korean cosmetics OEM manufacturer",
    "Korean cosmetics ODM manufacturer",
    "K-beauty private label",
    "Korean skincare manufacturer for global brands",
    "Korean beauty contract manufacturing",
    "custom K-beauty formulation",
    "Korean cosmetic white label",
    "ISO 22716 GMP certified Korea",
    "K-beauty indie brand manufacturer",
    "Korean ODM platform",
    "private label skincare Korea",
    "K-beauty wholesale",
    "Korean beauty brand launch",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title:
      "Korean Cosmetics OEM & ODM Manufacturer for Global Brands | Medidakos",
    description:
      "Launch your K-beauty line in global markets. GMP-certified Korean OEM/ODM manufacturers — custom formulas, MOQ from 3,000 units, direct global freight.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — Korean Cosmetics OEM/ODM Platform for Global Beauty Brands",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@medidakos",
    title:
      "Korean Cosmetics OEM & ODM Manufacturer for Global Brands | Medidakos",
    description:
      "Launch your K-beauty line in global markets. GMP-certified Korean OEM/ODM manufacturers — custom formulas, MOQ from 3,000 units, direct global freight.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  ...(googleVerification
    ? { verification: { google: googleVerification } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const channelTalkPluginKey = process.env.NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY;

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      // The pre-paint script may add the announcement attribute before hydration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANNOUNCEMENT_PREPAINT_SCRIPT }} />
        <OrganizationJsonLd />
      </head>
      <body className="min-h-full flex flex-col">
        <NavigationIntent />
        <GoogleAnalytics gaId={gaId} />
        <MetaPixel pixelId={metaPixelId} />
        <AuthProvider>
          <ChannelTalk pluginKey={channelTalkPluginKey} gaId={gaId} />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
