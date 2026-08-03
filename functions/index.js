const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");

initializeApp();
const db = getFirestore();

const ADMIN_EMAILS = defineString("ADMIN_EMAILS");

function getAdminEmails() {
  return ADMIN_EMAILS.value()
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function formatKoDate(date = new Date()) {
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function isAlreadyExistsError(error) {
  return error.code === 6 || error.code === "already-exists";
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

Medidakos connects US beauty brands like yours with pre-vetted, ISO 22716 GMP-certified Korean manufacturers. Every partner in our network has English-speaking project managers and real US export experience, so nothing gets lost in translation.

A few things you can do right now:
• Explore how it works — see our 5-step process from brief to US delivery: https://www.medidakos.com/process
• See why brands choose Korea — our side-by-side comparison: https://www.medidakos.com/compare
• Start a brief whenever you're ready — no commitment, no pressure.

There's no rush. When you're ready to talk through your product idea, just reply to this email and we'll help you map out the next steps.

Welcome to the start of something good,
The Medidakos Team

Medidakos · Korean Cosmetics OEM/ODM for US Brands
https://www.medidakos.com

From Medi Da KOS`;

  const html = `
    <div style="font-family:sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px">
      <p>Hi ${firstName},</p>
      <p>Welcome aboard — we're glad you're here.</p>
      <p>Launching a beauty brand is hard enough without also having to navigate overseas manufacturing, certifications, and shipping. That's exactly the part we handle for you.</p>
      <p>Medidakos connects US beauty brands like yours with pre-vetted, ISO 22716 GMP-certified Korean manufacturers. Every partner in our network has English-speaking project managers and real US export experience, so nothing gets lost in translation.</p>
      <p>A few things you can do right now:</p>
      <ul style="padding-left:1.25rem">
        <li>Explore how it works — see our 5-step process from brief to US delivery: <a href="https://www.medidakos.com/process">https://www.medidakos.com/process</a></li>
        <li>See why brands choose Korea — our side-by-side comparison: <a href="https://www.medidakos.com/compare">https://www.medidakos.com/compare</a></li>
        <li>Start a brief whenever you're ready — no commitment, no pressure.</li>
      </ul>
      <p>There's no rush. When you're ready to talk through your product idea, just reply to this email and we'll help you map out the next steps.</p>
      <p>Welcome to the start of something good,<br>The Medidakos Team</p>
      <p style="color:#666;font-size:13px;margin-top:2rem">
        Medidakos · Korean Cosmetics OEM/ODM for US Brands<br>
        <a href="https://www.medidakos.com">https://www.medidakos.com</a><br><br>
        From Medi Da KOS
      </p>
    </div>`;

  return { subject, text, html };
}

async function queueEmail(docId, payload) {
  try {
    await db.collection("mail").doc(docId).create(payload);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.log(`mail/${docId} already queued — skip.`);
      return;
    }
    throw error;
  }
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

exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const order = snap.data();
  const orderId = event.params.orderId;

  const isSample = order.type === "sample";
  const label = isSample ? "샘플 주문" : "일반 주문";
  const items = [order.title, order.summary].filter(Boolean).join(" — ") || "-";
  const orderedAt = formatKoDate();

  let customerEmail = order.customerEmail || null;
  let customerName = order.customerName || null;

  if (order.uid) {
    const userSnap = await db.collection("users").doc(order.uid).get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      customerEmail = customerEmail || userData.email || null;
      customerName =
        customerName || userData.displayName || userData.companyName || null;
    }
  }

  await queueEmail(`order_admin_${orderId}`, {
    to: getAdminEmails(),
    message: {
      subject: `[${label}] 신규 주문 - ${orderId}`,
      html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>${label}이 들어왔습니다</h2>
          <p><strong>주문번호:</strong> ${orderId}</p>
          <p><strong>주문자:</strong> ${customerName || customerEmail || order.uid || "-"}</p>
          <p><strong>이메일:</strong> ${customerEmail || "-"}</p>
          <p><strong>품목:</strong> ${items}</p>
          <p><strong>상태:</strong> ${order.status || "-"}</p>
          <p><strong>주문 시각:</strong> ${orderedAt}</p>
        </div>`,
    },
  });

  if (customerEmail) {
    await queueEmail(`order_customer_${orderId}`, {
      to: [customerEmail],
      message: {
        subject: `주문이 접수되었습니다 (${orderId})`,
        text: `주문번호 ${orderId} (${label})가 정상 접수되었습니다. 품목: ${items}`,
        html: `
          <div style="font-family:sans-serif;line-height:1.6">
            <h2>주문이 접수되었습니다</h2>
            <p>주문번호 <strong>${orderId}</strong> (${label})가 정상 접수되었습니다.</p>
            <p>품목: ${items}</p>
            <p style="color:#888;font-size:12px">본 메일은 주문 확인용으로 자동 발송되었습니다.</p>
          </div>`,
      },
    });
  }
});
