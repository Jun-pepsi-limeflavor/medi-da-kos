export type DecodedLike = {
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
};

export type AdminIdentity = { email: string };

const ALLOWED_PROVIDERS = new Set(["google.com", "microsoft.com"]);

export class NotAdminError extends Error {}

function allowlist(): Set<string> {
  const raw = process.env.BACKOFFICE_ADMIN_EMAILS;
  if (!raw?.trim()) {
    // 빈 목록을 "전원 허용"으로 읽으면 안 된다. 설정 누락은 사고다.
    throw new Error("BACKOFFICE_ADMIN_EMAILS is not set");
  }
  return new Set(
    raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

export function assertAllowedAdmin(claims: DecodedLike): AdminIdentity {
  const allowed = allowlist();
  const email = claims.email?.trim().toLowerCase();

  if (!email) throw new NotAdminError("no email on token");
  if (claims.email_verified !== true) throw new NotAdminError("email not verified");
  if (!ALLOWED_PROVIDERS.has(claims.firebase?.sign_in_provider ?? "")) {
    throw new NotAdminError("provider not allowed");
  }
  if (!allowed.has(email)) throw new NotAdminError("not on allowlist");

  return { email };
}
