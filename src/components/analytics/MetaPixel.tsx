"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isAnalyticsHost, type AnalyticsTier } from "@/lib/analytics/analytics-env";
import { isQaVisit } from "@/lib/utils/env-flags";

type MetaPixelProps = {
  /** Already chosen for this build by resolveAnalyticsIds (undefined = Meta off). */
  pixelId?: string;
  tier: AnalyticsTier;
};

const subscribe = () => () => {};

/**
 * 빌드 환경과 접속 호스트가 맞고 `?qa=1`이 아닐 때만 픽셀을 로드한다(analytics-env.ts).
 * 서버 렌더에서는 호스트를 알 수 없어 항상 꺼 둔다.
 * JS가 꺼진 방문자용 noscript 이미지는 테스트 환경을 가를 수 없어 넣지 않는다.
 */
export function MetaPixel({ pixelId, tier }: MetaPixelProps) {
  const pathname = usePathname();
  const enabled = useSyncExternalStore(
    subscribe,
    () => isAnalyticsHost(tier, window.location.hostname) && !isQaVisit(),
    () => false,
  );
  // 첫 PageView는 기본 코드가 보낸다. 이후 클라이언트 이동만 여기서 보낸다.
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (!enabled || typeof window.fbq !== "function") return;
    window.fbq("track", "PageView");
  }, [enabled, pathname]);

  if (!pixelId || !enabled) return null;

  return (
    <Script id="meta-pixel-init" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
