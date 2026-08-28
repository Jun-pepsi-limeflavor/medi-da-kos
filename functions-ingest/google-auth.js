/* eslint-disable @typescript-eslint/no-require-imports */
const { GoogleAuth } = require("google-auth-library");

const SA = process.env.INGEST_SERVICE_ACCOUNT
  || "mail-ingest@medidakos.iam.gserviceaccount.com";
const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

// Keep this list in one place. It is deliberately an allowlist, rather than
// accepting an arbitrary subject from a request or environment variable.
const DEFAULT_GMAIL_MAILBOXES = Object.freeze([
  { account: "thomas@medidakoslabs.com", channel: "gmail_thomas", enabled: true },
  { account: "hally@medidakoslabs.com", channel: "gmail_hally", enabled: true },
  { account: "rheekw@techasset.co.kr", channel: "gmail_rheekw", enabled: false },
  { account: "songjh@techasset.co.kr", channel: "gmail_songjh", enabled: false },
  { account: "kimhs@techasset.co.kr", channel: "gmail_kimhs", enabled: false },
  { account: "parkjy@techasset.co.kr", channel: "gmail_parkjy", enabled: false },
].map((mailbox) => Object.freeze({ ...mailbox })));

const mailboxByAccount = new Map(
  DEFAULT_GMAIL_MAILBOXES.map((mailbox) => [mailbox.account, mailbox]),
);

function normalizeMailbox(account) {
  if (typeof account !== "string") throw new Error("Gmail mailbox must be a string");
  const normalized = account.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized)) {
    throw new Error("Gmail mailbox is invalid");
  }
  return normalized;
}

/**
 * Return only the scopes this service is approved to request. A caller may
 * ask for a purpose (read/send), or pass the exact approved OAuth scopes.
 * Arbitrary scope strings are rejected so a route cannot turn this helper
 * into a general-purpose delegated token mint.
 */
function normalizeGmailScopes(options = {}) {
  const requested = typeof options === "string"
    ? options
    : options.scope ?? options.scopes ?? options.purpose;
  if (requested == null) return [GMAIL_READ_SCOPE];

  const values = Array.isArray(requested) ? requested : [requested];
  const scopes = new Set();
  for (const value of values) {
    if (value === "read" || value === GMAIL_READ_SCOPE) scopes.add(GMAIL_READ_SCOPE);
    else if (value === "send" || value === GMAIL_SEND_SCOPE) scopes.add(GMAIL_SEND_SCOPE);
    else if (value === "readwrite") {
      scopes.add(GMAIL_READ_SCOPE);
      scopes.add(GMAIL_SEND_SCOPE);
    } else {
      throw new Error("Unsupported Gmail OAuth scope");
    }
  }
  if (scopes.size === 0) throw new Error("At least one Gmail OAuth scope is required");
  return [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE].filter((scope) => scopes.has(scope));
}

function normalizeMailboxConfig(mailboxes = DEFAULT_GMAIL_MAILBOXES) {
  if (!Array.isArray(mailboxes) || mailboxes.length === 0) {
    throw new Error("Gmail mailbox configuration must be a non-empty array");
  }
  const seen = new Set();
  return mailboxes.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid Gmail mailbox configuration");
    const account = normalizeMailbox(entry.account);
    if (seen.has(account)) throw new Error("Duplicate Gmail mailbox configuration");
    seen.add(account);
    const approved = mailboxByAccount.get(account);
    if (!approved) throw new Error(`Gmail mailbox is not approved: ${account}`);
    if (entry.channel !== approved.channel) throw new Error(`Gmail channel does not match mailbox: ${account}`);
    return Object.freeze({
      account,
      channel: approved.channel,
      enabled: (entry.enabled ?? approved.enabled) === true && approved.enabled === true,
    });
  });
}

function getApprovedMailbox(account) {
  return mailboxByAccount.get(normalizeMailbox(account)) || null;
}

// 토큰은 1시간 유효하다. 5분마다 도는 함수가 매번 두 번씩 왕복할 이유가 없다.
const cache = new Map();  // subject -> { token, expiresAt }

async function getGmailToken(subject, options = {}) {
  const account = normalizeMailbox(subject);
  const scopes = normalizeGmailScopes(options);
  const mailbox = getApprovedMailbox(account);
  if (!mailbox) throw new Error(`Gmail mailbox is not approved: ${account}`);
  if (mailbox.enabled !== true && options.allowUnverified !== true) {
    throw new Error(`Gmail mailbox delegation is not verified: ${account}`);
  }

  const cacheKey = `${account}|${scopes.join(" ")}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const now = Math.floor(Date.now() / 1000);
  const signed = await client.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA}:signJwt`,
    method: "POST",
    data: {
      payload: JSON.stringify({
        iss: SA,
        sub: account,
        scope: scopes.join(" "),
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    },
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signed.data.signedJwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    const reason = typeof json.error === "string" ? json.error : "unknown_error";
    throw new Error(`토큰 교환 실패 (${account}): ${reason}`);
  }

  cache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

module.exports = {
  DEFAULT_GMAIL_MAILBOXES,
  GMAIL_READ_SCOPE,
  GMAIL_SEND_SCOPE,
  getApprovedMailbox,
  getGmailToken,
  normalizeGmailScopes,
  normalizeMailbox,
  normalizeMailboxConfig,
};
