"use client";

// 동의 상태를 브라우저 저장소에 반영한다(루트 레이아웃에 한 번).
// - 허용되지 않은 카테고리의 쿠키·캐시는 페이지를 열 때마다 정리한다(P1 이전 방문에서 남은 _ga·_fbp 포함)
// - 같은 탭·다른 탭(storage 이벤트)에서 동의가 줄면: 실행 중인 GA4·Meta에 거부 신호를 보내고 저장소를 지운 뒤 새로고침한다.
//   이미 로드된 스크립트는 페이지에서 내릴 수 없어서, 새로고침으로 동의된 것만 다시 로드한다
// - 동의가 늘면(서버 기록 확인 후) GoogleAnalytics·MetaPixel이 그 자리에서 로드한다(새로고침 없음)
// - 페이지를 열 때 아직 서버에 기록되지 않은 동의 이벤트를 다시 보낸다(consent-sync.ts)
import { useEffect, useRef } from "react";
import { GOOGLE_CONSENT_DEFAULT } from "@/lib/analytics/google-consent";
import { clearCategoryStorage } from "@/lib/cookie-consent/cleanup";
import { useEffectiveConsent, type CookieChoices } from "@/lib/cookie-consent/consent";
import { flushConsentOutbox } from "@/lib/cookie-consent/consent-sync";

export function ConsentEnforcer() {
  const choices = useEffectiveConsent();
  const analytics = choices?.analytics;
  const marketing = choices?.marketing;
  const previous = useRef<CookieChoices | null>(null);

  useEffect(() => {
    void flushConsentOutbox();
  }, []);

  useEffect(() => {
    if (analytics === undefined || marketing === undefined) return; // before hydration
    const prev = previous.current;
    previous.current = { analytics, marketing };

    const lostAnalytics = prev?.analytics === true && !analytics;
    const lostMarketing = prev?.marketing === true && !marketing;
    if (lostAnalytics || lostMarketing) {
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", lostAnalytics ? GOOGLE_CONSENT_DEFAULT : { ...GOOGLE_CONSENT_DEFAULT, analytics_storage: "granted" });
      }
      if (lostMarketing && typeof window.fbq === "function") window.fbq("consent", "revoke");
    }
    if (!analytics) clearCategoryStorage("analytics");
    if (!marketing) clearCategoryStorage("marketing");
    if (lostAnalytics || lostMarketing) window.location.reload();
  }, [analytics, marketing]);

  return null;
}
