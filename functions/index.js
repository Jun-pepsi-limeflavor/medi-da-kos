/* eslint-disable @typescript-eslint/no-require-imports */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { queueAndSendEmail } = require("./gmail-notify");

// 기존 함수 3개가 전부 asia-northeast3에 배포돼 있는데 소스엔 리전 설정이 없었다.
// 이대로 배포하면 us-central1에 새로 만들고 서울 것을 지운다.
setGlobalOptions({ region: "asia-northeast3" });

initializeApp();
const db = getFirestore();

const ADMIN_EMAILS = defineString("ADMIN_EMAILS");
const NOTIFY_FROM_EMAIL = defineString("NOTIFY_FROM_EMAIL", {
  default: "support@medidakos.com",
});

function getAdminEmails() {
  return ADMIN_EMAILS.value()
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function formatKoDate(date = new Date()) {
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function getFirstName(displayName) {
  if (!displayName || !displayName.trim()) return "there";
  return displayName.trim().split(/\s+/)[0];
}

function buildMemberWelcomeEmail(firstName) {
  const subject = `Welcome to Medidakos, ${firstName} 👋`;

  const text = `Hi ${firstName},

Welcome aboard — we're glad you're here.

Launching a beauty brand is hard enough without also having to navigate overseas manufacturing, certifications, and shipping. That's exactly the part we handle for you.

Medidakos connects global beauty brands like yours with pre-vetted, ISO 22716 GMP-certified Korean manufacturers. Every partner in our network has English-speaking project managers and real export experience, so nothing gets lost in translation.

There's no rush. When you're ready to talk through your product idea, just reply to this email and we'll help you map out the next steps.

Welcome to the start of something good,
The Medidakos Team

Medidakos · Korean Cosmetics OEM/ODM for Global Brands
https://www.medidakos.com

From Medi Da KOS`;

  const html = `
    <div style="font-family:sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px">
      <p>Hi ${firstName},</p>
      <p>Welcome aboard — we're glad you're here.</p>
      <p>Launching a beauty brand is hard enough without also having to navigate overseas manufacturing, certifications, and shipping. That's exactly the part we handle for you.</p>
      <p>Medidakos connects global beauty brands like yours with pre-vetted, ISO 22716 GMP-certified Korean manufacturers. Every partner in our network has English-speaking project managers and real export experience, so nothing gets lost in translation.</p>
      <p>There's no rush. When you're ready to talk through your product idea, just reply to this email and we'll help you map out the next steps.</p>
      <p>Welcome to the start of something good,<br>The Medidakos Team</p>
      <p style="color:#666;font-size:13px;margin-top:2rem">
        Medidakos · Korean Cosmetics OEM/ODM for Global Brands<br>
        <a href="https://www.medidakos.com">https://www.medidakos.com</a><br><br>
        From Medi Da KOS
      </p>
    </div>`;

  return { subject, text, html };
}

async function queueEmail(docId, payload) {
  await queueAndSendEmail({
    db,
    docId,
    payload,
    from: NOTIFY_FROM_EMAIL.value(),
  });
}

exports.onUserSignup = onDocumentCreated("users/{userId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const user = snap.data();
  const userId = event.params.userId;
  const memberEmail = user.email;
  const memberName = user.displayName || user.name || "";
  const firstName = getFirstName(memberName);
  const signedUpAt = formatKoDate();

  if (memberEmail) {
    const welcome = buildMemberWelcomeEmail(firstName);
    await queueEmail(`signup_member_${userId}`, {
      to: [memberEmail],
      message: welcome,
    });
  }

  await queueEmail(`signup_admin_${userId}`, {
    to: getAdminEmails(),
    message: {
      subject: `신규 회원가입: ${memberEmail || userId}`,
      html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>새 회원이 가입했습니다</h2>
          <p><strong>이메일:</strong> ${memberEmail || "-"}</p>
          <p><strong>이름:</strong> ${memberName || "-"}</p>
          <p><strong>회사:</strong> ${user.companyName || "-"}</p>
          <p><strong>UID:</strong> ${userId}</p>
          <p><strong>가입 시각:</strong> ${signedUpAt}</p>
        </div>`,
    },
  });
});

// 2026-08-03 커밋 4a21933에서 소스에서만 삭제되고 운영엔 배포된 채 남아 있었다
// (그 커밋 메시지는 채널톡 건이고 이 삭제를 언급하지 않는다 — 실수로 보인다).
// 운영 동작을 기준으로 되돌린다. 소스에 없으면 다음 functions 배포가 이걸 지운다.
exports.onContactCreated = onDocumentCreated("contact/{contactId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const contact = snap.data();
  const contactId = event.params.contactId;
  const submittedAt = formatKoDate();

  const utmParts = [
    contact.utmSource && `source=${contact.utmSource}`,
    contact.utmMedium && `medium=${contact.utmMedium}`,
    contact.utmCampaign && `campaign=${contact.utmCampaign}`,
  ].filter(Boolean);

  await queueEmail(`contact_admin_${contactId}`, {
    to: getAdminEmails(),
    message: {
      subject: `[문의] ${contact.companyName || contact.email || contactId}`,
      html: `
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
        </div>`,
    },
  });
});

// Channel Talk 웹 접수 연동 — 기존 함수와 별개로 같은 문서 이벤트에 반응한다 (functions/channeltalk/triggers.js).
Object.assign(exports, require("./channeltalk/triggers"));

// Channel Talk lastContactAt 웹훅 수신 (functions/channeltalk/last-contact-trigger.js). 기본 off, 선택 배포만.
Object.assign(exports, require("./channeltalk/last-contact-trigger"));
