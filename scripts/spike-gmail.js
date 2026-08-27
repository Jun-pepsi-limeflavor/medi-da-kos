/**
 * 임시 스크립트. 확인할 것 둘:
 *   1. 도메인 전체 위임으로 thomas@ 메일함이 읽히는가
 *   2. 응답이 실제로 어떻게 생겼는가
 * 답을 얻으면 지운다.
 */
const { GoogleAuth } = require("google-auth-library");

const SA = "mail-ingest@medidakos.iam.gserviceaccount.com";
const SUBJECT = process.argv[2] || "thomas@medidakoslabs.com";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

async function impersonatedToken(subject) {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SA,
    sub: subject,             // ← 가장할 사람. 도메인 전체 위임의 핵심
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // 키 파일 없이 IAM Credentials API 가 서명한다.
  const signed = await client.request({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA}:signJwt`,
    method: "POST",
    data: { payload: JSON.stringify(payload) },
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
    throw new Error("토큰 교환 실패: " + JSON.stringify(json));
  }
  return json.access_token;
}

async function main() {
  const token = await impersonatedToken(SUBJECT);
  console.log("✅ 가장 토큰 발급됨 —", SUBJECT);

  const H = { Authorization: `Bearer ${token}` };
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";

  const list = await (
    await fetch(`${base}/messages?maxResults=3&q=newer_than:30d`, { headers: H })
  ).json();
  console.log("✅ 목록 조회 —", list.resultSizeEstimate, "통 추정");

  if (!list.messages?.length) {
    console.log("최근 30일 메일이 없다. q 를 바꿔서 다시 본다.");
    return;
  }

  const full = await (
    await fetch(`${base}/messages/${list.messages[0].id}?format=full`, { headers: H })
  ).json();

  // ── 여기가 스파이크의 산출물이다. 계획 4·6 이 이 모양에 기댄다 ──
  console.log("\n=== 메시지 최상위 키 ===");
  console.log(Object.keys(full));
  console.log("\n=== payload 구조 ===");
  console.log({
    mimeType: full.payload?.mimeType,
    partCount: full.payload?.parts?.length ?? 0,
    partMimeTypes: (full.payload?.parts || []).map((p) => p.mimeType),
    headerNames: (full.payload?.headers || []).map((h) => h.name).slice(0, 20),
  });
  console.log("\n=== historyId / threadId ===");
  console.log({ historyId: full.historyId, threadId: full.threadId });

  const profile = await (await fetch(`${base}/profile`, { headers: H })).json();
  console.log("\n=== profile (증분 수집의 시작점) ===");
  console.log(profile);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
