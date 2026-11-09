// Log In·Sign Up 입력값 검증.
// - 필수 항목(공백만 입력해도 오류), 이메일 형식(HTML 규칙), 비밀번호 8자 이상
// - 필드별 오류 문구 반환

/**
 * Log In · Sign Up field checks. Replaces the browser's native popups (the form uses noValidate) while keeping
 * the pre-renewal rules, which were native HTML constraints only:
 *   required on every * field · type="email" · password minLength 8 (both Log In and Sign Up) · no max length,
 *   no character-class rules.
 * Figma copy: "This field is required." The email/password messages are not in Figma (the old form showed the
 * browser's own text), so they are proposed copy pending confirmation.
 */
export type AuthMode = "login" | "register";
export type AuthField = "displayName" | "phone" | "country" | "email" | "password";
export type AuthValues = Record<AuthField, string>;

export const AUTH_MESSAGES = {
  required: "This field is required.",
  email: "Enter a valid email address.",
  password: "Password must be at least 8 characters.",
} as const;

export const PASSWORD_MIN_LENGTH = 8;

/**
 * The HTML spec's valid e-mail address rule — exactly what <input type="email"> enforced before the renewal
 * (a dot in the domain is not required, e.g. name@company passes, as it did in the browser).
 */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const REQUIRED: Record<AuthMode, AuthField[]> = {
  login: ["email", "password"],
  register: ["displayName", "phone", "country", "email", "password"],
};

export function authFieldsFor(mode: AuthMode): AuthField[] {
  return REQUIRED[mode];
}

/** Error message for one field, or undefined when it is valid. */
export function validateAuthField(field: AuthField, value: string): string | undefined {
  if (!value.trim()) return AUTH_MESSAGES.required;
  if (field === "email" && !EMAIL_PATTERN.test(value.trim())) return AUTH_MESSAGES.email;
  if (field === "password" && value.length < PASSWORD_MIN_LENGTH) return AUTH_MESSAGES.password;
  return undefined;
}

/** All field errors for a submit, in form order. Empty object means the form can be sent. */
export function validateAuthForm(mode: AuthMode, values: AuthValues): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};
  for (const field of REQUIRED[mode]) {
    const message = validateAuthField(field, values[field]);
    if (message) errors[field] = message;
  }
  return errors;
}
