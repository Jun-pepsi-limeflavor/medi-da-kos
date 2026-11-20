// 환경별 GA4·Meta Pixel ID 선택(fail-closed). 운영 데이터와 개발 데이터가 섞이지 않게 하는 단일 판정 지점.
// - 빌드 환경(tier): Vercel 시스템 변수 VERCEL_ENV === "production"만 운영. 그 밖(Preview·staging·로컬·VERCEL_ENV 없음)은 개발
// - 운영은 NEXT_PUBLIC_GA_ID·NEXT_PUBLIC_META_PIXEL_ID, 개발은 NEXT_PUBLIC_GA_DEV_ID·NEXT_PUBLIC_META_PIXEL_DEV_ID만 쓴다.
//   다른 쪽 변수로 대체하지 않는다(개발 ID가 없으면 개발 환경 추적은 꺼짐)
// - 운영·개발 변수가 같은 값이거나 형식이 틀리면 그 서비스는 꺼짐. 반대쪽 변수는 이 비교에만 쓰므로 모든 환경에 둘 다 두는 것이 안전하다
// - 브라우저에서는 빌드 환경과 접속 호스트가 맞을 때만 로드한다(운영 빌드 ↔ 운영 도메인, 개발 빌드 ↔ 운영 도메인이 아닌 곳)
import { isProductionHost } from "@/lib/utils/env-flags";

export type AnalyticsTier = "production" | "development";

export type AnalyticsIds = {
  tier: AnalyticsTier;
  gaId?: string;
  metaPixelId?: string;
};

export type AnalyticsEnv = {
  VERCEL_ENV?: string;
  NEXT_PUBLIC_GA_ID?: string;
  NEXT_PUBLIC_GA_DEV_ID?: string;
  NEXT_PUBLIC_META_PIXEL_ID?: string;
  NEXT_PUBLIC_META_PIXEL_DEV_ID?: string;
};

/** Also keeps the IDs safe to embed in the inline init scripts. */
const GA_ID_FORMAT = /^G-[A-Z0-9]{6,}$/;
const META_PIXEL_ID_FORMAT = /^\d{10,20}$/;

function pick(own: string | undefined, other: string | undefined, format: RegExp): string | undefined {
  const id = own?.trim();
  if (!id || !format.test(id)) return undefined;
  // Same value in both roles: there is no telling which property it belongs to.
  if (other?.trim() === id) return undefined;
  return id;
}

/** Server/build side. Pass each variable explicitly so Next inlines the NEXT_PUBLIC_* values. */
export function resolveAnalyticsIds(env: AnalyticsEnv): AnalyticsIds {
  if (env.VERCEL_ENV === "production") {
    return {
      tier: "production",
      gaId: pick(env.NEXT_PUBLIC_GA_ID, env.NEXT_PUBLIC_GA_DEV_ID, GA_ID_FORMAT),
      metaPixelId: pick(env.NEXT_PUBLIC_META_PIXEL_ID, env.NEXT_PUBLIC_META_PIXEL_DEV_ID, META_PIXEL_ID_FORMAT),
    };
  }
  return {
    tier: "development",
    gaId: pick(env.NEXT_PUBLIC_GA_DEV_ID, env.NEXT_PUBLIC_GA_ID, GA_ID_FORMAT),
    metaPixelId: pick(env.NEXT_PUBLIC_META_PIXEL_DEV_ID, env.NEXT_PUBLIC_META_PIXEL_ID, META_PIXEL_ID_FORMAT),
  };
}

/** Browser side: the build's tier must match the visited host, otherwise nothing loads. */
export function isAnalyticsHost(tier: AnalyticsTier, hostname: string): boolean {
  return (tier === "production") === isProductionHost(hostname);
}

// The GA ID GoogleAnalytics actually loaded on this page (null = GA off: no ID, invalid ID or tier/host mismatch).
let activeGaId: string | null = null;

/** Set only by GoogleAnalytics. */
export function setActiveGaId(id: string | null) {
  activeGaId = id;
}

/** For code that needs the GA ID in the browser (GA client id lookup) — never read NEXT_PUBLIC_GA_ID directly. */
export function getActiveGaId(): string | null {
  return activeGaId;
}
