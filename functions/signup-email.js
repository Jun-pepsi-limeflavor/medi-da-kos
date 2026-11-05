/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 신규 회원가입 관리자 알림 메일 양식 (onUserSignup).
 *
 * users 문서는 회원 본인이 브라우저에서 쓴다. 이메일·이름·회사명을 그대로 HTML에 넣으면
 * 관리자 수신함에 임의 HTML을 심을 수 있으므로 이스케이프한다. 제목은 HTML이 아니므로 그대로 둔다.
 */

const { escapeHtml, escapeOrDash } = require("./html-escape");

function buildSignupAdminEmail({ userId, memberEmail, memberName, companyName, signedUpAt }) {
  return {
    subject: `신규 회원가입: ${memberEmail || userId}`,
    html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>새 회원이 가입했습니다</h2>
          <p><strong>이메일:</strong> ${escapeOrDash(memberEmail)}</p>
          <p><strong>이름:</strong> ${escapeOrDash(memberName)}</p>
          <p><strong>회사:</strong> ${escapeOrDash(companyName)}</p>
          <p><strong>UID:</strong> ${escapeHtml(userId)}</p>
          <p><strong>가입 시각:</strong> ${escapeHtml(signedUpAt)}</p>
        </div>`,
  };
}

module.exports = { buildSignupAdminEmail };
