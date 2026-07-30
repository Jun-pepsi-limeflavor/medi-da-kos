import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ChannelTalk } from "@/components/support/ChannelTalk";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";
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

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

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
      "Korean Cosmetics OEM & ODM Manufacturer for US Brands | Medidakos",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Launch your K-beauty line in the US market. Medidakos connects you with GMP-certified Korean OEM/ODM manufacturers — custom formulas, low MOQ, and direct US freight. Free consultation.",
  keywords: [
    "Korean cosmetics OEM manufacturer",
    "Korean cosmetics ODM manufacturer",
    "K-beauty private label US",
    "Korean skincare manufacturer for US brands",
    "K-beauty OEM low MOQ",
    "Korean beauty contract manufacturing",
    "custom K-beauty formulation",
    "Korean cosmetic white label",
    "ISO 22716 GMP certified Korea",
    "K-beauty indie brand manufacturer",
    "Korean ODM platform",
    "private label skincare Korea",
    "K-beauty wholesale US",
    "Korean beauty brand launch",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title:
      "Korean Cosmetics OEM & ODM Manufacturer for US Brands | Medidakos",
    description:
      "Launch your K-beauty line in the US market. GMP-certified Korean OEM/ODM manufacturers — custom formulas, low MOQ, direct US freight.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Medidakos — Korean Cosmetics OEM/ODM Platform for US Beauty Brands",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@medidakos",
    title:
      "Korean Cosmetics OEM & ODM Manufacturer for US Brands | Medidakos",
    description:
      "Launch your K-beauty line in the US market. GMP-certified Korean OEM/ODM manufacturers — custom formulas, low MOQ, direct US freight.",
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
  const channelTalkPluginKey = process.env.NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <head>
        <OrganizationJsonLd />
      </head>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics gaId={gaId} />
        <AuthProvider>
          <ChannelTalk pluginKey={channelTalkPluginKey} gaId={gaId} />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
