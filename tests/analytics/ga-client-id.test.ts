// Contact의 GA client id 조회: 이 페이지에 실제로 로드된 GA4 ID(analytics-env.ts)만 쓰고, GA가 꺼져 있으면 조회하지 않는다.
// Analytics 동의가 있어야 조회한다(2026-11-23) — 여기서는 동의한 상태로 두고, 동의 없음은 consent-enforcement.test.ts에서 본다.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { setActiveGaId } = await import("../../src/lib/analytics/analytics-env.ts");
const { getActiveGaClientId } = await import("../../src/lib/analytics/ga-client-id.ts");

async function lookup(activeGaId: string | null) {
  const gets: unknown[][] = [];
  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  globalScope.window = {
    gtag: (...args: unknown[]) => {
      gets.push(args.slice(0, 3));
      (args[3] as (id: string) => void)("123.456");
    },
    setTimeout: () => 0,
    // Analytics consent (policy version 2) so the lookup itself is what is tested here.
    localStorage: {
      getItem: (key: string) =>
        key === "mdk:cookie-consent"
          ? JSON.stringify({ version: 2, analytics: true, marketing: false, savedAt: "2026-11-23T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" })
          : null,
    },
  };
  setActiveGaId(activeGaId);
  try {
    return { clientId: await getActiveGaClientId(), gets };
  } finally {
    setActiveGaId(null);
    globalScope.window = previous;
  }
}

test("GA off (no ID, invalid ID or environment mismatch): null, no lookup even if gtag exists", async () => {
  assert.deepEqual(await lookup(null), { clientId: null, gets: [] });
});

test("looks up the client id with the GA4 ID loaded for this environment only", async () => {
  for (const id of ["G-DEV0000001", "G-PROD000001"]) {
    assert.deepEqual(await lookup(id), { clientId: "123.456", gets: [["get", id, "client_id"]] }, id);
  }
});
