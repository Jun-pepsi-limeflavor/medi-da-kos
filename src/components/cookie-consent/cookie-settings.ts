// Cookie Settings 열기 이벤트의 단일 연결 지점.
// - Footer 'Cookie Settings' 등 어디서든 openCookieSettings()를 부르면 루트의 CookieConsent가 Cookie Settings 모달을 연다

/** Event the root CookieConsent listens to (Footer › Legal Links; the banner's Customize opens it directly). */
export const COOKIE_SETTINGS_EVENT = "medidakos:open-cookie-settings";

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
