import {
  boot,
  loadScript,
  resetPage,
  setPage,
  shutdown,
  track,
  updateUser,
  type BootOption,
  type Callback,
  type Profile,
  type User,
} from "@channel.io/channel-web-sdk-loader";
import { briefStepPage, getBriefStepLabel, isCMBriefStep } from "./brief-steps";
import { trackBriefStep } from "./analytics";
import type { UserProfile } from "./types";

export const CHANNEL_TALK_GA_PROFILE_KEY = "gaClientId";

let bootedMemberId: string | null = null;
let bootedAnonymous = false;
let lastBootError: string | null = null;
let lastBootUser: User | null = null;
let pendingBriefStep: { step: number; stepLabel: string } | null = null;
let lastSyncedBriefStep: {
  step: number;
  stepLabel: string;
  page: string;
  source: "dwell" | "pending";
  syncedAt: number;
} | null = null;

const SYNC_DEDUPE_MS = 5_000;

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

function runBoot(option: BootOption): Promise<User> {
  loadScript();

  return new Promise((resolve, reject) => {
    const callback: Callback = (error, user) => {
      if (error || !user) {
        lastBootError = error?.message ?? "Channel Talk boot failed";
        lastBootUser = null;
        reject(error ?? new Error(lastBootError));
        return;
      }

      lastBootError = null;
      lastBootUser = user;
      resolve(user);
    };

    boot(option, callback);
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

function flushPendingBriefStep(): void {
  if (!pendingBriefStep || !isChannelTalkBooted()) return;
  const { step, stepLabel } = pendingBriefStep;
  pendingBriefStep = null;
  syncBriefStepToChannelTalk(step, stepLabel, { source: "pending" });
}

export function syncBriefStepToChannelTalk(
  step: number,
  stepLabel?: string,
  options?: { source?: "dwell" | "pending" },
): void {
  if (!isCMBriefStep(step)) return;

  const label = stepLabel ?? getBriefStepLabel(step);
  const source = options?.source ?? "dwell";

  if (!isChannelTalkBooted()) {
    pendingBriefStep = { step, stepLabel: label };
    return;
  }

  const now = Date.now();
  if (
    lastSyncedBriefStep?.step === step &&
    now - lastSyncedBriefStep.syncedAt < SYNC_DEDUPE_MS
  ) {
    return;
  }

  pendingBriefStep = null;
  const page = briefStepPage(step);

  setPage(page, {
    briefStep: String(step),
    briefStepLabel: label,
  });
  track("PageView");
  track("brief_step_changed", {
    briefStep: step,
    briefStepLabel: label,
    syncSource: source,
  });
  updateUser({
    profile: {
      briefStep: String(step),
      briefStepLabel: label,
    },
  });
  trackBriefStep(step, label);

  lastSyncedBriefStep = { step, stepLabel: label, page, source, syncedAt: now };

  if (process.env.NODE_ENV === "development") {
    console.info(`[ChannelTalk] brief step synced (${source})`, {
      step,
      label,
      page,
    });
  }
}

/** Clears wizard step profile when leaving the Product Brief page. */
export function clearBriefStepFromChannelTalk(fallbackPathname: string): void {
  if (!isChannelTalkBooted()) return;

  pendingBriefStep = null;
  lastSyncedBriefStep = null;
  const page = fallbackPathname || "/";

  setPage(page);
  track("PageView");
  updateUser({
    profile: {
      briefStep: null,
      briefStepLabel: null,
    },
  });

  if (process.env.NODE_ENV === "development") {
    console.info("[ChannelTalk] brief step cleared", { page });
  }
}

export async function bootChannelTalkAsMember(
  pluginKey: string,
  user: UserProfile,
  gaClientId: string | null,
): Promise<void> {
  if (bootedMemberId === user.uid && !lastBootError) return;

  if (bootedMemberId || bootedAnonymous) {
    shutdown();
    bootedMemberId = null;
    bootedAnonymous = false;
  }

  const memberHash = await fetchMemberHash(user.uid);

  const option: BootOption = {
    pluginKey,
    memberId: user.uid,
    language: "en",
    profile: memberProfile(user, gaClientId),
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
    flushPendingBriefStep();
  } catch (error) {
    bootedMemberId = null;
    logBootFailure("member", error);
  }
}

export async function bootChannelTalkAsAnonymous(
  pluginKey: string,
  gaClientId: string | null,
): Promise<void> {
  if (bootedAnonymous && !bootedMemberId && !lastBootError) return;

  if (bootedMemberId || bootedAnonymous) {
    shutdown();
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
    flushPendingBriefStep();
  } catch (error) {
    bootedAnonymous = false;
    logBootFailure("anonymous", error);
  }
}

export function shutdownChannelTalk(): void {
  if (!bootedMemberId && !bootedAnonymous) return;
  shutdown();
  bootedMemberId = null;
  bootedAnonymous = false;
  lastBootError = null;
  lastBootUser = null;
  pendingBriefStep = null;
  lastSyncedBriefStep = null;
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

export function getChannelTalkDebugState() {
  return {
    bootedMemberId,
    bootedAnonymous,
    lastBootError,
    lastBootUserId: lastBootUser?.id ?? null,
    channelIoLoaded: typeof window !== "undefined" && Boolean(window.ChannelIO),
    pendingBriefStep,
    lastSyncedBriefStep,
    isBooted: isChannelTalkBooted(),
  };
}
