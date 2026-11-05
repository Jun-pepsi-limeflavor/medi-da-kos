/**
 * 메일 HTML 본문에 사용자가 입력한 값을 넣을 때 쓰는 이스케이프.
 * 제목 같은 헤더는 HTML이 아니므로 쓰지 않는다(줄바꿈은 gmail-notify가 막는다).
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 기존 메일 양식의 `값 || "-"` 규칙을 유지하면서 이스케이프한다. */
function escapeOrDash(value) {
  return value ? escapeHtml(value) : "-";
}

module.exports = { escapeHtml, escapeOrDash };
