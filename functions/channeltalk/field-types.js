/**
 * Channel Talk 프로필에 API로 쓰기 전의 타입 검증 (순수 함수).
 *
 * 0단계 검증에서 API가 Desk 필드 타입을 검사하지 않고, 이후 다른 PATCH 때 잘못된 값을
 * 변환한다는 것이 확인됐다(문자열 moq → 0, datetime → 분 단위). 그래서 보내기 전에 여기서 거른다.
 */

const MAX_STRING_LENGTH = 512;
const MINUTE_MS = 60 * 1000;

/** 정확한 양의 정수만 숫자로 돌려준다. 천 단위 쉼표는 허용, 범위·근사치·단위·TBD는 null. */
function toExactInteger(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^\d+$/.test(text) && !/^\d{1,3}(?:,\d{3})+$/.test(text)) return null;
  const number = Number(text.replace(/,/g, ""));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** Date, ISO 문자열, 밀리초, Firestore Timestamp를 밀리초로. 해석할 수 없으면 null. */
function toMillis(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  return null;
}

/** Channel이 datetime을 분 단위로 저장하므로 보내기 전에 내림한다. */
function floorToMinute(value) {
  const ms = toMillis(value);
  return ms === null ? null : Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

/** 분 단위로 비교해 후보가 더 최근이면 true. 현재 값이 없으면 true. */
function isNewerByMinute(candidate, current) {
  const next = floorToMinute(candidate);
  if (next === null) return false;
  const now = floorToMinute(current);
  return now === null || next > now;
}

function clampString(value, max = MAX_STRING_LENGTH) {
  if (typeof value !== "string") return { value: "", truncated: false };
  const text = value.trim();
  if (text.length <= max) return { value: text, truncated: false };
  return { value: text.slice(0, max), truncated: true };
}

/** `+` 국가번호가 붙은 명확한 형식만 E.164로. 국가번호가 없으면 추정하지 않고 null. */
function toE164Mobile(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("+")) return null;
  const digits = text.slice(1).replace(/[\s().-]/g, "");
  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  return `+${digits}`;
}

module.exports = {
  MAX_STRING_LENGTH,
  clampString,
  floorToMinute,
  isNewerByMinute,
  toE164Mobile,
  toExactInteger,
  toMillis,
};
