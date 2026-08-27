import "server-only";
import { createSign } from "crypto";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// ponytail: token cache per-request, swap for per-account cache if throughput matters
interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  }
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64-encoded JSON");
  }
}

export async function getGmailToken(subject: string): Promise<string> {
  const cacheKey = subject;
  const cached = tokenCache.get(cacheKey);
  // Keep 60s buffer before expiry
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  // Create JWT for domain-wide delegation
  const payload = {
    iss: sa.client_email,
    sub: subject,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  // Sign JWT using the service account's private key
  const signer = createSign("RSA-SHA256");
  signer.update(JSON.stringify(payload));
  const signature = signer.sign(sa.private_key, "base64");

  // Construct JWT: header.payload.signature
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const jwt = `${header}.${payloadB64}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!json.access_token) {
    throw new Error(`Gmail token exchange failed (${subject}): ${JSON.stringify(json)}`);
  }

  const token = json.access_token as string;
  const expiresIn = (json.expires_in as number) ?? 3600;
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return token;
}
