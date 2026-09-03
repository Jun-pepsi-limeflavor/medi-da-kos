/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const { GoogleAuth } = require("google-auth-library");

const SA =
  process.env.INGEST_SERVICE_ACCOUNT ||
  "mail-ingest@medidakos.iam.gserviceaccount.com";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const MAX_NOTIFY_BYTES = 200_000;
const APPROVED_NOTIFY_FROM = Object.freeze(["support@medidakos.com"]);
const approvedFrom = new Set(APPROVED_NOTIFY_FROM);

const tokenCache = new Map();

function isAlreadyExistsError(error) {
  return error.code === 6 || error.code === "already-exists";
}

function assertHeaderValue(value, name) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) {
    throw new Error(`${name} contains an invalid line break`);
  }
  return value.trim();
}

function normalizeMailbox(account) {
  if (typeof account !== "string") throw new Error("Notify mailbox must be a string");
  const normalized = account.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized)) {
    throw new Error("Notify mailbox is invalid");
  }
  return normalized;
}

function normalizeNotifyRecipients(to) {
  const list = Array.isArray(to) ? to : to == null ? [] : [to];
  const emails = list.map((email) => {
    if (typeof email !== "string") throw new Error("Notify recipient is invalid");
    const trimmed = assertHeaderValue(email, "To");
    if (!trimmed) throw new Error("Notify recipient is empty");
    return trimmed;
  });
  if (emails.length === 0) throw new Error("Notify requires at least one recipient");
  return emails;
}

