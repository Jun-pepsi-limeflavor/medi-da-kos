// Cookie Settings 열기 이벤트의 단일 연결 지점.
// - 지금은 이벤트만 보내며, 이를 받아 여는 모달은 아직 없다

/**
 * Single connection point for "Cookie Settings" triggers (Footer › Legal Links; later the Cookie Banner "Customize").
 * The Cookie Settings modal is not built yet: nothing listens to this event, so clicking currently does nothing.
 * When the consent feature lands, its provider should listen for COOKIE_SETTINGS_EVENT and open the modal.
 */
export const COOKIE_SETTINGS_EVENT = "medidakos:open-cookie-settings";

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
