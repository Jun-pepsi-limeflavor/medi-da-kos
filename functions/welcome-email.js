/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 회원가입 환영 메일 양식 (onUserSignup → 가입한 회원에게 발송).
 *
 * 이름은 회원이 직접 입력한 값이다. HTML 본문에는 이스케이프해서 넣는다.
 * 제목·텍스트 파트는 HTML이 아니므로 그대로 둔다(이름은 공백 기준 첫 단어라 줄바꿈이 없다).
 */

const { escapeHtml } = require("./html-escape");

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
      <p>Hi ${escapeHtml(firstName)},</p>
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

module.exports = { buildMemberWelcomeEmail, getFirstName };
