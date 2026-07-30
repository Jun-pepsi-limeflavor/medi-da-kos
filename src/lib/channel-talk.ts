import {
  boot,
  loadScript,
  resetPage,
  setPage,
  shutdown,
  track,
  type BootOption,
  type Profile,
} from "@channel.io/channel-web-sdk-loader";
import type { UserProfile } from "./types";

export const CHANNEL_TALK_GA_PROFILE_KEY = "gaClientId";

let bootedMemberId: string | null = null;
let bootedAnonymous = false;

async function fetchMemberHash(memberId: string): Promise<string | undefined> {
  try {
    const res = await fetch("/api/channel-talk/member-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  if (!gaClientId) return {};
  return {
    [CHANNEL_TALK_GA_PROFILE_KEY]: gaClientId,
    analyticsId: gaClientId,
  };
}

function memberProfile(user: UserProfile, gaClientId: string | null): Profile {
  return {
    ...baseProfile(gaClientId),
    firebaseUid: user.uid,
    email: user.email || null,
    name: user.displayName || null,
    mobileNumber: user.phone || null,
    companyName: user.companyName || null,
    country: user.country || null,
  };
}

export async function bootChannelTalkAsMember(
  pluginKey: string,
  user: UserProfile,
  gaClientId: string | null,
): Promise<void> {
  if (bootedMemberId === user.uid) return;

  if (bootedMemberId || bootedAnonymous) {
    shutdown();
    bootedMemberId = null;
    bootedAnonymous = false;
  }

  loadScript();

  const memberHash = await fetchMemberHash(user.uid);

  const option: BootOption = {
    pluginKey,
    memberId: user.uid,
    language: "en",
    profile: memberProfile(user, gaClientId),
    ...(memberHash ? { memberHash } : {}),
  };

  boot(option, (error) => {
    if (error) {
      console.error("[ChannelTalk] member boot failed:", error);
      bootedMemberId = null;
      return;
    }
  });

  bootedMemberId = user.uid;
}

export function bootChannelTalkAsAnonymous(
  pluginKey: string,
  gaClientId: string | null,
): void {
  if (bootedAnonymous && !bootedMemberId) return;

  if (bootedMemberId || bootedAnonymous) {
    shutdown();
    bootedMemberId = null;
    bootedAnonymous = false;
  }

  loadScript();

  const option: BootOption = {
    pluginKey,
    language: "en",
    profile: baseProfile(gaClientId),
  };

  boot(option, (error) => {
    if (error) {
      console.error("[ChannelTalk] anonymous boot failed:", error);
      bootedAnonymous = false;
      return;
    }
  });

  bootedAnonymous = true;
}

export function shutdownChannelTalk(): void {
  if (!bootedMemberId && !bootedAnonymous) return;
  shutdown();
  bootedMemberId = null;
  bootedAnonymous = false;
}

export function syncChannelTalkPage(pathname: string): void {
  if (!bootedMemberId && !bootedAnonymous) return;

  const page = pathname || "/";
  setPage(page);
  track("PageView");
}

export function resetChannelTalkPage(): void {
  if (!bootedMemberId && !bootedAnonymous) return;
  resetPage();
  track("PageView");
}
