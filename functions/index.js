const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { buildLifecycleList, SEGMENT_ORDER } = require("./lifecycle");

// 기존 함수 3개가 전부 asia-northeast3에 배포돼 있는데 소스엔 리전 설정이 없었다.
// 이대로 배포하면 us-central1에 새로 만들고 서울 것을 지운다.
setGlobalOptions({ region: "asia-northeast3" });

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

/**
 * koreaLeads는 비로그인 공개 폼이라 값이 그대로 관리자 메일 본문에 들어간다.
 * 이스케이프 없이 붙이면 제출자가 우리 수신함에 임의 HTML을 심을 수 있다.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return "-";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

/**
 * /korea 콜드메일 랜딩 문의 알림.
 *
 * contact 컬렉션에는 알림이 없어서 문의가 들어와도 Firestore 콘솔을 열어야 알 수 있었다.
 * 여기는 콜드메일 회신이 실제로 떨어지는 곳이라 놓치면 손실이다.
 * isTest(운영 도메인 밖 제출)는 발송하지 않는다.
 */
exports.onKoreaLeadCreated = onDocumentCreated(
  "koreaLeads/{leadId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const lead = snap.data();
    if (lead.isTest === true) {
      console.log(`koreaLeads/${event.params.leadId} isTest — 알림 생략.`);
      return;
    }

    const leadId = event.params.leadId;
    const submittedAt = formatKoDate();

    await queueEmail(`korea_lead_admin_${leadId}`, {
      to: getAdminEmails(),
      message: {
        subject: `[korea] ${lead.companyName || "-"} — ${lead.expectedVolumeLabel || "-"}`,
        html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>콜드메일 랜딩(/korea) 문의</h2>
          <p><strong>브랜드:</strong> ${escapeHtml(lead.companyName)}</p>
          <p><strong>이메일:</strong> ${escapeHtml(lead.email)}</p>
          <p><strong>예상 물량:</strong> ${escapeHtml(lead.expectedVolumeLabel)}</p>
          <p><strong>고객 유형:</strong> ${escapeHtml(lead.businessType)}</p>
          <p><strong>인지 경로:</strong> ${escapeHtml(lead.referralSource)}</p>
          <p><strong>내용:</strong></p>
          <p style="white-space:pre-wrap;border-left:3px solid #bae6fd;padding-left:12px">${escapeHtml(lead.message)}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
          <p style="color:#666;font-size:13px">
            포지셔닝: ${escapeHtml(lead.positioningArm)}<br>
            utm_source: ${escapeHtml(lead.utmSource)} /
            utm_medium: ${escapeHtml(lead.utmMedium)} /
            utm_campaign: ${escapeHtml(lead.utmCampaign)} /
            utm_content: ${escapeHtml(lead.utmContent)}<br>
            GA client id: ${escapeHtml(lead.gaClientId)}<br>
            문서: koreaLeads/${escapeHtml(leadId)}<br>
            접수 시각: ${escapeHtml(submittedAt)}
          </p>
        </div>`,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// 이탈 복구·육성 트랙 — 일일 스캔
//
// 왜 필요한가: 외부 가입자 14명 중 11명이 한 번도 접촉되지 않은 채로 있었다
// (2026-08-06 실측). 리드가 부족한 게 아니라 들어온 리드를 아무도 안 보는 게
// 병목이었고, 알림이 가입 시점 한 번뿐이라 그 뒤로는 아무 일도 안 일어난다.
//
// 이 함수는 **보내지 않는다.** 누구에게 무엇을 보내야 하는지만 매일 집계해
// 관리자에게 알린다. 발송은 사람이 한다 — 문안에 아직 사람 손이 필요하고
// (실측 리드타임 숫자, 개별 사정), 육성 메일은 support@가 아니라
// thomas@medidakoslabs.com에서 나가야 답장이 제자리로 온다.
// ---------------------------------------------------------------------------

const LIFECYCLE_SCAN_TZ = "Asia/Seoul";

/**
 * 브리프를 읽을 때 로고 base64를 빼고 가져온다.
 *
 * `step3.logoDataUrl`은 문서당 수백 KB짜리 data URL이라, 그냥 읽으면 스캔
 * 한 번에 수 MB를 끌어온다. 판정에는 `logoFileName` 존재 여부면 충분하다.
 */
const BRIEF_FIELDS = [
  "uid",
  "status",
  "updatedAt",
  "step1",
  "step2",
  "step3.logoFileName",
  "step4",
  "step5",
  "step6",
];

function renderLifecycleRows(rows) {
  return rows
    .map((row) => {
      const idle = row.idleDays === null ? "-" : `${row.idleDays}일`;
      const contacted = row.touchesSent
        ? `${row.touchesSent}회 (마지막 ${escapeHtml(row.lastContact)})`
        : "없음";
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(row.segmentLabel)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(row.displayName)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(row.email)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(idle)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(contacted)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${row.nextTouch ? `t${row.nextTouch}` : "시퀀스 종료"}</td>
        </tr>`;
    })
    .join("");
}

function buildLifecycleEmail({ rows, skipped, scannedAt }) {
  const bySegment = SEGMENT_ORDER.map((segment) => {
    const count = rows.filter((row) => row.segment === segment).length;
    return count ? `${segment} ${count}` : null;
  })
    .filter(Boolean)
    .join(" · ");

  return {
    subject: `[육성 트랙] 접촉 대기 ${rows.length}명 — ${scannedAt.slice(0, 10)}`,
    html: `
      <div style="font-family:sans-serif;line-height:1.6">
        <h2>이탈 복구·육성 트랙 일일 스캔</h2>
        <p><strong>접촉 대기 ${rows.length}명</strong> — ${escapeHtml(bySegment)}</p>
        <table style="border-collapse:collapse;font-size:14px;width:100%">
          <thead>
            <tr style="background:#f1f5f9;text-align:left">
              <th style="padding:6px 10px">막힌 지점</th>
              <th style="padding:6px 10px">이름</th>
              <th style="padding:6px 10px">이메일</th>
              <th style="padding:6px 10px;text-align:right">방치</th>
              <th style="padding:6px 10px">접촉 이력</th>
              <th style="padding:6px 10px">다음</th>
            </tr>
          </thead>
          <tbody>${renderLifecycleRows(rows)}</tbody>
        </table>
        <p style="color:#666;font-size:13px;margin-top:16px">
          문안은 <code>_workspace/육성_메일_시퀀스_v2</code>, 링크는
          <code>utm_links.lifecycle_link(세그먼트, 회차)</code>로 뽑는다.<br>
          발송 후에는 <code>lifecycleContacts</code>에 기록해야 다음 회차가 계산된다 —
          기록이 없으면 매일 같은 사람이 t1로 뜬다.<br>
          제외: 내부 계정 ${skipped.internal} · 기존 고객 ${skipped.customer} · 제출 완료 ${skipped.submitted}<br>
          스캔 시각: ${escapeHtml(scannedAt)}
        </p>
      </div>`,
  };
}

exports.lifecycleScan = onSchedule(
  { schedule: "0 9 * * *", timeZone: LIFECYCLE_SCAN_TZ },
  async () => {
    const [usersSnap, briefsSnap, ordersSnap, samplesSnap, contactsSnap] =
      await Promise.all([
        db.collection("users").get(),
        db.collection("cmBriefs").select(...BRIEF_FIELDS).get(),
        db.collection("orders").select("uid").get(),
        db.collection("sampleRequests").select("uid").get(),
        db.collection("lifecycleContacts").get(),
      ]);

    const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const briefsByUid = new Map(
      briefsSnap.docs.map((doc) => [doc.data().uid || doc.id, doc.data()])
    );
    const customerUids = new Set(
      [...ordersSnap.docs, ...samplesSnap.docs]
        .map((doc) => doc.data().uid)
        .filter(Boolean)
    );
    const contactsByUid = new Map();
    for (const doc of contactsSnap.docs) {
      const contact = doc.data();
      if (!contact.uid) continue;
      const list = contactsByUid.get(contact.uid) || [];
      list.push(contact);
      contactsByUid.set(contact.uid, list);
    }

    const scannedAt = formatKoDate();
    const { rows, skipped } = buildLifecycleList({
      users,
      briefsByUid,
      customerUids,
      contactsByUid,
    });

    const dateKey = new Date()
      .toLocaleDateString("sv-SE", { timeZone: LIFECYCLE_SCAN_TZ });

    // 스냅샷은 결과가 비어도 남긴다 — "그날 0명이었다"와 "스캔이 안 돌았다"를
    // 구분할 방법이 이것뿐이다.
    await db.collection("lifecycleQueue").doc(dateKey).set({
      scannedAt,
      total: rows.length,
      skipped,
      rows,
    });

    // 메일은 보낼 사람이 있을 때만. 매일 "0명"이 오면 읽지 않게 된다.
    const pending = rows.filter((row) => row.nextTouch !== null);
    if (!pending.length) {
      console.log(`lifecycleScan ${dateKey}: 접촉 대기 0명 — 메일 생략`);
      return;
    }

    await queueEmail(`lifecycle_scan_${dateKey}`, {
      to: getAdminEmails(),
      message: buildLifecycleEmail({ rows: pending, skipped, scannedAt }),
    });

    console.log(`lifecycleScan ${dateKey}: 접촉 대기 ${pending.length}명 — 알림 발송`);
  }
);
