export type DecodedLike = {
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
};

export type AdminIdentity = { email: string };

const ALLOWED_PROVIDERS = new Set(["google.com", "microsoft.com"]);

export class NotAdminError extends Error {}

function allowlist(): Set<string> {
  // 빈 목록을 "전원 허용"으로 읽으면 안 된다. 설정 누락은 사고다.
  // 콤마만 있거나 공백 조각만 있는 값은 split 이후에나 비어있다는 게 드러나므로,
  // trim 전 판정이 아니라 파싱 뒤 크기로 판정한다.
  const set = new Set(
    (process.env.BACKOFFICE_ADMIN_EMAILS ?? "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  if (set.size === 0) throw new Error("BACKOFFICE_ADMIN_EMAILS is not set");
  return set;
}

export function assertAllowedAdmin(claims: DecodedLike): AdminIdentity {
  const allowed = allowlist();
  const emailRaw = typeof claims.email === "string" ? claims.email.trim() : "";

  if (!emailRaw) throw new NotAdminError("no email on token");
  // 유니코드 대소문자 폴딩은 ASCII 밖 문자를 ASCII로 접을 수 있다(예: U+212A KELVIN
  // SIGN → "k"). 실제 관리자 이메일을 흉내내는 걸 막기 위해 폴딩 전에 걸러낸다.
  if (/[^\x00-\x7F]/.test(emailRaw)) throw new NotAdminError("email contains non-ascii characters");
  const email = emailRaw.toLowerCase();

  if (claims.email_verified !== true) throw new NotAdminError("email not verified");
  if (!ALLOWED_PROVIDERS.has(claims.firebase?.sign_in_provider ?? "")) {
    throw new NotAdminError("provider not allowed");
  }
  if (!allowed.has(email)) throw new NotAdminError("not on allowlist");

  return { email };
}
