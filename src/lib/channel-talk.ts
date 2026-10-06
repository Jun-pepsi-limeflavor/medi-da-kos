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
import { briefProgressProfile, gaBootProfile } from "./channel-talk-intake";
import type { UserProfile } from "./types";

export { CHANNEL_TALK_GA_PROFILE_KEY } from "./channel-talk-intake";

let bootedMemberId: string | null = null;
let bootedAnonymous = false;
let lastBootError: string | null = null;
let lastBootUser: User | null = null;
let pendingBriefStep: { step: number; label: string; saved: boolean } | null = null;

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
  const { step, label, saved } = pendingBriefStep;
  pendingBriefStep = null;
  applyBriefStepSync(step, label, saved);
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

function applyBriefStepSync(step: number, stepLabel: string, saved: boolean): void {
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
  // 실제로 저장했을 때만 프로필을 쓴다. 불러오기만 한 경우(제출 직후 1단계로 초기화된 초안 포함)
  // 프로필을 쓰면 서버 주문 처리가 넣은 제출 완료 상태를 덮는다.
  if (saved) {
    updateUser({ profile: briefProgressProfile(step, stepLabel, Date.now()) });
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[ChannelTalk] brief step synced", { step, stepLabel, page });
  }
}

/**
 * Syncs CM Wizard step to Channel Talk for workflow/campaign branching.
 * Uses virtual page `dashboard/brief-step-N` (SPA URL stays /dashboard).
 * `saved`: 사용자가 단계를 저장·이동했을 때만 true. 불러오기는 페이지 추적만 한다.
 */
export function syncBriefStepToChannelTalk(
  step: number,
  stepLabel?: string,
  options: { saved?: boolean } = {},
): void {
  if (!isValidBriefStep(step)) return;

  const label = stepLabel ?? getBriefStepLabel(step);
  const saved = options.saved === true;

  if (!isChannelTalkBooted()) {
    // 아직 boot 전이면 마지막 요청을 보관한다. 보관 중인 저장 요청은 뒤의 불러오기 요청으로 바꾸지 않는다.
    if (saved || !pendingBriefStep?.saved) pendingBriefStep = { step, label, saved };
    return;
  }

  pendingBriefStep = null;
  applyBriefStepSync(step, label, saved);
}

/**
 * 위저드를 벗어날 때(주문·추적 화면 등) 가상 페이지만 정리한다.
 * Brief 프로필 값은 지우지 않는다 — 제출 완료 상태와 작성 진행은 그대로 남아야 한다.
 */
export function clearBriefStepFromChannelTalk(pathname: string): void {
  if (!isChannelTalkBooted()) {
    pendingBriefStep = null;
    return;
  }

  pendingBriefStep = null;
  resetPage();
  setPage(pathname || "/");
  track("PageView");
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
    flushPendingBriefStep();
    return;
  }

  if (bootedMemberId || bootedAnonymous) {
    shutdown();
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
