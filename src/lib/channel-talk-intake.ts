/**
 * 웹 → Channel Talk 연동에서 쓰는 순수 함수(SDK·Firebase를 부르지 않는다).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 1·2·10장.
 * - 회원 boot는 신원(memberId·memberHash)만 보낸다. 프로필 값은 서버 연동이 관리한다.
 * - 제출 문서의 channelUserId·uid는 Firestore rules와 같은 조건일 때만 넣는다.
 */

export const CHANNEL_TALK_GA_PROFILE_KEY = "gaClientId";
/** firestore.rules의 validLandingOptionalString('channelUserId', 64)와 같은 상한. */
export const CHANNEL_USER_ID_MAX_LENGTH = 64;
export const BRIEF_STATUS_IN_PROGRESS = "작성 중";

/** boot 때 함께 보내는 GA 식별자. 고객 프로필 값(이름·이메일 등)은 넣지 않는다. */
export function gaBootProfile(gaClientId: string | null): Record<string, string> {
  if (!gaClientId) return {};
  return {
    [CHANNEL_TALK_GA_PROFILE_KEY]: gaClientId,
    analyticsId: gaClientId,
  };
}

/** 제출 문서의 channelUserId. 1~64자 문자열일 때만 넣고, 아니면 넣지 않는다(서버가 server_lead로 처리). */
export function channelUserIdField(value: unknown): { channelUserId?: string } {
  if (typeof value !== "string") return {};
  if (!value || value.length > CHANNEL_USER_ID_MAX_LENGTH) return {};
  return { channelUserId: value };
}

/** Contact 제출 문서의 식별 필드. 로그인 회원의 본인 uid만 넣는다(rules가 uid == auth.uid를 요구). */
export function contactIdentityFields(input: {
  uid?: string | null;
  channelUserId?: string | null;
}): { uid?: string; channelUserId?: string } {
  const uid = typeof input.uid === "string" && input.uid ? { uid: input.uid } : {};
  return { ...uid, ...channelUserIdField(input.channelUserId) };
}

/** 서버 연동과 같은 분 단위 날짜시간(Channel이 분 단위로 정규화한다). */
export function floorToMinute(ms: number): number {
  return Math.floor(ms / 60000) * 60000;
}

/** Brief 단계를 저장했을 때 보내는 프로필. 제출 완료(`제출 완료`·`완료`)는 서버 주문 처리가 쓴다. */
export function briefProgressProfile(step: number, stepLabel: string, nowMs: number) {
  return {
    briefStep: String(step),
    briefStepLabel: stepLabel,
    briefStatus: BRIEF_STATUS_IN_PROGRESS,
    briefUpdatedAt: floorToMinute(nowMs),
  };
}
