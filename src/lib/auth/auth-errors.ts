// Firebase 인증 오류를 사용자용 영어 문구로 변환한다.
// - error.code 기준 매핑, 알 수 없는 오류는 기본 문구
// - 사용자가 Google 팝업을 닫은 경우 문구 없음
// - 로그에는 오류 코드만 기록

/**
 * Turns Firebase Authentication errors into user-facing English messages, keyed by `error.code`
 * (never by parsing `error.message`). Used for Log In, Sign Up and Google sign-in.
 * Codes are from the installed firebase/auth AuthErrorCodes (plus runtime-only ones noted below).
 */
export const GENERIC_AUTH_ERROR = "Something went wrong. Please try again.";

const INVALID_CREDENTIALS = "Invalid email or password.";
const WEAK_PASSWORD = "Password does not meet the security requirements.";
const NETWORK = "Network error. Please check your connection and try again.";

export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  // Email/password sign-in (email-enumeration protection returns invalid-credential for all three)
  "auth/invalid-credential": INVALID_CREDENTIALS,
  "auth/wrong-password": INVALID_CREDENTIALS,
  "auth/user-not-found": INVALID_CREDENTIALS,
  // Sign up
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": WEAK_PASSWORD,
  "auth/password-does-not-meet-requirements": WEAK_PASSWORD, // only when a Console password policy is enforced
  // Account state / rate limits / connectivity
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": NETWORK,
  "auth/timeout": NETWORK,
  // Google popup
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and try again.",
  "auth/account-exists-with-different-credential":
    "An account with this email already exists using a different sign-in method. Please use your original sign-in method.",
};

/** The user closed or replaced the Google popup themselves — not a failure, so no message is shown. */
const USER_CANCELLED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

export type AuthErrorResult = {
  /** Message for FormMessage, or null when nothing should be shown (user cancelled). */
  message: string | null;
  /** Firebase error code for debugging (no message text, emails or tokens). */
  code: string | null;
};

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const { code } = error as { code: unknown };
  return typeof code === "string" ? code : null;
}

export function describeAuthError(error: unknown): AuthErrorResult {
  const code = errorCode(error);
  if (code && USER_CANCELLED_CODES.has(code)) return { message: null, code };
  return { message: (code && AUTH_ERROR_MESSAGES[code]) || GENERIC_AUTH_ERROR, code };
}

/**
 * Logs only the error code (or error name) — never the message, which can carry an email address.
 * console.warn: these are expected user-facing failures (wrong password, duplicate email), not app crashes.
 */
export function logAuthError(context: string, error: unknown) {
  const code = errorCode(error);
  const name = error instanceof Error ? error.name : typeof error;
  console.warn(`[auth] ${context} failed: ${code ?? name}`);
}
