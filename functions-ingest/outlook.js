const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MICROSOFT_LOGIN_BASE = "https://login.microsoftonline.com";

class GraphRequestError extends Error {
  constructor(message, { status, url, code } = {}) {
    super(message);
    this.name = "GraphRequestError";
    this.status = status;
    this.url = url;
    this.code = code;
  }
}

function firstAddress(recipient) {
  const address = recipient?.emailAddress?.address;
  return typeof address === "string" ? address.trim().toLowerCase() : "";
}

function recipientAddresses(recipients) {
  return (Array.isArray(recipients) ? recipients : [])
    .map(firstAddress)
    .filter(Boolean);
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function bodyTextOf(body) {
  if (!body || typeof body.content !== "string") return "";
  return String(body.contentType).toLowerCase() === "html"
    ? stripHtml(body.content)
    : body.content;
}

function attachmentOf(file) {
  if (!file || typeof file.id !== "string" || !file.id) return null;
  return {
    filename: typeof file.name === "string" && file.name ? file.name : file.id,
    mimeType: typeof file.contentType === "string" && file.contentType
      ? file.contentType
      : "application/octet-stream",
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : 0,
    attachmentId: file.id,
  };
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Outlook message has no valid sent/received date");
  }
  return date.toISOString();
}

function safeGraphId(id) {
  if (typeof id !== "string") return "";
  return id.trim().replace(/\//g, "_").replace(/\+/g, "-");
}

/**
 * Convert a Microsoft Graph message resource into the shared messages contract.
 * Graph fields used here are documented message properties; no provider payload
 * is logged or copied into an error message.
 */
function normalizeMessage(raw, {
  account,
  channel = "outlook_support",
  side = "unknown",
  sideSource = "account_rule",
} = {}) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    throw new TypeError("Outlook message id is required");
  }
  if (typeof account !== "string" || !account.trim()) {
    throw new TypeError("Outlook source account is required");
  }

  const sourceAccount = account.trim().toLowerCase();
  const sender = raw.sender?.emailAddress || raw.from?.emailAddress || {};
  const from = typeof sender.address === "string" ? sender.address.trim().toLowerCase() : "";
  const rawThreadId = typeof raw.conversationId === "string" && raw.conversationId
    ? raw.conversationId
    : raw.id;
  const externalId = safeGraphId(raw.id);
  const providerThreadId = safeGraphId(rawThreadId);
  const sentAt = normalizeDate(raw.sentDateTime || raw.receivedDateTime);
  const files = Array.isArray(raw.attachments) ? raw.attachments.map(attachmentOf).filter(Boolean) : [];

  return {
    docId: `${channel}:${externalId}`,
    channel,
    side,
    sideSource,
    sourceAccount,
    externalId,
    providerThreadId,
    threadKey: `${channel}:${sourceAccount}:${providerThreadId}`,
    // Graph does not expose Gmail's historyId. Keep a stable provider revision.
    historyId: String(raw.changeKey || raw.internetMessageId || raw.id),
    direction: from === sourceAccount ? "out" : "in",
    from,
    fromName: typeof sender.name === "string" ? sender.name : "",
    to: recipientAddresses(raw.toRecipients),
    subject: typeof raw.subject === "string" ? raw.subject : "",
    bodyText: bodyTextOf(raw.body),
    attachments: files,
    sentAt,
  };
}


function initialDeltaUrl({ mailbox, folder = "inbox", baseUrl = GRAPH_BASE, since } = {}) {
  if (typeof mailbox !== "string" || !mailbox.trim()) {
    throw new TypeError("Outlook mailbox is required");
  }
  const root = baseUrl.replace(/\/$/, "");
  const url = new URL(`${root}/users/${encodeURIComponent(mailbox.trim())}/mailFolders/${encodeURIComponent(folder)}/messages/delta`);
  url.searchParams.set(
    "$select",
    "id,conversationId,internetMessageId,changeKey,subject,body,sender,from,toRecipients,sentDateTime,receivedDateTime,hasAttachments",
  );
  url.searchParams.set("$expand", "attachments($select=id,name,contentType,size,isInline)");
  if (since) url.searchParams.set("$filter", `receivedDateTime ge ${since}`);
  return url.toString();
}

