"use client";

import { useEffect, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isAnalyticsHost, setActiveGaId, type AnalyticsTier } from "@/lib/analytics/analytics-env";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

type GoogleAnalyticsProps = {
  /** Already chosen for this build by resolveAnalyticsIds (undefined = GA off). */
  gaId?: string;
  tier: AnalyticsTier;
};

const subscribe = () => () => {};

/** 빌드 환경과 접속 호스트가 맞을 때만 로드한다(analytics-env.ts). 서버 렌더에서는 호스트를 알 수 없어 항상 꺼 둔다. */
export function GoogleAnalytics({ gaId, tier }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const enabled = useSyncExternalStore(subscribe, () => isAnalyticsHost(tier, window.location.hostname), () => false);

  useEffect(() => {
    setActiveGaId(enabled && gaId ? gaId : null);
  }, [enabled, gaId]);

  useEffect(() => {
    if (!enabled || !gaId || typeof window.gtag !== "function") return;

    window.gtag("config", gaId, {
      page_path: pathname,
    });
  }, [enabled, gaId, pathname]);

  if (!gaId || !enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
