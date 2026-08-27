import "server-only";
import { createSign } from "crypto";

// Same env var name/default as functions-ingest/google-auth.js's INGEST_SERVICE_ACCOUNT,
// so the two codebases agree on which SA is registered for domain-wide delegation —
// even though each reads it from its own env file.
const INGEST_SERVICE_ACCOUNT =
  process.env.INGEST_SERVICE_ACCOUNT || "mail-ingest@medidakos.iam.gserviceaccount.com";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const signJwtEndpoint = (sa: string) =>
  `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${sa}:signJwt`;

// ponytail: token cache per-subject in-memory Map, swap for a shared cache (Redis)
// if multiple Vercel instances hammering the token endpoint separately becomes a problem.
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

/** Exchange a signed JWT assertion for an OAuth access token (RFC 7523 jwt-bearer grant). */
async function exchangeJwtForToken(
  jwt: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(json)}`);
  }
  return {
    accessToken: json.access_token as string,
    expiresIn: (json.expires_in as number) ?? 3600,
  };
}

/** Self-sign a JWT with `privateKey` (RFC 7515) and exchange it for an access token. */
async function selfSignAndExchange(params: {
  iss: string;
  sub: string;
  scope: string;
  privateKey: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: params.iss,
      sub: params.sub,
      scope: params.scope,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(params.privateKey, "base64url");

  return exchangeJwtForToken(`${signingInput}.${signature}`);
}

/**
 * Gmail access token for `subject`'s mailbox, via domain-wide delegation.
 *
 * `mail-ingest@medidakos.iam.gserviceaccount.com` is the identity registered for
 * delegation in the Workspace admin console — it has no key file (see
 * functions-ingest/google-auth.js). On Vercel there's no ambient GCP credential to
 * call the IAM Credentials API as that identity directly, so this chains through the
 * Firebase Admin SA (which does have a key, via FIREBASE_SERVICE_ACCOUNT_B64):
 *
 *   1. Self-sign a JWT as the Firebase Admin SA itself, exchange it for a
 *      cloud-platform-scoped access token.
 *   2. Use that token to call iamcredentials.googleapis.com:signJwt, asking it to
 *      sign a domain-delegation JWT *as* mail-ingest impersonating `subject`.
 *      Requires the Firebase Admin SA to hold roles/iam.serviceAccountTokenCreator
 *      on mail-ingest — a human IAM grant, not something this code can set up.
 *   3. Exchange that IAM-signed JWT for the actual Gmail-scoped access token.
 */
export async function getGmailToken(subject: string): Promise<string> {
  const cached = tokenCache.get(subject);
  // Keep 60s buffer before expiry
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const sa = getServiceAccount();

  // Hop 1: Firebase Admin SA's own cloud-platform token.
  const { accessToken: cloudPlatformToken } = await selfSignAndExchange({
    iss: sa.client_email,
    sub: sa.client_email,
    scope: CLOUD_PLATFORM_SCOPE,
    privateKey: sa.private_key,
  });

  // Hop 2: ask IAM Credentials API to sign a delegation JWT as mail-ingest.
  const now = Math.floor(Date.now() / 1000);
  const signJwtRes = await fetch(signJwtEndpoint(INGEST_SERVICE_ACCOUNT), {
    method: "POST",
    headers: {
      authorization: `Bearer ${cloudPlatformToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      payload: JSON.stringify({
        iss: INGEST_SERVICE_ACCOUNT,
        sub: subject,
        scope: GMAIL_SCOPE,
        aud: TOKEN_ENDPOINT,
        iat: now,
        exp: now + 3600,
      }),
    }),
  });
  const signJwtJson = (await signJwtRes.json()) as Record<string, unknown>;
  if (!signJwtRes.ok || !signJwtJson.signedJwt) {
    throw new Error(
      `IAM signJwt failed for ${INGEST_SERVICE_ACCOUNT} (subject ${subject}): ${JSON.stringify(signJwtJson)}`,
    );
  }

  // Hop 3: exchange the IAM-signed JWT for the real Gmail-scoped access token.
  const { accessToken, expiresIn } = await exchangeJwtForToken(
    signJwtJson.signedJwt as string,
  );

  tokenCache.set(subject, { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 });
  return accessToken;
}
