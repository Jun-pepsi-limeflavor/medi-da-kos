/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  clampString,
  floorToMinute,
  isNewerByMinute,
  toE164Mobile,
  toExactInteger,
} = require("../channeltalk/field-types");

test("정확한 양의 정수만 숫자로 바꾼다", () => {
  assert.equal(toExactInteger("5000"), 5000);
  assert.equal(toExactInteger("5,000"), 5000);
  assert.equal(toExactInteger(" 100,000 "), 100000);
  assert.equal(toExactInteger(5000), 5000);
});

test("범위·근사치·단위·TBD·소수·0·잘못된 쉼표는 null", () => {
  for (const value of [
    "3,000~5,000", "5,000 – 10,000 units", "About 5,000", "TBD", "미정", "5k", "5000 units",
    "10,000+", "1.5", "0", 0, -5, 1.5, "50,00", "", null, undefined,
  ]) {
    assert.equal(toExactInteger(value), null, String(value));
  }
});

test("날짜시간은 분 단위로 내림한다", () => {
  // A6에서 보낸 값과 Channel이 정규화한 값
  assert.equal(floorToMinute(1790833161056), 1790833140000);
  assert.equal(floorToMinute("2026-10-01T05:39:21.056Z"), Date.parse("2026-10-01T05:39:00.000Z"));
  assert.equal(floorToMinute(new Date("2026-10-01T05:39:59.999Z")), Date.parse("2026-10-01T05:39:00.000Z"));
  assert.equal(floorToMinute({ toMillis: () => 1790833161056 }), 1790833140000);
  assert.equal(floorToMinute("not a date"), null);
  assert.equal(floorToMinute(null), null);
});

test("최신값 비교는 분 단위다", () => {
  assert.equal(isNewerByMinute(1790833161056, 1790833140000), false);
  assert.equal(isNewerByMinute(1790833200000, 1790833140000), true);
  assert.equal(isNewerByMinute(1790833161056, null), true);
  assert.equal(isNewerByMinute(null, 1790833140000), false);
});

test("문자열은 512자로 자르고 잘렸는지 알려준다", () => {
  assert.deepEqual(clampString("  abc  "), { value: "abc", truncated: false });
  const long = clampString("x".repeat(600));
  assert.equal(long.value.length, 512);
  assert.equal(long.truncated, true);
  assert.deepEqual(clampString(null), { value: "", truncated: false });
});

test("휴대폰은 + 국가번호가 붙은 명확한 형식만", () => {
  assert.equal(toE164Mobile("+821012345678"), "+821012345678");
  assert.equal(toE164Mobile("+1 (555) 010-0000"), "+15550100000");
  assert.equal(toE164Mobile("5550100000"), null);
  assert.equal(toE164Mobile("010-1234-5678"), null);
  assert.equal(toE164Mobile("+0 123 456 789"), null);
  assert.equal(toE164Mobile("+12"), null);
  assert.equal(toE164Mobile("+1 555 ext 12"), null);
  assert.equal(toE164Mobile(""), null);
});