function wrapBase64(value) {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function fallbackText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assertBodySize(...parts) {
  const total = parts.reduce((sum, part) => sum + Buffer.byteLength(part || "", "utf8"), 0);
  if (total > MAX_NOTIFY_BYTES) throw new Error("Notification body is too large");
}

/**
 * RFC 5322 notification for Gmail users.messages.send.
 * `from` / `to` / `subject` reject header injection. `boundary` is injectable
 * so tests stay deterministic.
 */
function buildNotificationMime({ from, to, subject, text, html, boundary }) {
  const sender = assertHeaderValue(from, "From");
  const recipients = normalizeNotifyRecipients(to);
  const title = assertHeaderValue(subject, "Subject");
  if (!title) throw new Error("Notification MIME requires a subject");

  const rich = typeof html === "string" && html.trim() ? html : "";
  const plain =
    typeof text === "string" && text.trim()
      ? text
      : rich
        ? fallbackText(rich)
        : "";
  if (!plain && !rich) throw new Error("Notification MIME requires a body");
  assertBodySize(plain, rich);

  const toLine = recipients.join(", ");
  const headers = [
    `From: ${sender}`,
    `To: ${toLine}`,
    // Gmail API re-encodes RFC 2047 encoded-words and clients then show
    // `=?UTF-8?B?...?=` as the literal subject. Pass UTF-8; Gmail encodes for SMTP.
    `Subject: ${title}`,
    "MIME-Version: 1.0",
  ];

  if (!rich) {
    return `${headers.join("\r\n")}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapBase64(plain)}`;
  }

  const mimeBoundary = boundary || `=_mdk_${crypto.randomBytes(12).toString("hex")}`;
  if (/[\r\n]/.test(mimeBoundary)) throw new Error("MIME boundary is invalid");
  const parts = [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${mimeBoundary}"`,
    "",
    `--${mimeBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(plain || fallbackText(rich)),
    `--${mimeBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(rich),
    `--${mimeBoundary}--`,
  ];
  return parts.join("\r\n");
}

function encodeRawMessage(raw) {
  if (typeof raw !== "string" || !raw) throw new Error("Raw Gmail message is required");
  return Buffer.from(raw, "utf8").toString("base64url");
}

async function getNotifyToken(fromEmail, { googleAuth } = {}) {
  const account = normalizeMailbox(fromEmail);
  if (!approvedFrom.has(account)) {
    throw new Error(`Notify mailbox is not approved: ${account}`);
  }

  const cacheKey = `${account}|${GMAIL_SEND_SCOPE}`;
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const auth = googleAuth || new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const now = Math.floor(Date.now() / 1000);
  let signed;
  try {
    signed = await client.request({
      url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA}:signJwt`,
      method: "POST",
      data: {
        payload: JSON.stringify({
          iss: SA,
          sub: account,
          scope: GMAIL_SEND_SCOPE,
          aud: TOKEN_ENDPOINT,
          iat: now,
          exp: now + 3600,
        }),
      },
    });
  } catch {
    throw new Error(`IAM signJwt failed for notify (${account})`);
  }
  const signedJwt = signed?.data?.signedJwt;
  if (!signedJwt) throw new Error(`IAM signJwt failed for notify (${account})`);

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`토큰 교환 실패 (${account})`);
  }

  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

async function sendNotification({
  token,
  from,
  to,
  subject,
  text,
  html,
  boundary,
  fetchImpl = fetch,
}) {
  if (typeof token !== "string" || !token) {
    throw new Error("Gmail access token is required");
  }
  const raw = buildNotificationMime({ from, to, subject, text, html, boundary });
  const res = await fetchImpl(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw: encodeRawMessage(raw) }),
  });
  if (!res.ok) throw new Error(`Gmail 발송 실패 ${res.status}`);
  const json = await res.json();
  if (!json.id) throw new Error("Gmail 발송 응답에 메시지 ID가 없습니다");
  return { id: json.id, threadId: json.threadId || "" };
}

async function defaultSend(fields) {
  const token = await getNotifyToken(fields.from);
  return sendNotification({ token, ...fields });
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Reserve `mail/{docId}`, send via Gmail, then record delivery.
 * SUCCESS is idempotent. PENDING/ERROR retries the send.
 */
async function queueAndSendEmail({
  db,
  docId,
  payload,
  from,
  send = defaultSend,
  now = nowIso,
}) {
  if (!docId || typeof docId !== "string") throw new Error("mail docId is required");
  if (!payload || typeof payload !== "object") throw new Error("mail payload is required");
  const message = payload.message;
  if (!message || typeof message !== "object") throw new Error("mail message is required");
  const recipients = normalizeNotifyRecipients(payload.to);
  const sender = normalizeMailbox(from);
  if (!approvedFrom.has(sender)) {
    throw new Error(`Notify mailbox is not approved: ${sender}`);
  }

  const ref = db.collection("mail").doc(docId);
  const startedAt = now();
  let existing = null;

  try {
    await ref.create({
      to: recipients,
      message,
      delivery: { state: "PENDING", startTime: startedAt },
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error;
    const snap = await ref.get();
    existing = snap.exists ? snap.data() : null;
    if (existing?.delivery?.state === "SUCCESS") {
      console.log(`mail/${docId} already sent — skip.`);
      return { skipped: true };
    }
  }

  try {
    const result = await send({
      from: sender,
      to: recipients,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    const endedAt = now();
    await ref.update({
      delivery: {
        state: "SUCCESS",
        startTime: existing?.delivery?.startTime || startedAt,
        endTime: endedAt,
        info: result.id,
      },
    });
    return { skipped: false, id: result.id };
  } catch (error) {
    const endedAt = now();
    try {
      await ref.update({
        delivery: {
          state: "ERROR",
          startTime: existing?.delivery?.startTime || startedAt,
          endTime: endedAt,
          error: "Gmail send failed",
        },
      });
    } catch {
      // Keep the original send error; a delivery write failure must not hide it.
    }
    throw error;
  }
}

module.exports = {
  APPROVED_NOTIFY_FROM,
  GMAIL_SEND_SCOPE,
  MAX_NOTIFY_BYTES,
  buildNotificationMime,
  encodeRawMessage,
  getNotifyToken,
  normalizeNotifyRecipients,
  queueAndSendEmail,
  sendNotification,
};
