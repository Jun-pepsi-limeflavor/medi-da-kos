// 쿠키 동의 정책 상수·순수 함수(서버·브라우저 공용, React 없음). 브라우저 상태는 consent.ts, 서버 기록은 consent-log.ts.

/** Bump when the cookie purposes or policy change materially: every stored choice becomes invalid (asked again). */
export const POLICY_VERSION = 2;
/** A choice (consent or refusal) is valid for 6 months, then the visitor is asked again. */
export const CONSENT_RETENTION_MONTHS = 6;

/** Same calendar day N months later (clamped to the month's last day, e.g. Aug 31 → Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}
