function escapeHtml(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function asList(items) {
  if (!Array.isArray(items) || !items.length) return "-";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item.name)} (${escapeHtml(item.category)})</li>`).join("")}</ul>`;
}

function dashboardSummary(brief) {
  if (!brief || typeof brief !== "object") return "-";
  const step6 = brief.step6 || {};
  const quantity = brief.step4?.orderQuantity;
  return `Dashboard brief — Step ${escapeHtml(brief.currentStep || 6)}: ${escapeHtml(step6.productName || brief.step1?.selection || "Brief attached in Firestore")}${quantity ? ` · Expected quantity: ${escapeHtml(quantity)}` : ""}`;
}

function buildLandingRequestEmail(requestId, data, submittedAt) {
  const variant = data.landingVariant;
  const variantLabel = variant === "catalog"
    ? "Catalog consultation"
    : variant === "dashboard"
      ? "Dashboard consultation"
      : "Cold email landing (/landing/korea) lead";
  const summary = variant === "catalog"
    ? asList(data.catalogItems)
    : variant === "dashboard"
      ? dashboardSummary(data.dashboardBrief)
      : `<p><strong>Business type:</strong> ${escapeHtml(data.businessType)}<br><strong>Referral source:</strong> ${escapeHtml(data.referralSource)}<br><strong>Positioning:</strong> ${escapeHtml(data.positioningArm)}</p>`;

  return {
    subject: `[landing/${escapeHtml(variant || "inquiry")}] ${escapeHtml(data.companyName || requestId)}`,
    html: `<div style="font-family:sans-serif;line-height:1.6"><h2>${variantLabel}</h2><p><strong>Company / brand:</strong> ${escapeHtml(data.companyName)}</p><p><strong>Contact:</strong> ${escapeHtml(data.contactName)}</p><p><strong>Email:</strong> ${escapeHtml(data.email)}</p><p><strong>Country:</strong> ${escapeHtml(data.country)}</p><p><strong>Expected quantity:</strong> ${escapeHtml(data.expectedVolume)}</p><p><strong>Request details:</strong></p>${summary}<p><strong>Message:</strong></p><p style="white-space:pre-wrap">${escapeHtml(data.message)}</p><hr><p style="color:#666;font-size:13px">UTM: ${escapeHtml(data.utmSource)} / ${escapeHtml(data.utmMedium)} / ${escapeHtml(data.utmCampaign)} / ${escapeHtml(data.utmContent)}<br>Document: landingRequests/${escapeHtml(requestId)}<br>Received: ${escapeHtml(submittedAt)}</p></div>`,
  };
}

module.exports = { escapeHtml, buildLandingRequestEmail };
