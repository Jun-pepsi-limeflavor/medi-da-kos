/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildSignupAdminEmail } = require("../signup-email");
const { buildNotificationMime } = require("../gmail-notify");

const SIGNED_UP_AT = "2026. 11. 5. 오후 3:00:00";

// 수정 전 onUserSignup 관리자 알림 양식 그대로(이스케이프 없음). 일반 입력에서는 결과가 같아야 한다.
function legacy({ userId, memberEmail, memberName, companyName, signedUpAt }) {
  return {
    subject: `신규 회원가입: ${memberEmail || userId}`,
    html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>새 회원이 가입했습니다</h2>
          <p><strong>이메일:</strong> ${memberEmail || "-"}</p>
          <p><strong>이름:</strong> ${memberName || "-"}</p>
          <p><strong>회사:</strong> ${companyName || "-"}</p>
          <p><strong>UID:</strong> ${userId}</p>
          <p><strong>가입 시각:</strong> ${signedUpAt}</p>
        </div>`,
  };
}

test("일반 입력은 기존 관리자 알림 제목·본문과 같다", () => {
  const input = {
    userId: "Uid123abc",
    memberEmail: "jane@example.com",
    memberName: "Jane Doe",
    companyName: "Acme Beauty",
    signedUpAt: SIGNED_UP_AT,
  };
  assert.deepEqual(buildSignupAdminEmail(input), legacy(input));
});

test("빈 이메일·이름·회사는 기존처럼 '-', 제목은 UID로 대체한다", () => {
  const input = { userId: "Uid123abc", memberEmail: undefined, memberName: "", companyName: undefined, signedUpAt: SIGNED_UP_AT };
  const email = buildSignupAdminEmail(input);
  assert.deepEqual(email, legacy(input));
  assert.equal(email.subject, "신규 회원가입: Uid123abc");
});

test("이메일·이름·회사·UID의 HTML은 이스케이프되어 태그로 해석되지 않는다", () => {
  const evil = '<a href="https://evil.example">Verify</a><img src=x> & \'q\'';
  const email = buildSignupAdminEmail({
    userId: "<b>uid</b>",
    memberEmail: `"><script>alert(1)</script>@example.com`,
    memberName: evil,
    companyName: `</div>${evil}`,
    signedUpAt: SIGNED_UP_AT,
  });
  for (const tag of ["<a ", "<img", "<script", "<b>", "</div></div>"]) {
    assert.ok(!email.html.includes(tag), `본문에 원본 태그가 남음: ${tag}`);
  }
  assert.ok(email.html.includes("&lt;a href=&quot;https://evil.example&quot;&gt;Verify&lt;/a&gt;&lt;img src=x&gt; &amp; &#39;q&#39;"));
  assert.ok(email.html.includes("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;@example.com"));
  assert.ok(email.html.includes("&lt;b&gt;uid&lt;/b&gt;"));
  // 양식이 만든 div는 하나뿐이다.
  assert.equal((email.html.match(/<div /g) || []).length, 1);
  assert.equal((email.html.match(/<\/div>/g) || []).length, 1);
});

test("제목은 HTML이 아니므로 이스케이프하지 않는다", () => {
  const email = buildSignupAdminEmail({ userId: "u1", memberEmail: "o'neil+a&b@example.com", memberName: "A", companyName: "B", signedUpAt: SIGNED_UP_AT });
  assert.equal(email.subject, "신규 회원가입: o'neil+a&b@example.com");
  assert.ok(email.html.includes("o&#39;neil+a&amp;b@example.com"));
});

test("메일의 텍스트 파트에는 회원이 입력한 원래 문자가 보인다", () => {
  const email = buildSignupAdminEmail({ userId: "u1", memberEmail: "a@example.com", memberName: "Tom & <Jerry>", companyName: `Say "hi"`, signedUpAt: SIGNED_UP_AT });
  const raw = buildNotificationMime({
    from: "support@medidakos.com",
    to: ["admin@example.com"],
    subject: email.subject,
    html: email.html,
    boundary: "b1",
  });
  const base64 = raw.split("--b1")[1].split("\r\n\r\n")[1].replace(/\r\n/g, "");
  const text = Buffer.from(base64, "base64").toString("utf8");
  assert.ok(text.includes("Tom & <Jerry>"));
  assert.ok(text.includes(`Say "hi"`));
});
