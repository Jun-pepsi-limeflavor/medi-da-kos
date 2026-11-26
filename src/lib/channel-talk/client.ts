// Channel Talk SDK boot·종료·페이지 동기화. boot 때 SDK 기본 버튼을 숨기고(사이트 런처 ChannelTalkLauncher가 직접 showMessenger·hideMessenger 호출),
// 메신저 열림·닫힘과 미읽음 수(onBadgeChanged) 콜백을 런처 표시 상태에 넘긴다(lib/channel-talk/launcher).
// 콜백은 boot 성공 때 등록하고, 다시 boot하기 전 shutdown이 지우므로 중복 등록되지 않는다.
// 쿠키 동의(2026-11-23): SDK 실행·상담·회원 식별은 동의와 무관하게 그대로. 추적 기능(기본 PageView·UTM/referrer 수집,
// 라우트 이동 PageView)만 Marketing 동의가 있을 때 켠다. hidePopup은 상담 메시지 알림 팝업도 숨기므로 쓰지 않는다.
// 로그아웃(2026-11-24): 회원 → 비회원으로 바뀔 때만 shutdown 뒤 ch-session-* 쿠키를 지우고 boot한다. 이 쿠키(30분)가 남으면
// 비회원 boot가 직전 회원 세션을 이어받아 그 상담이 보인다(로컬 실측 E0·E1b). ch-veil-id·localStorage는 지우지 않는다.
// SDK shutdown이 메모리 세션 토큰도 비우므로(core의 AuthStorageService.init) 새로고침 없이 처리한다.
import {
  boot,
  loadScript,
  onBadgeChanged,
  onHideMessenger,
  onShowMessenger,
  resetPage,
  setPage,
  shutdown,
  track,
  type BootOption,
  type Callback,
  type Profile,
  type User,
} from "@channel.io/channel-web-sdk-loader";
import { gaBootProfile } from "@/lib/channel-talk/intake";
import { cookieDomainsFor } from "@/lib/cookie-consent/cleanup";
import { hasCookieConsent } from "@/lib/cookie-consent/consent";
import { setChannelReady, setChannelUnread, setMessengerOpen } from "@/lib/channel-talk/launcher";
import type { UserProfile } from "@/lib/types";

export { CHANNEL_TALK_GA_PROFILE_KEY } from "@/lib/channel-talk/intake";

const CHANNEL_SESSION_COOKIE_PREFIX = "ch-session-";

/**
 * Channel 세션 쿠키(ch-session-{channelId})를 지운다. 설정 도메인을 알 수 없어 호스트 전용·현재 호스트·상위 도메인으로 모두 만료시킨다.
 * 회원 로그아웃 직후에만 부른다. 지운 쿠키 이름을 돌려준다(값은 다루지 않는다).
 */
