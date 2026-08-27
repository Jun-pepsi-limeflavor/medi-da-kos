const { GoogleAuth } = require("google-auth-library");

const SA = process.env.INGEST_SERVICE_ACCOUNT
  || "mail-ingest@medidakos.iam.gserviceaccount.com";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// 토큰은 1시간 유효하다. 5분마다 도는 함수가 매번 두 번씩 왕복할 이유가 없다.
const cache = new Map();  // subject -> { token, expiresAt }

async function getGmailToken(subject) {
  const hit = cache.get(subject);
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
        sub: subject,
        scope: SCOPE,
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
    throw new Error(`토큰 교환 실패 (${subject}): ${JSON.stringify(json)}`);
  }

  cache.set(subject, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

module.exports = { getGmailToken };
