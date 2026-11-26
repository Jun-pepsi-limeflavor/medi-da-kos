"use client";

import { useEffect, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isAnalyticsHost, setActiveGaId, type AnalyticsTier } from "@/lib/analytics/analytics-env";
import { GOOGLE_CONSENT_DEFAULT, googleConsentState } from "@/lib/analytics/google-consent";
import { useEffectiveConsent } from "@/lib/cookie-consent/consent";

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

/**
 * 빌드 환경과 접속 호스트가 맞고(analytics-env.ts) Analytics 동의가 있을 때만 로드한다(Consent Mode Basic).
 * 로드 시 Consent Mode 기본값을 모두 denied로 둔 뒤 현재 선택으로 update한다 — 광고 신호(ad_*)는 Marketing 동의를 따른다.
 * 서버 렌더에서는 호스트·동의를 알 수 없어 항상 꺼 둔다. 동의 축소·철회는 ConsentEnforcer가 처리한다.
 */
export function GoogleAnalytics({ gaId, tier }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const hostOk = useSyncExternalStore(subscribe, () => isAnalyticsHost(tier, window.location.hostname), () => false);
  const consent = useEffectiveConsent();
  const enabled = hostOk && consent?.analytics === true;
  const marketing = consent?.marketing === true;

  useEffect(() => {
    setActiveGaId(enabled && gaId ? gaId : null);
  }, [enabled, gaId]);

  useEffect(() => {
    if (!enabled || !gaId || typeof window.gtag !== "function") return;

    window.gtag("config", gaId, {
      page_path: pathname,
    });
  }, [enabled, gaId, pathname]);

  // Marketing granted after GA loaded: update the ad signals in place (a withdrawal reloads the page instead).
  useEffect(() => {
    if (!enabled || typeof window.gtag !== "function") return;
    window.gtag("consent", "update", googleConsentState({ analytics: true, marketing }));
    window.gtag("set", "ads_data_redaction", !marketing);
  }, [enabled, marketing]);

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
          gtag('consent', 'default', ${JSON.stringify(GOOGLE_CONSENT_DEFAULT)});
          gtag('consent', 'update', ${JSON.stringify(googleConsentState({ analytics: true, marketing }))});
          gtag('set', 'ads_data_redaction', ${!marketing});
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
