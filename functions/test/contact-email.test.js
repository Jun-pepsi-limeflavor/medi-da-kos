/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildContactAdminEmail, escapeHtml } = require("../contact-email");
const { buildNotificationMime } = require("../gmail-notify");

const SUBMITTED_AT = "2026. 11. 5. 오후 3:00:00";

// 수정 전 onContactCreated 양식 그대로(이스케이프 없음). 일반 입력에서는 결과가 같아야 한다.
function legacyHtml(contactId, contact, submittedAt) {
  const utmParts = [
    contact.utmSource && `source=${contact.utmSource}`,
    contact.utmMedium && `medium=${contact.utmMedium}`,
    contact.utmCampaign && `campaign=${contact.utmCampaign}`,
  ].filter(Boolean);
  return `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>새 Contact 문의가 접수되었습니다</h2>
          <p><strong>회사/브랜드:</strong> ${contact.companyName || "-"}</p>
          <p><strong>이메일:</strong> ${contact.email || "-"}</p>
          <p><strong>유입 경로:</strong> ${contact.referralSource || "-"}</p>
          <p><strong>비즈니스 유형:</strong> ${contact.businessType || "-"}</p>
          <p><strong>UTM:</strong> ${utmParts.length ? utmParts.join(", ") : "-"}</p>
          <p><strong>문의 내용:</strong></p>
          <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px">${contact.message || "-"}</pre>
          <p><strong>페이지 URL:</strong> ${contact.pageUrl || "-"}</p>
          <p><strong>접수 시각:</strong> ${submittedAt}</p>
          <p><strong>문서 ID:</strong> ${contactId}</p>
        </div>`;
}

const normalContact = {
  companyName: "Acme Beauty",
  email: "buyer@example.com",
  referralSource: "Social Media",
  businessType: "Existing Beauty Brand",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "renewal",
  message: "We'd like to develop a serum.\nMOQ 3000 units?",
  pageUrl: "https://www.medidakos.com/contact",
};

test("일반 입력은 기존 양식과 같은 제목·본문을 만든다", () => {
  const email = buildContactAdminEmail({ contactId: "abc123", contact: normalContact, submittedAt: SUBMITTED_AT });
  assert.equal(email.subject, "[문의] Acme Beauty");
  // 일반 입력 중 이스케이프 대상 문자는 문의 내용의 작은따옴표뿐이다.
  const expected = legacyHtml("abc123", normalContact, SUBMITTED_AT).replace("We'd", "We&#39;d");
  assert.equal(email.html, expected);
});

test("빈 선택 항목은 기존처럼 '-'로 표시한다", () => {
  const contact = { companyName: "Acme", email: "a@example.com", message: "Hi" };
  const email = buildContactAdminEmail({ contactId: "id1", contact, submittedAt: SUBMITTED_AT });
  assert.equal(email.html, legacyHtml("id1", contact, SUBMITTED_AT));
  assert.match(email.html, /유입 경로:<\/strong> -<\/p>/);
  assert.match(email.html, /UTM:<\/strong> -<\/p>/);
});

test("고객 입력값의 HTML은 모두 이스케이프되어 태그로 해석되지 않는다", () => {
  const evil = '<img src="https://evil.example/x.png"><a href=\'https://evil.example\'>Click</a> & <script>alert(1)</script>';
  const contact = {
    companyName: evil,
    email: evil,
    referralSource: evil,
    businessType: evil,
    utmSource: evil,
    utmMedium: evil,
    utmCampaign: evil,
    message: `</pre>${evil}`,
    pageUrl: `javascript:"><b>${evil}`,
  };
  const email = buildContactAdminEmail({ contactId: "<b>id</b>", contact, submittedAt: SUBMITTED_AT });
  for (const tag of ["<img", "<a ", "<script", "</pre></pre>", "<b>"]) {
    assert.ok(!email.html.includes(tag), `본문에 원본 태그가 남음: ${tag}`);
  }
  assert.ok(email.html.includes("&lt;img src=&quot;https://evil.example/x.png&quot;&gt;"));
  assert.ok(email.html.includes("&lt;a href=&#39;https://evil.example&#39;&gt;Click&lt;/a&gt; &amp; &lt;script&gt;"));
  assert.ok(email.html.includes("&lt;b&gt;id&lt;/b&gt;"));
  // 양식이 만든 태그는 그대로다.
  assert.equal((email.html.match(/<pre /g) || []).length, 1);
  assert.equal((email.html.match(/<\/pre>/g) || []).length, 1);
});

