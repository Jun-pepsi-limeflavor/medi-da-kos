/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildMemberWelcomeEmail, getFirstName } = require("../welcome-email");
const { buildNotificationMime } = require("../gmail-notify");

test("이름이 없으면 there, 있으면 공백 기준 첫 단어를 쓴다(기존 규칙)", () => {
  assert.equal(getFirstName(""), "there");
  assert.equal(getFirstName("   "), "there");
  assert.equal(getFirstName(undefined), "there");
  assert.equal(getFirstName("  Jane   Doe "), "Jane");
});

test("일반 이름은 기존 제목·텍스트·본문 그대로다", () => {
  const email = buildMemberWelcomeEmail("Jane");
  assert.equal(email.subject, "Welcome to Medidakos, Jane 👋");
  assert.ok(email.text.startsWith("Hi Jane,\n\nWelcome aboard — we're glad you're here."));
  assert.ok(email.html.includes("<p>Hi Jane,</p>"));
  assert.ok(email.html.includes('<a href="https://www.medidakos.com">https://www.medidakos.com</a>'));
  assert.ok(!email.html.includes("&amp;") && !email.html.includes("&lt;"), "일반 이름에서는 본문이 바뀌지 않는다");
});

test("이름 속 HTML은 본문에서 이스케이프되고, 나머지 본문은 일반 이름일 때와 같다", () => {
  const evil = `<a/href="https://evil.example">Verify</a><img/src=x>&'`;
  const email = buildMemberWelcomeEmail(evil);
  const escaped = "&lt;a/href=&quot;https://evil.example&quot;&gt;Verify&lt;/a&gt;&lt;img/src=x&gt;&amp;&#39;";
  assert.ok(email.html.includes(`<p>Hi ${escaped},</p>`));
  assert.ok(!email.html.includes("<a/href") && !email.html.includes("<img"));
  assert.equal((email.html.match(/<a /g) || []).length, 1, "양식의 홈페이지 링크 하나만 남는다");
  // 이름 자리만 다르고 본문의 다른 부분은 그대로다.
  assert.equal(email.html.replace(escaped, "Jane"), buildMemberWelcomeEmail("Jane").html);
});

test("제목·텍스트 파트는 HTML이 아니므로 이름을 이스케이프하지 않는다", () => {
  const email = buildMemberWelcomeEmail("Tom&<Jerry>");
  assert.equal(email.subject, "Welcome to Medidakos, Tom&<Jerry> 👋");
  assert.ok(email.text.startsWith("Hi Tom&<Jerry>,"));
  assert.ok(email.html.includes("<p>Hi Tom&amp;&lt;Jerry&gt;,</p>"));
});

test("실제 메일(MIME)의 텍스트 파트는 기존 텍스트를 그대로 쓴다", () => {
  const email = buildMemberWelcomeEmail("Tom&<Jerry>");
  const raw = buildNotificationMime({
    from: "support@medidakos.com",
    to: ["member@example.com"],
    subject: email.subject,
    text: email.text,
    html: email.html,
    boundary: "b1",
  });
  const base64 = raw.split("--b1")[1].split("\r\n\r\n")[1].replace(/\r\n/g, "");
  assert.equal(Buffer.from(base64, "base64").toString("utf8"), email.text);
});
