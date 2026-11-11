// Channel Talk 커스텀 런처 연결(Figma 'Cookie & Chat — Components (Final)' › Channel Talk Launcher 742:2189 주석).
// - SDK 기본 버튼은 숨기고(hideChannelButtonOnBoot) 사이트 런처를 커스텀 런처로 연결(customLauncherSelector) — boot 옵션은 client.ts에서 합친다
// - 메신저 열림 여부는 SDK의 onShowMessenger·onHideMessenger로 받아 런처의 열림(X) 표시와 aria-expanded에 쓴다
// - 미읽음 수는 SDK의 onBadgeChanged(unread, alert)로 받아 런처 오른쪽 위 빨간 점에 쓴다(1 이상 표시, 0 숨김, 숫자 없음).
//   SDK가 알려 준 값만 따르고 메신저를 열었다고 임의로 0으로 만들지 않는다. shutdown 때만 0으로 되돌린다
// - 플러그인 키가 없는 환경(개발·mock)에서는 SDK를 불러오지 않고 런처 클릭이 열림 표시만 바꾼다(ChannelTalkLauncher)
import { useSyncExternalStore } from "react";

export const LAUNCHER_ATTR = "data-channel-talk-launcher";
export const LAUNCHER_SELECTOR = `[${LAUNCHER_ATTR}]`;

let messengerOpen = false;
const listeners = new Set<() => void>();

export function setMessengerOpen(open: boolean): void {
  if (messengerOpen === open) return;
  messengerOpen = open;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMessengerOpen(): boolean {
  return useSyncExternalStore(subscribe, () => messengerOpen, () => false);
}

let unreadCount = 0;

/** Unread count from the SDK (onBadgeChanged) — or the dev-only mock in ChannelTalkLauncher. */
export function setChannelUnread(count: number): void {
  const next = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (unreadCount === next) return;
  unreadCount = next;
  listeners.forEach((listener) => listener());
}

export function useChannelUnread(): number {
  return useSyncExternalStore(subscribe, () => unreadCount, () => 0);
}
