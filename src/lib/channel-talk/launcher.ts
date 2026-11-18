// Channel Talk 커스텀 런처 연결(Figma 'Cookie & Chat — Components (Final)' › Channel Talk Launcher 742:2189 주석).
// - SDK 기본 버튼은 숨기고(hideChannelButtonOnBoot, boot 옵션은 client.ts) 사이트 런처 클릭이 showMessenger·hideMessenger를 직접 호출한다
// - 메신저 열림 여부는 SDK의 onShowMessenger·onHideMessenger로 받아 런처의 열림(X) 표시와 aria-expanded에 쓴다
// - 미읽음 수는 SDK의 onBadgeChanged(unread, alert)로 받아 런처 오른쪽 위 빨간 점에 쓴다(1 이상 표시, 0 숨김, 숫자 없음).
//   SDK가 알려 준 값만 따르고 메신저를 열었다고 임의로 0으로 만들지 않는다. shutdown 때만 0으로 되돌린다
// - 플러그인 키가 없는 환경(개발·mock)에서는 SDK를 불러오지 않고 런처 클릭이 열림 표시만 바꾼다(ChannelTalkLauncher)
// - 연결 상태(channelReady, 2026-11-13): boot 성공 때 true, boot 실패·shutdown 때 false. 키가 있는 환경의 런처는 true일 때만 보인다
import { useSyncExternalStore } from "react";

export const LAUNCHER_ATTR = "data-channel-talk-launcher";

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

let channelReady = false;

/** True only while the SDK is booted (boot success); false before boot, after a failed boot and after shutdown. */
export function setChannelReady(ready: boolean): void {
  if (channelReady === ready) return;
  channelReady = ready;
  listeners.forEach((listener) => listener());
}

export function isChannelReady(): boolean {
  return channelReady;
}

export function useChannelReady(): boolean {
  return useSyncExternalStore(subscribe, () => channelReady, () => false);
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
