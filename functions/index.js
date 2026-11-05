/* eslint-disable @typescript-eslint/no-require-imports */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { queueAndSendEmail } = require("./gmail-notify");
const { buildContactAdminEmail } = require("./contact-email");
const { buildSignupAdminEmail } = require("./signup-email");
const { buildMemberWelcomeEmail, getFirstName } = require("./welcome-email");

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
    message: buildSignupAdminEmail({
      userId,
      memberEmail,
      memberName,
      companyName: user.companyName,
      signedUpAt,
    }),
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

  await queueEmail(`contact_admin_${contactId}`, {
    to: getAdminEmails(),
    message: buildContactAdminEmail({ contactId, contact, submittedAt }),
  });
});

// Channel Talk 웹 접수 연동 — 기존 함수와 별개로 같은 문서 이벤트에 반응한다 (functions/channeltalk/triggers.js).
Object.assign(exports, require("./channeltalk/triggers"));

// Channel Talk lastContactAt 웹훅 수신 (functions/channeltalk/last-contact-trigger.js). 기본 off, 선택 배포만.
Object.assign(exports, require("./channeltalk/last-contact-trigger"));
