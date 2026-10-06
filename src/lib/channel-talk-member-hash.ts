import { createHmac } from "crypto";

/**
 * Channel Talk memberHash 발급 판정. 로그인한 본인 uid의 해시만 준다.
 * 아무 memberId나 해시해 주면 남의 uid로 Channel 메신저에 boot해 그 회원의 상담을 볼 수 있다.
 */

export function hashMemberId(memberId: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, "hex");
  return createHmac("sha256", key).update(memberId).digest("hex");
}

export type VerifyIdToken = (idToken: string) => Promise<{ uid: string }>;

export type MemberHashResult = { status: number; body: Record<string, unknown> };

function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  return match ? match[1].trim() || null : null;
}

function isAuthTokenError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.startsWith("auth/");
}

/**
 * @param input.body 요청 JSON. 파싱에 실패했으면 undefined
 * @param input.verifyIdToken Firebase Admin verifyIdToken. auth/* 오류는 401, 그 밖(설정 누락 등)은 500
 */
export async function memberHashResponse(input: {
  authorization: string | null;
  body: unknown;
  secretKeyHex: string | undefined;
  verifyIdToken: VerifyIdToken;
}): Promise<MemberHashResult> {
  // 비밀값이 없으면 줄 해시가 없다. 설정 누락이 드러나도록 503으로 실패하고, 로그에는 누락 사실만 남긴다.
  // 클라이언트는 응답이 실패면 해시 없이 boot한다(사이트·제출에는 영향 없음).
  if (!input.secretKeyHex) {
    console.error("[channel-talk member-hash] CHANNEL_TALK_MEMBER_HASH_SECRET is not configured");
    return { status: 503, body: { error: "Member hash is not configured" } };
  }

  if (!input.body || typeof input.body !== "object") {
    return { status: 400, body: { error: "Invalid JSON body" } };
  }
  const memberId = (input.body as { memberId?: unknown }).memberId;
  if (!memberId || typeof memberId !== "string") {
    return { status: 400, body: { error: "memberId is required" } };
  }

  const idToken = bearerToken(input.authorization);
  if (!idToken) return { status: 401, body: { error: "Authentication required" } };

  let uid: string;
  try {
    ({ uid } = await input.verifyIdToken(idToken));
  } catch (error) {
    if (isAuthTokenError(error)) return { status: 401, body: { error: "Invalid ID token" } };
    console.error("[channel-talk member-hash] token verification unavailable:", error instanceof Error ? error.message : String(error));
    return { status: 500, body: { error: "Token verification unavailable" } };
  }
  if (uid !== memberId) return { status: 403, body: { error: "memberId does not match the signed-in user" } };

  return { status: 200, body: { memberHash: hashMemberId(memberId, input.secretKeyHex) } };
}
