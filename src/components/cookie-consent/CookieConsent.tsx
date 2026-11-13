"use client";

// 쿠키 동의 배너 + Cookie Settings 모달 관리(루트 레이아웃에 한 번). Figma 'Cookie Banner' 742:2176 · 'Cookie Settings — Final' 714:14.
// - 배너: 유효한 동의 기록이 없을 때(첫 방문·6개월 만료·정책 버전 변경) 모든 페이지 왼쪽 아래 고정(left·bottom 24px, 432px).
//   선택 전에는 페이지를 이동해도 계속 표시, 어느 페이지에서든 선택하면 모든 페이지에서 숨김. 페이지 사용을 막지 않는 비모달 영역
//   (Accept All / Reject Optional = 바로 저장, Customize = Cookie Settings 열기, Privacy Policy 링크)
// - Cookie Settings: 배너 Customize와 Footer 'Cookie Settings'(openCookieSettings 이벤트)에서 연다. 저장값을 불러와 표시
// - 화면에 그리는 것은 동의 상태가 확인된 뒤(서버 렌더·hydration 전에는 아무것도 없음) — 깜빡임·불일치 방지
// - 모바일(640px 미만, Figma 정의 없음): 좌우 16px 전체 폭, 버튼 줄바꿈. 오른쪽 아래 채팅 런처를 가리지 않게
//   배너는 화면 아래에서 88px 위에 둔다(런처: 모바일 아래 16px · 높이 44px)
// - GA4·Meta·Channel Talk 실행 제어는 아직 연결하지 않음(consent.ts 참고)
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { COOKIE_BANNER } from "@/components/cookie-consent/cookie-data";
import { COOKIE_SETTINGS_EVENT } from "@/components/cookie-consent/cookie-settings";
import { COOKIE_LINK_CLASS, CookieSettingsModal } from "@/components/cookie-consent/CookieSettingsModal";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config/routes";
import { ALL_ACCEPTED, ALL_REJECTED, saveConsent, useCookieConsent, type CookieChoices } from "@/lib/cookie-consent/consent";

export function CookieConsent() {
  const consent = useCookieConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, open);
  }, []);

  const save = useCallback((choices: CookieChoices) => {
    saveConsent(choices);
    setSettingsOpen(false);
  }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <>
      {consent === null ? (
        <section
          aria-labelledby={titleId}
          data-cookie-banner=""
          className="font-mdk fixed right-4 bottom-[88px] left-4 z-40 flex max-h-[calc(100dvh-120px)] flex-col gap-3 sm:max-h-[calc(100dvh-48px)] overflow-y-auto rounded-2xl border border-mdk-light-gray bg-mdk-white p-5 shadow-[0_16px_48px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] sm:right-auto sm:bottom-6 sm:left-6 sm:w-[432px]"
        >
          <h2 id={titleId} className="text-mdk-title text-mdk-charcoal">
            {COOKIE_BANNER.title}
          </h2>
          <div className="flex flex-col gap-2.5 text-mdk-body text-mdk-charcoal-muted">
            {COOKIE_BANNER.description.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <Link href={ROUTES.privacy} className={`${COOKIE_LINK_CLASS} self-start`}>
            Privacy Policy
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="s" onClick={() => save(ALL_REJECTED)}>
              Reject Optional
            </Button>
            <Button variant="secondary" size="s" onClick={() => setSettingsOpen(true)}>
              Customize
            </Button>
            <Button variant="primary" size="s" onClick={() => save(ALL_ACCEPTED)}>
              Accept All
            </Button>
          </div>
        </section>
      ) : null}
      <CookieSettingsModal open={settingsOpen} saved={consent ?? null} onClose={closeSettings} onSave={save} />
    </>
  );
}
