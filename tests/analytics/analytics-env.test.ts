// 환경별 GA4·Meta ID 선택(fail-closed) 회귀 테스트. ID는 형식만 맞춘 가짜 값이다.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { resolveAnalyticsIds, isAnalyticsHost } = await import("../../src/lib/analytics/analytics-env.ts");

const PROD = { NEXT_PUBLIC_GA_ID: "G-PROD000001", NEXT_PUBLIC_META_PIXEL_ID: "1000000000000001" };
const DEV = { NEXT_PUBLIC_GA_DEV_ID: "G-DEV0000001", NEXT_PUBLIC_META_PIXEL_DEV_ID: "2000000000000002" };
const BOTH = { ...PROD, ...DEV };

test("Vercel Production uses only the production IDs", () => {
  assert.deepEqual(resolveAnalyticsIds({ VERCEL_ENV: "production", ...BOTH }), {
    tier: "production",
    gaId: "G-PROD000001",
    metaPixelId: "1000000000000001",
  });
  assert.deepEqual(resolveAnalyticsIds({ VERCEL_ENV: "production", ...PROD }), {
    tier: "production",
    gaId: "G-PROD000001",
    metaPixelId: "1000000000000001",
  });
});

test("Preview, staging, Vercel development and local builds use only the dev IDs", () => {
  for (const VERCEL_ENV of ["preview", "development", undefined, "staging", ""]) {
    assert.deepEqual(resolveAnalyticsIds({ VERCEL_ENV, ...BOTH }), {
      tier: "development",
      gaId: "G-DEV0000001",
      metaPixelId: "2000000000000002",
    }, String(VERCEL_ENV));
  }
});

test("no fallback: a missing dev ID turns tracking off even when production IDs are present", () => {
  assert.deepEqual(resolveAnalyticsIds({ VERCEL_ENV: "preview", ...PROD }), {
    tier: "development",
    gaId: undefined,
    metaPixelId: undefined,
  });
  assert.deepEqual(resolveAnalyticsIds({}), { tier: "development", gaId: undefined, metaPixelId: undefined });
});

test("no fallback: a missing production ID turns production tracking off", () => {
  assert.deepEqual(resolveAnalyticsIds({ VERCEL_ENV: "production", ...DEV }), {
    tier: "production",
    gaId: undefined,
    metaPixelId: undefined,
  });
});

test("a production ID placed in the dev variable is blocked outside production", () => {
  const ids = resolveAnalyticsIds({
    VERCEL_ENV: "preview",
    ...PROD,
    NEXT_PUBLIC_GA_DEV_ID: PROD.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_META_PIXEL_DEV_ID: ` ${PROD.NEXT_PUBLIC_META_PIXEL_ID} `,
  });
  assert.equal(ids.gaId, undefined);
  assert.equal(ids.metaPixelId, undefined);
});

test("a dev ID placed in the production variable is blocked in production", () => {
  const ids = resolveAnalyticsIds({
    VERCEL_ENV: "production",
    ...DEV,
    NEXT_PUBLIC_GA_ID: DEV.NEXT_PUBLIC_GA_DEV_ID,
    NEXT_PUBLIC_META_PIXEL_ID: DEV.NEXT_PUBLIC_META_PIXEL_DEV_ID,
  });
  assert.equal(ids.gaId, undefined);
  assert.equal(ids.metaPixelId, undefined);
});

test("malformed IDs are rejected (and can never break out of the inline init script)", () => {
  for (const bad of ["", "  ", "UA-123456-1", "G-abc", "G-PROD000001');alert(1);//", "123", "12345678901234567890123", "1000000000000001x"]) {
    const ids = resolveAnalyticsIds({ VERCEL_ENV: "preview", NEXT_PUBLIC_GA_DEV_ID: bad, NEXT_PUBLIC_META_PIXEL_DEV_ID: bad });
    assert.equal(ids.gaId, undefined, bad);
    assert.equal(ids.metaPixelId, undefined, bad);
  }
});

test("the build tier must match the visited host", () => {
  for (const host of ["www.medidakos.com", "medidakos.com"]) {
    assert.equal(isAnalyticsHost("production", host), true, host);
    assert.equal(isAnalyticsHost("development", host), false, host);
  }
  for (const host of ["localhost", "127.0.0.1", "dev.medidakos.com", "medi-da-kos-git-dev-team.vercel.app", "medi-da-kos.vercel.app"]) {
    assert.equal(isAnalyticsHost("development", host), true, host);
    assert.equal(isAnalyticsHost("production", host), false, host);
  }
});
