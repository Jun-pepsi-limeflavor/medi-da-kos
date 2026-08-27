const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

function header(payload, name) {
  const found = (payload?.headers || []).find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

function parseAddress(value) {
  const m = value.match(/^\s*(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?\s*$/);
  if (!m) return { name: "", email: value.trim().toLowerCase() };
  return { name: (m[1] || "").trim(), email: m[2].trim().toLowerCase() };
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
    to: header(raw.payload, "To")
      .split(",")
      .map((s) => parseAddress(s).email)
      .filter(Boolean),
    subject: header(raw.payload, "Subject"),
    bodyText,
    attachments: collectAttachments(raw.payload),
    sentAt: new Date(Number(raw.internalDate)).toISOString(),
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

module.exports = {
  normalizeMessage, listMessagePage, listAllMessageIds, getMessage, parseAddress, stripHtml,
};
