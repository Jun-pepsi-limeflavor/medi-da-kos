/**
 * 이메일 정규화와 테스트·내부 계정 판정 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 5장.
 * 도메인 목록은 functions/.env에서 읽어 인자로 넘긴다 — 이 파일은 설정을 직접 읽지 않는다.
 */

const TEST_LOCAL_PART = /^[a-z0-9._-]+\+chtest(?:-[a-z0-9._-]+)?$/;

function normalizeEmail(raw) {
  if (typeof raw !== "string") return "";
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "";
  return email;
}

/** channelTalkIdentities 문서 id. 이메일에 '/'가 들어가도 경로가 깨지지 않게 인코딩한다. */
function emailKey(raw) {
  const email = normalizeEmail(raw);
  return email ? encodeURIComponent(email) : "";
}

function splitEmail(raw) {
  const email = normalizeEmail(raw);
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return { local: email.slice(0, at), domain: email.slice(at + 1) };
}

function normalizeDomains(domains) {
  return (Array.isArray(domains) ? domains : [])
    .map((domain) => (typeof domain === "string" ? domain.trim().toLowerCase() : ""))
    .filter(Boolean);
}

/** 도메인이 정확히 일치할 때만 내부 계정이다. 하위 도메인은 제외. */
function isInternalEmail(raw, internalDomains) {
  const parts = splitEmail(raw);
  if (!parts) return false;
  return normalizeDomains(internalDomains).includes(parts.domain);
}

/** `{기준 이름}+chtest` 또는 `{기준 이름}+chtest-{문자}`이고 테스트 허용 도메인일 때만 허용. */
function isAllowedTestEmail(raw, testDomain) {
  const parts = splitEmail(raw);
  if (!parts) return false;
  const [domain] = normalizeDomains([testDomain]);
  if (!domain || parts.domain !== domain) return false;
  return TEST_LOCAL_PART.test(parts.local);
}

/**
 * 연동 여부와 첫 줄 표시를 정한다.
 * isTest와 내부 계정은 따로 판단하고, 내부 계정이라는 이유로 연동을 건너뛰지 않는다.
 */
function classifySubmission({ isTest, email }, { internalDomains, testDomain }) {
  const test = isAllowedTestEmail(email, testDomain);
  const internal = isInternalEmail(email, internalDomains);
  const flags = { test, internal };

  if (isTest === true && !test) {
    return { sync: false, skipReason: "is_test", label: null, flags };
  }
  if (test) return { sync: true, skipReason: null, label: "[TEST]", flags };
  if (internal) return { sync: true, skipReason: null, label: "[내부]", flags };
  return { sync: true, skipReason: null, label: null, flags };
}

module.exports = {
  classifySubmission,
  emailKey,
  isAllowedTestEmail,
  isInternalEmail,
  normalizeEmail,
};
