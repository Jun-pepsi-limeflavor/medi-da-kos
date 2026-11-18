// 검색 노출 설정 테스트: 운영만 색인 허용(robots.txt·robots 메타), sitemap 8개 페이지, 로그인·회원가입 메타데이터.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const seo = await import("../../src/lib/config/seo.ts");
const { default: robots } = await import("../../src/app/robots.ts");
const { default: sitemap } = await import("../../src/app/sitemap.ts");

const PROD = "https://www.medidakos.com";
const NON_PRODUCTION = [undefined, "", "preview", "development", "staging", "Production", " production"];

function withVercelEnv<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env.VERCEL_ENV;
  if (value === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved;
  }
}

test("production deployment is indexable: robots.txt allows everything and lists the www sitemap", () => {
  const r = withVercelEnv("production", () => robots());
  assert.deepEqual(r, { rules: { userAgent: "*", allow: "/" }, sitemap: `${PROD}/sitemap.xml` });
  // No disallow at all — /login and /signup must stay crawlable so their noindex is seen.
  assert.equal(JSON.stringify(r).includes("disallow"), false);
});

test("production robots meta is index, follow (guards against an accidental site-wide noindex)", () => {
  const meta = seo.siteRobots({ VERCEL_ENV: "production" });
  assert.equal(meta && typeof meta === "object" && meta.index, true);
  assert.equal(meta && typeof meta === "object" && meta.follow, true);
});

test("every non-production deployment (staging, Preview, local, unset) is blocked and noindex", () => {
  for (const value of NON_PRODUCTION) {
    assert.deepEqual(withVercelEnv(value, () => robots()), { rules: { userAgent: "*", disallow: "/" } }, String(value));
    assert.deepEqual(seo.siteRobots({ VERCEL_ENV: value }), { index: false, follow: false }, String(value));
  }
});

test("staging custom environment value is not treated as production even with VERCEL_TARGET_ENV set", () => {
  assert.equal(seo.isIndexableDeployment({ VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "staging" }), false);
});

test("sitemap lists exactly the 8 public pages on the production www domain", () => {
  const urls = sitemap().map((e) => e.url);
  assert.deepEqual(urls, [
    PROD,
    `${PROD}/about-us`,
    `${PROD}/services`,
    `${PROD}/portfolio`,
    `${PROD}/faq`,
    `${PROD}/contact`,
    `${PROD}/privacy-policy`,
    `${PROD}/terms-of-service`,
  ]);
  for (const u of urls) {
    assert.doesNotMatch(u, /\/(login|signup|dashboard|korea|landing|compare|process|test)\b/, u);
    assert.doesNotMatch(u, /dev\.medidakos|vercel\.app|localhost/, u);
  }
});

test("sitemap does not depend on the deployment (same in every environment)", () => {
  assert.deepEqual(withVercelEnv("preview", () => sitemap()), withVercelEnv("production", () => sitemap()));
});

test("login and sign-up are noindex with their own canonical and no inherited Home description", () => {
  for (const [meta, path] of [[seo.LOGIN_METADATA, "/login"], [seo.SIGNUP_METADATA, "/signup"]] as const) {
    assert.deepEqual(meta.robots, { index: false, follow: false }, path);
    assert.equal(meta.alternates?.canonical, `${PROD}${path}`);
    assert.equal(meta.openGraph?.url, `${PROD}${path}`);
    assert.ok(meta.description && !/3,000|K-beauty line/.test(meta.description), path);
    assert.equal(meta.openGraph?.description, meta.description);
    assert.equal(meta.twitter?.description, meta.description);
  }
});
