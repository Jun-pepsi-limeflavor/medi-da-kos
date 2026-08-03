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
import { getBriefStepLabel, isValidBriefStep } from "./brief-steps";
import type { UserProfile } from "./types";

export const CHANNEL_TALK_GA_PROFILE_KEY = "gaClientId";

let bootedMemberId: string | null = null;
let bootedAnonymous = false;
let lastBootError: string | null = null;
let lastBootUser: User | null = null;
let pendingBriefStep: { step: number; label: string } | null = null;

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

function flushPendingBriefStep(): void {
  if (!pendingBriefStep || !isChannelTalkBooted()) return;
  const { step, label } = pendingBriefStep;
  pendingBriefStep = null;
  applyBriefStepSync(step, label);
}

export function isChannelTalkBooted(): boolean {
  return Boolean(bootedMemberId || bootedAnonymous) && !lastBootError;
}

function applyBriefStepSync(step: number, stepLabel: string): void {
  const page = `dashboard/brief-step-${step}`;

  setPage(page, {
    briefStep: String(step),
    briefStepLabel: stepLabel,
  });
  track("PageView");
  track("brief_step_changed", {
    briefStep: step,
    briefStepLabel: stepLabel,
  });
  updateUser({
    profile: {
      briefStep: String(step),
      briefStepLabel: stepLabel,
    },
  });

  if (process.env.NODE_ENV === "development") {
    console.info("[ChannelTalk] brief step synced", { step, stepLabel, page });
  }
}

/**
 * Syncs CM Wizard step to Channel Talk for workflow/campaign branching.
 * Uses virtual page `dashboard/brief-step-N` (SPA URL stays /dashboard).
 */
export function syncBriefStepToChannelTalk(step: number, stepLabel?: string): void {
  if (!isValidBriefStep(step)) return;

  const label = stepLabel ?? getBriefStepLabel(step);

  if (!isChannelTalkBooted()) {
    pendingBriefStep = { step, label };
    return;
  }

  pendingBriefStep = null;
  applyBriefStepSync(step, label);
}

/** Clears brief step profile when leaving the wizard (e.g. orders/tracking). */
export function clearBriefStepFromChannelTalk(pathname: string): void {
  if (!isChannelTalkBooted()) {
    pendingBriefStep = null;
    return;
  }

  pendingBriefStep = null;
  updateUser({
    profile: {
      briefStep: null,
      briefStepLabel: null,
    },
  });
  resetPage();
  setPage(pathname || "/");
  track("PageView");
}

export async function bootChannelTalkAsMember(
  pluginKey: string,
  user: UserProfile,
  gaClientId: string | null,
): Promise<void> {
  if (bootedMemberId === user.uid && !lastBootError) {
    flushPendingBriefStep();
    return;
  }

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
    flushPendingBriefStep();

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
    flushPendingBriefStep();
    return;
  }

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
    flushPendingBriefStep();

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
  bootedMemberId = null;
  bootedAnonymous = false;
  lastBootError = null;
  lastBootUser = null;
  pendingBriefStep = null;
}

/**
 * Route-level page sync. Skips /dashboard — brief step sync owns that URL.
 */
export function syncChannelTalkRoute(pathname: string): void {
  if (!isChannelTalkBooted()) return;

  if (pathname === "/dashboard") return;

  if (pathname.startsWith("/dashboard")) {
    clearBriefStepFromChannelTalk(pathname);
    return;
  }

  const page = pathname || "/";
  setPage(page);
  track("PageView");
}

export function resetChannelTalkPage(): void {
  if (!isChannelTalkBooted()) return;
  resetPage();
  track("PageView");
}

export function getChannelTalkDebugState() {
  return {
    bootedMemberId,
    bootedAnonymous,
    lastBootError,
    lastBootUserId: lastBootUser?.id ?? null,
    pendingBriefStep,
    channelIoLoaded: typeof window !== "undefined" && Boolean(window.ChannelIO),
  };
}