function isDeltaExpired(status) {
  return status === 404 || status === 410;
}

async function fetchJson(url, token, { fetchImpl = global.fetch, pageSize = 50 } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: `odata.maxpagesize=${pageSize}`,
    },
  });
  if (!response.ok) {
    const code = isDeltaExpired(response.status) ? "DELTA_EXPIRED" : "GRAPH_REQUEST_FAILED";
    throw new GraphRequestError(`Microsoft Graph request failed (${response.status})`, {
      status: response.status,
      url,
      code,
    });
  }
  return response.json();
}

/** Exchange the app registration's secret for a Graph-only access token. */
async function getClientCredentialsToken({
  tenantId,
  clientId,
  clientSecret,
  fetchImpl = global.fetch,
} = {}) {
  if (!tenantId || !clientId || !clientSecret) {
    throw new TypeError("Outlook tenantId, clientId, and clientSecret are required");
  }
  const url = `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const json = await response.json();
  if (!response.ok || typeof json.access_token !== "string" || !json.access_token) {
    throw new GraphRequestError(`Microsoft Graph token request failed (${response.status})`, {
      status: response.status,
      url,
      code: "GRAPH_TOKEN_FAILED",
    });
  }
  return json.access_token;
}

/** Fetch one opaque Graph delta page. Callers persist only deltaLink after saving all items. */
async function fetchDeltaPage(token, url, options = {}) {
  const json = await fetchJson(url, token, options);
  const changes = Array.isArray(json.value) ? json.value : [];
  return {
    changes,
    messages: changes.filter((item) => !item?.["@removed"]),
    removed: changes.filter((item) => Boolean(item?.["@removed"])),
    nextLink: typeof json["@odata.nextLink"] === "string" ? json["@odata.nextLink"] : null,
    deltaLink: typeof json["@odata.deltaLink"] === "string" ? json["@odata.deltaLink"] : null,
  };
}

/**
 * Consume a complete delta round. `deltaLink` is a candidate cursor only; the
 * caller must save every returned message before persisting it.
 */
async function listDeltaPages(token, {
  mailbox,
  folder = "inbox",
  deltaLink,
  since,
  baseUrl = GRAPH_BASE,
  pageSize = 50,
  maxPages = 1000,
  fetchImpl = global.fetch,
} = {}) {
  let url = deltaLink || initialDeltaUrl({ mailbox, folder, baseUrl, since });
  const pages = [];
  const changes = [];
  const seen = new Set();

  while (url) {
    if (seen.has(url)) throw new Error("Microsoft Graph returned a repeated pagination link");
    if (pages.length >= maxPages) throw new Error("Microsoft Graph pagination exceeded maxPages");
    seen.add(url);
    const page = await fetchDeltaPage(token, url, { fetchImpl, pageSize });
    pages.push(page);
    changes.push(...page.changes);
    url = page.nextLink;
    if (!url && page.deltaLink) {
      return {
        pages,
        changes,
        messages: changes.filter((item) => !item?.["@removed"]),
        removed: changes.filter((item) => Boolean(item?.["@removed"])),
        deltaLink: page.deltaLink,
      };
    }
  }

  // A well-formed completed round has a deltaLink. Do not advance a cursor
  // when a provider returned neither link.
  return {
    pages,
    changes,
    messages: changes.filter((item) => !item?.["@removed"]),
    removed: changes.filter((item) => Boolean(item?.["@removed"])),
    deltaLink: null,
  };
}

module.exports = {
  GRAPH_BASE,
  GraphRequestError,
  stripHtml,
  bodyTextOf,
  normalizeMessage,
  initialDeltaUrl,
  getClientCredentialsToken,
  fetchDeltaPage,
  listDeltaPages,
  isDeltaExpired,
};