test("제목은 HTML이 아니므로 이스케이프하지 않는다", () => {
  const email = buildContactAdminEmail({
    contactId: "id1",
    contact: { companyName: "Tom & Jerry <Co>", email: "a@example.com", message: "Hi" },
    submittedAt: SUBMITTED_AT,
  });
  assert.equal(email.subject, "[문의] Tom & Jerry <Co>");
  assert.ok(email.html.includes("Tom &amp; Jerry &lt;Co&gt;"));
});

test("메일의 텍스트 파트에는 고객이 입력한 원래 문자가 보인다", () => {
  const contact = { companyName: "Tom & Jerry <Co>", email: "a@example.com", message: `Say "hi" & <b>bye</b>` };
  const email = buildContactAdminEmail({ contactId: "id1", contact, submittedAt: SUBMITTED_AT });
  const raw = buildNotificationMime({
    from: "support@medidakos.com",
    to: ["admin@example.com"],
    subject: email.subject,
    html: email.html,
    boundary: "b1",
  });
  const textPart = raw.split("--b1")[1];
  const base64 = textPart.split("\r\n\r\n")[1].replace(/\r\n/g, "");
  const text = Buffer.from(base64, "base64").toString("utf8");
  assert.ok(text.includes("Tom & Jerry <Co>"));
  assert.ok(text.includes(`Say "hi" & <b>bye</b>`));
});

test("escapeHtml은 & < > \" ' 다섯 문자를 바꾼다", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  assert.equal(escapeHtml(123), "123");
});

const contactV2 = {
  formVersion: 2,
  fullName: "Jane Doe",
  email: "buyer@example.com",
  companyName: "Acme Beauty",
  country: "United States",
  productCategory: "serum",
  quantityPerSku: 12000,
  targetMarkets: "Germany, France",
  launchDate: "Q1 2027",
  message: "Vegan <b>sunscreen</b>",
  promoInterest: false,
  utmSource: "google",
  pageUrl: "https://www.medidakos.com/contact",
};

test("리뉴얼 Contact(formVersion 2): 새 항목을 표시하고 기존 전용 항목은 값이 있을 때만", () => {
  const email = buildContactAdminEmail({ contactId: "v2id", contact: contactV2, submittedAt: SUBMITTED_AT });
  assert.equal(email.subject, "[문의] Acme Beauty");
  for (const part of [
    "이름:</strong> Jane Doe", "국가(고객 소재지):</strong> United States", "웹사이트·SNS:</strong> -",
    "제품 카테고리:</strong> serum", "SKU당 예상 수량:</strong> 12,000개", "판매 대상 시장:</strong> Germany, France",
    "희망 출시 시점:</strong> Q1 2027", "프로모션 관심:</strong> 아니오", "회원 여부:</strong> 비회원",
    "UTM:</strong> source=google", "Vegan &lt;b&gt;sunscreen&lt;/b&gt;", "문서 ID:</strong> v2id",
  ]) assert.ok(email.html.includes(part), part);
  assert.ok(!email.html.includes("유입 경로"));
  assert.ok(!email.html.includes("비즈니스 유형"));
});

test("리뉴얼 Contact: Message·프로모션이 없으면 '-'와 관심 줄 없음", () => {
  const { message, promoInterest, ...rest } = contactV2;
  void message; void promoInterest;
  const email = buildContactAdminEmail({ contactId: "v2b", contact: { ...rest, uid: "u1" }, submittedAt: SUBMITTED_AT });
  assert.match(email.html, /border-radius:6px">-<\/pre>/);
  assert.ok(!email.html.includes("프로모션 관심"));
  assert.ok(email.html.includes("회원 여부:</strong> 회원"));
});

test("기존 운영 Contact 문서는 formVersion이 없으면 예전 양식과 같다(회귀)", () => {
  const email = buildContactAdminEmail({ contactId: "abc123", contact: { ...normalContact, uid: "u1", channelUserId: "ch1" }, submittedAt: SUBMITTED_AT });
  assert.equal(email.html, legacyHtml("abc123", normalContact, SUBMITTED_AT).replace("We'd", "We&#39;d"));
});
