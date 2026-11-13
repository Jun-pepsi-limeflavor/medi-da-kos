/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Contact 문의 관리자 알림 메일 양식 (onContactCreated).
 *
 * contact 문서는 비로그인 공개 폼이 만든다. 입력값을 그대로 HTML에 넣으면 제출자가
 * 관리자 수신함에 임의 HTML(링크·이미지·가짜 안내문)을 심을 수 있으므로 모두 이스케이프한다.
 * 제목은 HTML이 아니므로 이스케이프하지 않는다(줄바꿈은 gmail-notify가 막는다).
 * 리뉴얼 Contact(formVersion 2, 2026-11)는 새 항목을 보여 주고, 기존 문서는 예전 양식 그대로 만든다.
 */

const { escapeHtml, escapeOrDash: field } = require("./html-escape");

function quantityText(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("en-US")}개` : field(value);
}

function buildContactAdminEmailV2({ contactId, contact, submittedAt, utm }) {
  const legacyRows = [
    contact.referralSource && `<p><strong>유입 경로:</strong> ${field(contact.referralSource)}</p>`,
    contact.businessType && `<p><strong>비즈니스 유형:</strong> ${field(contact.businessType)}</p>`,
  ].filter(Boolean).map((row) => `\n          ${row}`).join("");
  const promoRow = typeof contact.promoInterest === "boolean"
    ? `\n          <p><strong>프로모션 관심:</strong> ${contact.promoInterest ? "예" : "아니오"}</p>`
    : "";
  return {
    subject: `[문의] ${contact.companyName || contact.email || contactId}`,
    html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>새 Contact 문의가 접수되었습니다</h2>
          <p><strong>이름:</strong> ${field(contact.fullName)}</p>
          <p><strong>회사/브랜드:</strong> ${field(contact.companyName)}</p>
          <p><strong>이메일:</strong> ${field(contact.email)}</p>
          <p><strong>국가(고객 소재지):</strong> ${field(contact.country)}</p>
          <p><strong>웹사이트·SNS:</strong> ${field(contact.website)}</p>
          <p><strong>제품 카테고리:</strong> ${field(contact.productCategory)}</p>
          <p><strong>SKU당 예상 수량:</strong> ${quantityText(contact.quantityPerSku)}</p>
          <p><strong>판매 대상 시장:</strong> ${field(contact.targetMarkets)}</p>
          <p><strong>희망 출시 시점:</strong> ${field(contact.launchDate)}</p>${promoRow}${legacyRows}
          <p><strong>회원 여부:</strong> ${contact.uid ? "회원" : "비회원"}</p>
          <p><strong>UTM:</strong> ${utm}</p>
          <p><strong>문의 내용:</strong></p>
          <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px">${field(contact.message)}</pre>
          <p><strong>페이지 URL:</strong> ${field(contact.pageUrl)}</p>
          <p><strong>접수 시각:</strong> ${escapeHtml(submittedAt)}</p>
          <p><strong>문서 ID:</strong> ${escapeHtml(contactId)}</p>
        </div>`,
  };
}

function buildContactAdminEmail({ contactId, contact, submittedAt }) {
  const utmParts = [
    contact.utmSource && `source=${contact.utmSource}`,
    contact.utmMedium && `medium=${contact.utmMedium}`,
    contact.utmCampaign && `campaign=${contact.utmCampaign}`,
  ].filter(Boolean);

  if (contact.formVersion === 2) {
    const utm = utmParts.length ? escapeHtml(utmParts.join(", ")) : "-";
    return buildContactAdminEmailV2({ contactId, contact, submittedAt, utm });
  }

  return {
    subject: `[문의] ${contact.companyName || contact.email || contactId}`,
    html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>새 Contact 문의가 접수되었습니다</h2>
          <p><strong>회사/브랜드:</strong> ${field(contact.companyName)}</p>
          <p><strong>이메일:</strong> ${field(contact.email)}</p>
          <p><strong>유입 경로:</strong> ${field(contact.referralSource)}</p>
          <p><strong>비즈니스 유형:</strong> ${field(contact.businessType)}</p>
          <p><strong>UTM:</strong> ${utmParts.length ? escapeHtml(utmParts.join(", ")) : "-"}</p>
          <p><strong>문의 내용:</strong></p>
          <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px">${field(contact.message)}</pre>
          <p><strong>페이지 URL:</strong> ${field(contact.pageUrl)}</p>
          <p><strong>접수 시각:</strong> ${escapeHtml(submittedAt)}</p>
          <p><strong>문서 ID:</strong> ${escapeHtml(contactId)}</p>
        </div>`,
  };
}

module.exports = { buildContactAdminEmail, escapeHtml };