export function clearChannelSessionCookies(): string[] {
  if (typeof document === "undefined") return [];
  const names = [
    ...new Set(
      document.cookie
        .split(";")
        .map((part) => part.trim().split("=")[0])
        .filter((name) => name.startsWith(CHANNEL_SESSION_COOKIE_PREFIX)),
    ),
  ];
  const hostname = typeof location === "undefined" ? "" : location.hostname;
  for (const name of names) {
    for (const domain of cookieDomainsFor(hostname)) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
  return names;
}

let bootedMemberId: string | null = null;
let bootedAnonymous = false;
let lastBootError: string | null = null;
let lastBootUser: User | null = null;

/** 서버가 ID 토큰의 uid와 memberId가 같을 때만 해시를 준다. 토큰이 없으면 요청하지 않는다. */
async function fetchMemberHash(memberId: string, idToken: string | null): Promise<string | undefined> {
  if (!idToken) return undefined;
  try {
    const res = await fetch("/api/channel-talk/member-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ memberId }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { memberHash?: string };
    return data.memberHash;
  } catch {
    return undefined;
  }
}

function baseProfile(gaClientId: string | null): Profile {
  return gaBootProfile(gaClientId);
}

/** Channel Talk tracking boot options: on only with Marketing consent (support chat works either way). */
export function channelTrackingOptions(marketing: boolean): Pick<BootOption, "trackDefaultEvent" | "trackUtmSource"> {
  return { trackDefaultEvent: marketing, trackUtmSource: marketing };
}

function runBoot(option: BootOption): Promise<User> {
  loadScript();

  return new Promise((resolve, reject) => {
    const callback: Callback = (error, user) => {
      if (error || !user) {
        lastBootError = error?.message ?? "Channel Talk boot failed";
        setChannelReady(false);
        lastBootUser = null;
        reject(error ?? new Error(lastBootError));
        return;
      }

      lastBootError = null;
      lastBootUser = user;
      setChannelReady(true); // the site launcher shows only from here
      // Site launcher (ChannelTalkLauncher) shows the messenger state; shutdown clears these callbacks.
      onShowMessenger(() => setMessengerOpen(true));
      onHideMessenger(() => setMessengerOpen(false));
      // Red dot on the launcher: unread = all unread, alert = important ones (counted in unread; max() just in case).
      onBadgeChanged((unread, alert) => setChannelUnread(Math.max(unread, alert)));
      resolve(user);
    };

    // Figma launcher: hide the SDK's default button; the site launcher opens/closes the messenger itself.
    // No customLauncherSelector (2026-11-13): the SDK's own click binding did not open the messenger in real Chrome,
    // and keeping it alongside our showMessenger call would toggle twice.
    boot({ ...option, ...channelTrackingOptions(hasCookieConsent("marketing")), hideChannelButtonOnBoot: true }, callback);
  });
}

function logBootFailure(mode: "member" | "anonymous", error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ChannelTalk] ${mode} boot failed:`, message);

  if (mode === "member") {
    console.error(
      "[ChannelTalk] Logged-in boot often fails when member hash is enabled in Desk but the secret/hash do not match. Verify in Desk → Security → User Data Encryption → hash check, or test while logged out.",
    );
  }
}

export function isChannelTalkBooted(): boolean {
  return Boolean(bootedMemberId || bootedAnonymous) && !lastBootError;
}

/**
 * 지금 브라우저에서 boot된 Channel 고객 id. boot가 끝나지 않았거나 실패했으면 null.
 * 제출을 기다리게 하지 않는다 — 없으면 제출 문서에 넣지 않고 서버가 server_lead로 처리한다.
 */
export function getChannelTalkUserId(): string | null {
  if (!isChannelTalkBooted()) return null;
  const id = lastBootUser?.id;
  return typeof id === "string" && id ? id : null;
}

/**
 * 회원 boot. 신원(memberId·memberHash)과 GA 식별자만 보낸다. 이름·이메일·전화·회사·국가·firebaseUid는
 * 보내지 않는다 — 기존 Channel 프로필을 덮지 않고, 프로필은 서버 연동이 관리한다(설계 10장).
 * idToken: 현재 로그인 사용자의 Firebase ID 토큰. 없으면 memberHash 없이 boot한다.
 */
export async function bootChannelTalkAsMember(
  pluginKey: string,
  user: UserProfile,
  gaClientId: string | null,
  idToken: string | null = null,
): Promise<void> {
  if (bootedMemberId === user.uid && !lastBootError) {
    return;
  }

  if (bootedMemberId || bootedAnonymous) {
    shutdown();
    setMessengerOpen(false); // shutdown drops the hide callback; a messenger left open would keep the launcher hidden
    setChannelUnread(0); // the next boot reports its own count
    setChannelReady(false);
    bootedMemberId = null;
    bootedAnonymous = false;
  }

  const memberHash = await fetchMemberHash(user.uid, idToken);

  const option: BootOption = {
    pluginKey,
    memberId: user.uid,
    language: "en",
    profile: baseProfile(gaClientId),
    ...(memberHash ? { memberHash } : {}),
  };

  try {
    await runBoot(option);
    bootedMemberId = user.uid;
    bootedAnonymous = false;

    if (process.env.NODE_ENV === "development") {
      console.info("[ChannelTalk] member boot ok", {
        memberId: user.uid,
        memberHashAttached: Boolean(memberHash),
      });
    }
  } catch (error) {
    bootedMemberId = null;
    logBootFailure("member", error);
  }
}

export async function bootChannelTalkAsAnonymous(
  pluginKey: string,
  gaClientId: string | null,
): Promise<void> {
  if (bootedAnonymous && !bootedMemberId && !lastBootError) {
    return;
  }

  if (bootedMemberId || bootedAnonymous) {
    const wasMember = Boolean(bootedMemberId);
    shutdown();
    // Member → anonymous (logout, here or in another tab): drop the member's session so this boot starts a new visitor.
    if (wasMember) clearChannelSessionCookies();
    setMessengerOpen(false); // shutdown drops the hide callback; a messenger left open would keep the launcher hidden
    setChannelUnread(0); // the next boot reports its own count
    setChannelReady(false);
    bootedMemberId = null;
    bootedAnonymous = false;
  }

  const option: BootOption = {
    pluginKey,
    language: "en",
    profile: baseProfile(gaClientId),
  };

  try {
    await runBoot(option);
    bootedAnonymous = true;
    bootedMemberId = null;

    if (process.env.NODE_ENV === "development") {
      console.info("[ChannelTalk] anonymous boot ok", {
        gaClientId: gaClientId ?? null,
      });
    }
  } catch (error) {
    bootedAnonymous = false;
    logBootFailure("anonymous", error);
  }
}

export function shutdownChannelTalk(): void {
  if (!bootedMemberId && !bootedAnonymous) return;
  shutdown();
  setMessengerOpen(false);
  setChannelUnread(0);
  setChannelReady(false);
  bootedMemberId = null;
  bootedAnonymous = false;
  lastBootError = null;
  lastBootUser = null;
}

/** Route-level page sync. */
export function syncChannelTalkRoute(pathname: string): void {
  if (!isChannelTalkBooted()) return;

  const page = pathname || "/";
  setPage(page);
  if (hasCookieConsent("marketing")) track("PageView");
}

export function resetChannelTalkPage(): void {
  if (!isChannelTalkBooted()) return;
  resetPage();
  if (hasCookieConsent("marketing")) track("PageView");
}

export function getChannelTalkDebugState() {
  return {
    bootedMemberId,
    bootedAnonymous,
    lastBootError,
    lastBootUserId: lastBootUser?.id ?? null,
    channelIoLoaded: typeof window !== "undefined" && Boolean(window.ChannelIO),
  };
}
