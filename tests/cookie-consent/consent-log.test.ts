// 쿠키 동의 서버 증빙(handleConsentLog): 입력 검증, 정책·고지 해시 불일치, 출처(Origin) 확인, fail-closed 프로젝트 확인,
// 중복 eventId, 저장 문서 모양(개인정보 없음·6개월/18개월 만료).
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const log = await import("../../src/lib/cookie-consent/consent-log.ts");
const { POLICY_VERSION } = await import("../../src/lib/cookie-consent/consent.ts");
const { NOTICE_HASH } = await import("../../src/lib/cookie-consent/notice.ts");

const NOW = new Date("2026-11-24T03:00:00.000Z");
const event = {
  eventId: "6f1c1f52-6a7b-4c1e-8f3a-2d9b8c7e6a51",
  consentId: "0b6f2d64-3f1a-4c5e-9d2b-7a1e5c3b9f00",
  action: "consent",
  analytics: true,
  marketing: false,
  policyVersion: POLICY_VERSION,
  noticeHash: NOTICE_HASH,
  source: "banner",
  clientSavedAt: "2026-11-24T02:59:59.000Z",
};

function run(overrides: Partial<Parameters<typeof log.handleConsentLog>[0]> & { body?: unknown } = {}) {
  const writes: { id: string; doc: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  const logs: { message: string; detail: object }[] = [];
  const { body = event, ...rest } = overrides;
  const promise = log.handleConsentLog({
    rawBody: typeof body === "string" ? body : JSON.stringify(body),
    origin: "https://dev.medidakos.com",
    host: "dev.medidakos.com",
    secGpc: null,
    env: { vercelEnv: "preview", clientProjectId: "dev-medidakos-b9b4f", deploymentSha: "abc123" },
    adminProjectId: () => "dev-medidakos-b9b4f",
    create: async (id, doc) => {
      if (seen.has(id)) return "exists";
      seen.add(id);
      writes.push({ id, doc: doc as unknown as Record<string, unknown> });
      return "created";
    },
    now: NOW,
    log: (message, detail) => logs.push({ message, detail }),
    ...rest,
  });
  return { promise, writes, logs };
}

test("a valid event is stored once under its eventId with server-side times and no personal data", async () => {
  const { promise, writes } = run({ secGpc: "1" });
  assert.deepEqual(await promise, { status: 201, body: { ok: true } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, event.eventId);
  const doc = writes[0].doc;
  assert.deepEqual(Object.keys(doc).sort(), [
    "action", "analytics", "clientSavedAt", "consentExpiresAt", "consentId", "deleteAt", "deploymentSha",
    "environment", "gpc", "marketing", "noticeHash", "policyVersion", "source",
  ]);
  assert.equal(doc.gpc, true, "GPC comes from the Sec-GPC header");
  assert.equal(doc.environment, "preview");
  assert.equal(doc.deploymentSha, "abc123");
  assert.equal((doc.consentExpiresAt as Date).toISOString(), "2027-05-24T03:00:00.000Z", "choice valid 6 months");
  assert.equal((doc.deleteAt as Date).toISOString(), "2028-05-24T03:00:00.000Z", "evidence kept 18 months");
  for (const field of ["uid", "email", "gaClientId", "ip", "userAgent", "name"]) assert.ok(!(field in doc), field);
});

test("the same eventId sent again is a duplicate success, not a second record", async () => {
  const seen = new Set<string>();
  const create = async (id: string) => (seen.has(id) ? "exists" : (seen.add(id), "created")) as "created" | "exists";
  assert.equal((await run({ create }).promise).status, 201);
  assert.deepEqual(await run({ create }).promise, { status: 200, body: { ok: true, duplicate: true } });
});

test("Firebase project must match the environment: admin, client and expected all equal (fail-closed)", async () => {
  const cases: [string | undefined, string | null, string, number][] = [
    ["production", "medidakos", "medidakos", 201],
    ["preview", "dev-medidakos-b9b4f", "dev-medidakos-b9b4f", 201],
    [undefined, "dev-medidakos-b9b4f", "dev-medidakos-b9b4f", 201], // local
    ["preview", "medidakos", "dev-medidakos-b9b4f", 503], // staging/Preview with a production key
    ["production", "dev-medidakos-b9b4f", "dev-medidakos-b9b4f", 503], // both dev in production
    ["preview", "medidakos", "medidakos", 503], // both production outside production
    ["production", "medidakos", "dev-medidakos-b9b4f", 503],
    ["preview", null, "dev-medidakos-b9b4f", 503], // no service account
  ];
  for (const [vercelEnv, admin, client, status] of cases) {
    const { promise, writes, logs } = run({ env: { vercelEnv, clientProjectId: client }, adminProjectId: () => admin });
    const result = await promise;
    assert.equal(result.status, status, `${vercelEnv} admin=${admin} client=${client}`);
    if (status === 503) assert.equal(writes.length, 0);
    const check = logs.find((l) => l.message.includes("project check"))?.detail as { ok: boolean; expected: string };
    assert.equal(check.ok, status === 201);
    assert.equal(check.expected, vercelEnv === "production" ? "medidakos" : "dev-medidakos-b9b4f");
    assert.ok(!JSON.stringify(logs).includes("private_key"), "no secret in logs");
  }
});

test("wording or policy version other than this deployment's → 409, nothing stored", async () => {
  for (const body of [{ ...event, noticeHash: "0".repeat(64) }, { ...event, policyVersion: POLICY_VERSION - 1 }]) {
    const { promise, writes } = run({ body });
    assert.equal((await promise).status, 409);
    assert.equal(writes.length, 0);
  }
});

test("malformed input is rejected before any project check or write", async () => {
  const bad: unknown[] = [
    "not json",
    [],
    { ...event, extra: "x" },
    { ...event, email: "a@b.c" },
    { ...event, eventId: "123" },
    { ...event, consentId: "0b6f2d64-3f1a-1c5e-9d2b-7a1e5c3b9f00" }, // not v4
    { ...event, action: "accept" },
    { ...event, source: "footer" },
    { ...event, analytics: "true" },
    { ...event, clientSavedAt: "yesterday" },
  ];
  for (const body of bad) {
    let checked = false;
    const { promise, writes } = run({ body, adminProjectId: () => ((checked = true), "dev-medidakos-b9b4f") });
    assert.equal((await promise).status, 400, JSON.stringify(body).slice(0, 60));
    assert.equal(writes.length, 0);
    assert.equal(checked, false);
  }
});

test("cross-origin or missing Origin → 403; oversized body → 413", async () => {
  assert.equal((await run({ origin: "https://evil.example" }).promise).status, 403);
  assert.equal((await run({ origin: null }).promise).status, 403);
  assert.equal((await run({ body: { ...event, clientSavedAt: "x".repeat(3000) } }).promise).status, 413);
});

test("a failed write is reported as 500 so the browser keeps the event and retries", async () => {
  const { promise } = run({ create: async () => { throw Object.assign(new Error("unavailable"), { code: 14 }); } });
  assert.equal((await promise).status, 500);
});
