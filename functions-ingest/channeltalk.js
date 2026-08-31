const CHANNEL_TALK_BASE = "https://api.channel.io/open/v5";

class ChannelTalkRequestError extends Error {
  constructor(message, { status, url, code } = {}) {
    super(message);
    this.name = "ChannelTalkRequestError";
    this.status = status;
    this.url = url;
    this.code = code;
  }
}

function headers({ accessKey, accessSecret, channelVersion } = {}) {
  if (!accessKey || !accessSecret || !channelVersion) {
    throw new TypeError("Channel Talk accessKey, accessSecret, and channelVersion are required");
  }
  return {
    "x-access-key": accessKey,
    "x-access-secret": accessSecret,
    "Channel-Version": channelVersion,
    Accept: "application/json",
  };
}

function queryUrl(path, {
  baseUrl = CHANNEL_TALK_BASE,
  since,
  limit = 25,
  sortOrder = "asc",
  state,
} = {}) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  if (since) url.searchParams.set("since", since);
  if (limit != null) url.searchParams.set("limit", String(limit));
  if (sortOrder) url.searchParams.set("sortOrder", sortOrder);
  if (path === "user-chats" && state) url.searchParams.set("state", state);
  return url.toString();
}

async function fetchJson(url, credentials, { fetchImpl = global.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  const response = await fetchImpl(url, { headers: headers(credentials) });
  if (!response.ok) {
    throw new ChannelTalkRequestError(`Channel Talk request failed (${response.status})`, {
      status: response.status,
      url,
      code: "CHANNEL_TALK_REQUEST_FAILED",
    });
  }
  return response.json();
}

async function listUserChatsPage(credentials, options = {}) {
  const url = queryUrl("user-chats", { state: "opened", ...options });
  const json = await fetchJson(url, credentials, options);
  return {
    userChats: Array.isArray(json.userChats) ? json.userChats : [],
    // The combined endpoint may also include related messages; retain them for
    // callers that do not need a second request, without assuming their shape.
    messages: Array.isArray(json.messages) ? json.messages : [],
    next: typeof json.next === "string" ? json.next : null,
    prev: typeof json.prev === "string" ? json.prev : null,
  };
}

async function listChatMessagesPage(userChatId, credentials, options = {}) {
  if (typeof userChatId !== "string" || !userChatId) {
    throw new TypeError("Channel Talk userChatId is required");
  }
  const path = `user-chats/${encodeURIComponent(userChatId)}/messages`;
  const url = queryUrl(path, options);
  const json = await fetchJson(url, credentials, options);
  return {
    messages: Array.isArray(json.messages) ? json.messages : [],
    next: typeof json.next === "string" ? json.next : null,
    prev: typeof json.prev === "string" ? json.prev : null,
  };
}

async function getChannelTalkUser(userId, credentials, options = {}) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("Channel Talk userId is required");
  }
  const baseUrl = options.baseUrl || CHANNEL_TALK_BASE;
  const url = `${baseUrl}/users/${encodeURIComponent(userId.trim())}`;
  const json = await fetchJson(url, credentials, options);
  return json?.user && typeof json.user === "object" ? json.user : json;
}

async function collectPages(fetchPage, { since, maxPages = 1000 } = {}) {
  let cursor = since;
  const pages = [];
  const items = [];
  const seen = new Set();
  while (true) {
    if (cursor && seen.has(cursor)) throw new Error("Channel Talk returned a repeated pagination cursor");
    if (pages.length >= maxPages) throw new Error("Channel Talk pagination exceeded maxPages");
    if (cursor) seen.add(cursor);
    const page = await fetchPage(cursor);
    pages.push(page);
    items.push(...page.items);
    if (!page.next) {
      return { pages, items, nextCursor: null, complete: true };
    }
    cursor = page.next;
  }
}

async function listAllUserChats(credentials, options = {}) {
  const result = await collectPages(
    async (since) => {
      const page = await listUserChatsPage(credentials, { ...options, since });
      return { ...page, items: page.userChats };
    },
    options,
  );
  return { ...result, userChats: result.items };
}

async function listAllChatMessages(userChatId, credentials, options = {}) {
  const result = await collectPages(
    async (since) => {
      const page = await listChatMessagesPage(userChatId, credentials, { ...options, since });
      return { ...page, items: page.messages };
    },
    options,
  );
  return { ...result, messages: result.items };
}

function messageDirection(raw, { managerIds = [] } = {}) {
  const personType = typeof raw?.personType === "string" ? raw.personType.toLowerCase() : "";
  if (["user", "customer", "visitor", "contact"].includes(personType)) return "in";
  if (["manager", "operator", "bot", "automation", "admin"].includes(personType)) return "out";
  if (raw?.personId && managerIds.includes(raw.personId)) return "out";
  throw new TypeError("Channel Talk message has an unsupported personType");
}

function messageAuthorRole(raw) {
  const personType = typeof raw?.personType === "string" ? raw.personType.toLowerCase() : "";
  if (["user", "customer", "visitor", "contact"].includes(personType)) return "customer";
  if (["manager", "operator", "admin"].includes(personType)) return "agent";
  if (["bot", "automation"].includes(personType)) return "automation";
  return null;
}

