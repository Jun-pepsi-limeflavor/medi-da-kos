const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

const MAX_REPLY_BYTES = 100_000;

function assertHeaderValue(value, name) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) {
    throw new Error(`${name} contains an invalid line break`);
  }
  return value.trim();
}

function header(payload, name) {
  const found = (payload?.headers || []).find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

function parseAddressList(value) {
  // Gmail's common `Name <a@b>` form is sufficient for the stored recipient
  // contract. Rejecting malformed entries is safer than accidentally sending
  // to a value that came from a browser request.
  return value
    .split(",")
    .map((part) => parseAddress(part).email)
    .filter(Boolean);
}

function parseAddress(value) {
  // The angle-bracket form is matched first and on its own. A single optional
  // name group in front of a bare address backtracks: it eats every character
  // it can, leaving the address a one-character local part ("support@x" became
  // "t@x"), which then keys the wrong conversation identity.
  const angled = value.match(/^\s*(.*?)\s*<\s*([^\s<>]+@[^\s<>]+)\s*>\s*$/);
  if (angled) {
    return {
      name: angled[1].trim().replace(/^"(.*)"$/, "$1").trim(),
      email: angled[2].trim().toLowerCase(),
    };
  }
  return { name: "", email: value.trim().toLowerCase() };
}

function decode(data) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/ /g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 중첩 파트를 훑어 mimeType 이 맞는 첫 본문을 찾는다. */
function findBody(payload, mimeType) {
  if (!payload) return "";
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decode(payload.body.data);
  }
  for (const part of payload.parts || []) {
    const found = findBody(part, mimeType);
    if (found) return found;
  }
  return "";
}

function collectAttachments(payload, out = []) {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size ?? 0,
      attachmentId: payload.body.attachmentId,
    });
  }
  for (const part of payload.parts || []) collectAttachments(part, out);
  return out;
}

function normalizeMessage(raw, { channel, side, sideSource, account }) {
  const from = parseAddress(header(raw.payload, "From"));
  const plain = findBody(raw.payload, "text/plain");
  const bodyText = plain || stripHtml(findBody(raw.payload, "text/html"));

  return {
    docId: `${channel}:${raw.id}`,
    channel,
    side,
    sideSource,
    sourceAccount: account.toLowerCase(),
    externalId: raw.id,
    providerThreadId: raw.threadId,
    threadKey: `${channel}:${account.toLowerCase()}:${raw.threadId}`,
    historyId: raw.historyId,
    direction: from.email === account.toLowerCase() ? "out" : "in",
    from: from.email,
    fromName: from.name,
    to: parseAddressList(header(raw.payload, "To")),
    subject: header(raw.payload, "Subject"),
    bodyText,
    attachments: collectAttachments(raw.payload),
    sentAt: new Date(Number(raw.internalDate)).toISOString(),
    // Minimum RFC metadata needed to make a server-side reply threadable.
    // These are provider values, never values accepted from the browser.
    messageId: header(raw.payload, "Message-ID"),
    inReplyTo: header(raw.payload, "In-Reply-To"),
    references: header(raw.payload, "References"),
  };
}

async function listMessagePage(token, { after, pageToken, max = 100 }) {
  const q = after ? `after:${after}` : "newer_than:7d";
  const params = new URLSearchParams({ maxResults: String(max), q });
  if (pageToken) params.set("pageToken", pageToken);
  const url = `${GMAIL}/messages?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`목록 조회 실패 ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return {
    ids: (json.messages || []).map((m) => m.id),
    nextPageToken: json.nextPageToken ?? null,
  };
}

async function listAllMessageIds(token, { after }) {
  const ids = [];
  let pageToken;
  do {
    const page = await listMessagePage(token, { after, pageToken });
    ids.push(...page.ids);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

async function getMessage(token, id) {
  const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`메시지 조회 실패 ${res.status}: ${await res.text()}`);
  return res.json();
}

function encodeMimeWord(value) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}=?`;
}

function wrapBase64(value) {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

/**
 * Build a complete RFC 5322 message for Gmail users.messages.send.
 * `from`, `to`, and threading metadata must be derived by the server from a
 * stored message. This helper still rejects header injection defensively.
 */
function buildReplyMime({ from, to, subject, bodyText, inReplyTo, references, messageId }) {
  const sender = assertHeaderValue(from, "From");
  const recipient = assertHeaderValue(to, "To");
  const title = assertHeaderValue(subject, "Subject");
  const replyTo = assertHeaderValue(inReplyTo || "", "In-Reply-To");
  const refs = assertHeaderValue(references || "", "References");
  const id = assertHeaderValue(messageId || "", "Message-ID");
  if (!sender || !recipient || !title || typeof bodyText !== "string" || !bodyText.trim()) {
    throw new Error("Reply MIME requires sender, recipient, subject, and body");
  }
  if (Buffer.byteLength(bodyText, "utf8") > MAX_REPLY_BYTES) {
    throw new Error("Reply body is too large");
  }

  const lines = [
    `From: ${sender}`,
    `To: ${recipient}`,
    `Subject: ${encodeMimeWord(title)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (id) lines.splice(3, 0, `Message-ID: ${id}`);
  if (replyTo) lines.splice(id ? 4 : 3, 0, `In-Reply-To: ${replyTo}`);
  if (refs) lines.splice(replyTo ? (id ? 5 : 4) : (id ? 4 : 3), 0, `References: ${refs}`);
  return `${lines.join("\r\n")}\r\n\r\n${wrapBase64(bodyText)}`;
}

function encodeRawMessage(raw) {
  if (typeof raw !== "string" || !raw) throw new Error("Raw Gmail message is required");
  return Buffer.from(raw, "utf8").toString("base64url");
}

async function sendMessage(token, { raw, threadId }) {
  if (typeof token !== "string" || !token) throw new Error("Gmail access token is required");
  if (typeof threadId !== "string" || !threadId.trim()) throw new Error("Gmail thread ID is required");
  const res = await fetch(`${GMAIL}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw: encodeRawMessage(raw), threadId: threadId.trim() }),
  });
  if (!res.ok) throw new Error(`Gmail 발송 실패 ${res.status}`);
  const json = await res.json();
  if (!json.id || !json.threadId) throw new Error("Gmail 발송 응답에 메시지 ID가 없습니다");
  return { id: json.id, threadId: json.threadId, historyId: json.historyId || "" };
}

module.exports = {
  normalizeMessage,
  listMessagePage,
  listAllMessageIds,
  getMessage,
  sendMessage,
  buildReplyMime,
  encodeRawMessage,
  parseAddress,
  parseAddressList,
  stripHtml,
};
