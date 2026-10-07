/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  classifySubmission,
  emailKey,
  isAllowedTestEmail,
  isInternalEmail,
  normalizeEmail,
} = require("../channeltalk/email");

const config = {
  internalDomains: ["techasset.co.kr", "medidakoslabs.com", "medidakos.com"],
  testDomain: "techasset.co.kr",
};

test("이메일은 소문자·앞뒤 공백 제거로 정규화하고 형식이 아니면 빈 문자열", () => {
  assert.equal(normalizeEmail("  Jane.Doe@Example.COM "), "jane.doe@example.com");
  assert.equal(normalizeEmail("not-an-email"), "");
  assert.equal(normalizeEmail("@example.com"), "");
  assert.equal(normalizeEmail("jane@"), "");
  assert.equal(normalizeEmail(null), "");
});

test("매핑 문서 id는 정규화한 이메일을 URL 인코딩한다", () => {
  assert.equal(emailKey("Jane@Example.com"), "jane%40example.com");
  assert.equal(emailKey("a/b@example.com"), "a%2Fb%40example.com");
  assert.equal(emailKey("bad"), "");
});

test("허용 테스트 이메일: 설계 문서 5장 예시", () => {
  const cases = [
    ["kimbm+chtest@techasset.co.kr", true],
    ["kimbm+chtest-20261001@techasset.co.kr", true],
    ["KIMBM+CHTEST@TECHASSET.CO.KR", true],
    ["someone+chtest@example.com", false],
    ["kimbm+chtest@medidakos.com", false],
    ["kimbm+test@techasset.co.kr", false],
    ["kimbm+chtest+x@techasset.co.kr", false],
    ["kimbm@techasset.co.kr", false],
  ];
  for (const [email, expected] of cases) {
    assert.equal(isAllowedTestEmail(email, config.testDomain), expected, email);
  }
});

test("허용 테스트 이메일: 하위 도메인, 빈 뒤 문자, 기준 이름 없음은 거부", () => {
  assert.equal(isAllowedTestEmail("kimbm+chtest@mail.techasset.co.kr", config.testDomain), false);
  assert.equal(isAllowedTestEmail("kimbm+chtest-@techasset.co.kr", config.testDomain), false);
  assert.equal(isAllowedTestEmail("+chtest@techasset.co.kr", config.testDomain), false);
  assert.equal(isAllowedTestEmail("kimbm+chtest@techasset.co.kr", ""), false);
});

test("내부 계정: 회사 도메인 3개가 정확히 같을 때만", () => {
  assert.equal(isInternalEmail("kimbm@techasset.co.kr", config.internalDomains), true);
  assert.equal(isInternalEmail("staff@MEDIDAKOSLABS.com", config.internalDomains), true);
  assert.equal(isInternalEmail("support@medidakos.com", config.internalDomains), true);
  assert.equal(isInternalEmail("kimbm@mail.techasset.co.kr", config.internalDomains), false);
  assert.equal(isInternalEmail("someone@example.com", config.internalDomains), false);
  assert.equal(isInternalEmail("someone@notmedidakos.com", config.internalDomains), false);
});

test("판정 표: isTest 일반 이메일은 연동 제외", () => {
  const result = classifySubmission({ isTest: true, email: "buyer@example.com" }, config);
  assert.deepEqual(result, { sync: false, skipReason: "is_test", label: null, flags: { test: false, internal: false } });
});

test("판정 표: isTest 내부 계정도 허용 테스트 이메일이 아니면 연동 제외", () => {
  const result = classifySubmission({ isTest: true, email: "kimbm@techasset.co.kr" }, config);
  assert.equal(result.sync, false);
  assert.equal(result.skipReason, "is_test");
  assert.equal(result.flags.internal, true);
});

test("판정 표: 허용 테스트 이메일은 isTest와 무관하게 연동하고 [TEST]만 표시", () => {
  for (const isTest of [true, false]) {
    const result = classifySubmission({ isTest, email: "kimbm+chtest-20261001@techasset.co.kr" }, config);
    assert.deepEqual(result, { sync: true, skipReason: null, label: "[TEST]", flags: { test: true, internal: true } });
  }
});

test("판정 표: 운영 제출 내부 계정은 [내부], 일반 고객은 표시 없음", () => {
  assert.equal(classifySubmission({ isTest: false, email: "kimbm@techasset.co.kr" }, config).label, "[내부]");
  const buyer = classifySubmission({ isTest: false, email: "buyer@example.com" }, config);
  assert.deepEqual(buyer, { sync: true, skipReason: null, label: null, flags: { test: false, internal: false } });
});

test("판정 표: isTest가 없으면(undefined) 운영 제출로 본다", () => {
  assert.equal(classifySubmission({ email: "buyer@example.com" }, config).sync, true);
});