function messageDisposition(raw, { bodyText, attachments } = {}) {
  const authorRole = messageAuthorRole(raw);
  if (!authorRole) {
    const personType = typeof raw?.personType === "string" ? raw.personType.toLowerCase() : "unknown";
    return `skip_${personType}`;
  }
  const text = typeof bodyText === "string"
    ? bodyText.trim()
    : (typeof raw?.plainText === "string" ? raw.plainText.trim() : blocksToText(raw?.blocks));
  const files = Array.isArray(attachments) ? attachments : (Array.isArray(raw?.files) ? raw.files : []);
  return text || files.length > 0 ? "accepted" : "skip_empty";
}

function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return "";
    const own = typeof block.value === "string" ? block.value : "";
    const nested = blocksToText(block.blocks);
    return [own, nested].filter(Boolean).join("\n");
  }).filter(Boolean).join("\n").trim();
}

function timestampToIso(value) {
  const numeric = Number(value);
  const milliseconds = numeric > 100000000000000
    ? numeric / 1000 // Channel Talk uses microseconds for some since cursors.
    : numeric > 100000000000
      ? numeric
      : numeric * 1000;
  const date = Number.isFinite(numeric)
    ? new Date(milliseconds)
    : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Channel Talk message has no valid createdAt");
  return date.toISOString();
}

function userIdentity(user, fallbackId) {
  const id = user?.id || user?.userId || fallbackId;
  const email = user?.email || user?.profile?.email;
  if (typeof email === "string" && email.trim()) {
    return {
      from: email.trim().toLowerCase(),
      fromName: user?.name || user?.profile?.name || "",
      userId: id || "",
    };
  }
  return {
    from: id ? `channel:user:${id}` : "channel:user:unknown",
    fromName: user?.name || user?.profile?.name || "",
    userId: id || "",
  };
}

function normalizeMessage(raw, {
  account,
  user,
  userId,
  userChatId,
  managerIds = [],
  channel = "channeltalk",
} = {}) {
  if (!raw || typeof raw.id !== "string" || !raw.id) {
    throw new TypeError("Channel Talk message id is required");
  }
  if (typeof account !== "string" || !account.trim()) {
    throw new TypeError("Channel Talk source account is required");
  }
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("Channel Talk customer userId is required");
  }
  const sourceAccount = account.trim().toLowerCase();
  const identity = userIdentity(user, userId);
  const attachments = (Array.isArray(raw.files) ? raw.files : []).filter((file) => file && file.id).map((file) => ({
    filename: file.name || file.filename || file.id,
    mimeType: file.type || file.mimeType || "application/octet-stream",
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : 0,
    attachmentId: file.id,
  }));
  const plainText = typeof raw.plainText === "string" ? raw.plainText.trim() : "";
  const bodyText = plainText || blocksToText(raw.blocks);
  const disposition = messageDisposition(raw, { bodyText, attachments });
  if (disposition !== "accepted") return null;
  const direction = messageDirection(raw, { managerIds });
  const authorRole = messageAuthorRole(raw);
  const providerThreadId = userChatId;
  if (typeof providerThreadId !== "string" || !providerThreadId) {
    throw new TypeError("Channel Talk user-chat id is required");
  }
  const from = direction === "in" ? identity.from : sourceAccount;
  const fromName = direction === "in" ? identity.fromName : "";
  const to = direction === "in" ? [sourceAccount] : [identity.from];

  return {
    docId: `${channel}:${sourceAccount}:${raw.id}`,
    channel,
    side: "unknown",
    sideSource: "account_rule",
    sourceAccount,
    externalId: raw.id,
    providerThreadId,
    threadKey: `${channel}:${sourceAccount}:${providerThreadId}`,
    historyId: String(raw.version ?? raw.updatedAt ?? raw.id),
    direction,
    authorRole,
    from,
    fromName,
    ...(userId || identity.userId ? { channelTalkUserId: userId || identity.userId } : {}),
    to,
    // UserChat messages have no documented subject property.
    subject: "",
    bodyText,
    attachments,
    sentAt: timestampToIso(raw.createdAt),
  };
}

async function sendChatMessage(userChatId, { plainText, blocks } = {}, credentials, options = {}) {
  if (typeof userChatId !== "string" || !userChatId.trim()) {
    throw new TypeError("Channel Talk userChatId is required");
  }
  const text = typeof plainText === "string" ? plainText.trim() : "";
  if (!text) {
    throw new TypeError("Channel Talk message plainText is required");
  }
  const baseUrl = options.baseUrl || CHANNEL_TALK_BASE;
  const url = `${baseUrl}/user-chats/${encodeURIComponent(userChatId.trim())}/messages`;
  const fetchImpl = options.fetchImpl || global.fetch;
  const body = {
    plainText: text,
    blocks: Array.isArray(blocks) ? blocks : [{ type: "text", value: text }],
  };
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      ...headers(credentials),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ChannelTalkRequestError(`Channel Talk send failed (${response.status}): ${errorText}`, {
      status: response.status,
      url,
      code: "CHANNEL_TALK_SEND_FAILED",
    });
  }
  const json = await response.json();
  return json.message || json;
}

module.exports = {
  CHANNEL_TALK_BASE,
  ChannelTalkRequestError,
  headers,
  listUserChatsPage,
  listChatMessagesPage,
  getChannelTalkUser,
  listAllUserChats,
  listAllChatMessages,
  collectPages,
  messageDirection,
  messageAuthorRole,
  messageDisposition,
  blocksToText,
  normalizeMessage,
  sendChatMessage,
  timestampToIso,
};
