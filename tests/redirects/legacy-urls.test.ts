// 이전 사이트 URL 리디렉션 테스트(next.config.ts redirects()): 대상·상태 코드 고정, 연속 리디렉션·루프 방지, 현재 페이지 보호.
// 실제 요청 동작(쿼리 유지·최종 200)은 개발 서버에서 curl로 확인한다.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { default: nextConfig } = await import("../../next.config.ts");
const { ROUTES } = await import("../../src/lib/config/routes.ts");

type Redirect = { source: string; destination: string; permanent: boolean };
const redirects = (await nextConfig.redirects!()) as Redirect[];

// [source, destination, permanent] — 페이지가 실제로 있었던 URL만(origin/main·Git 이력 기준).
const EXPECTED: Array<[string, string, boolean]> = [
  ["/business", "/about-us", true],
  ["/process", "/services#how-it-works", true],
  ["/how-it-works", "/services#how-it-works", true],
  ["/landing/catalog", "/portfolio", true],
  ["/compare", "/services", true],
  ["/pricing", "/services", true],
  ["/dashboard/:path*", "/contact", false],
  ["/korea", "/portfolio", true],
  ["/landing/korea", "/portfolio", true],
  ["/landing/dashboard", "/portfolio", true],
];

/** Next.js path matching for the patterns used here: literal paths and a trailing `:path*`; case-insensitive. */
function matches(source: string, pathname: string): boolean {
  const pattern = source.endsWith("/:path*")
    ? `^${source.slice(0, -"/:path*".length)}(?:/.*)?$`
    : `^${source}$`;
  return new RegExp(pattern, "i").test(pathname);
}

const pathOf = (destination: string) => destination.split(/[?#]/)[0];

test("legacy URLs map to the agreed destination and status (308 permanent / 307 temporary)", () => {
  assert.deepEqual(
    redirects.map((r) => [r.source, r.destination, r.permanent]),
    EXPECTED,
  );
});

test("every redirect lands in one hop: no destination is itself a redirect source (no chains or loops)", () => {
  for (const r of redirects) {
    const hit = redirects.find((other) => matches(other.source, pathOf(r.destination)));
    assert.equal(hit, undefined, `${r.source} → ${r.destination} is redirected again by ${hit?.source}`);
  }
});

test("every destination is a current public page", () => {
  const pages = new Set<string>(Object.values(ROUTES));
  for (const r of redirects) assert.ok(pages.has(pathOf(r.destination)), `${r.destination} is not a current page`);
});

test("current pages and API routes are never redirected", () => {
  const live = [...Object.values(ROUTES), "/api/channel-talk/member-hash", "/api/kakaowork/callback", "/sitemap.xml", "/robots.txt"];
  for (const path of live) {
    const hit = redirects.find((r) => matches(r.source, path));
    assert.equal(hit, undefined, `${path} is caught by ${hit?.source}`);
  }
});

test("no catch-all: unknown URLs stay 404 instead of being sent to Home", () => {
  for (const r of redirects) {
    assert.notEqual(pathOf(r.destination), ROUTES.home, `${r.source} sends to Home`);
    assert.ok(!/^\/:[a-z]+[*+]?$/i.test(r.source), `${r.source} matches every URL`);
  }
  for (const path of ["/landing", "/landing/unknown", "/catalog", "/does-not-exist", "/dashboardx"]) {
    assert.equal(redirects.find((r) => matches(r.source, path)), undefined, `${path} should stay 404`);
  }
});

test("removed admin and test pages stay 404 (no public redirect)", () => {
  for (const path of ["/admin", "/admin/login", "/admin/deals", "/test"]) {
    assert.equal(redirects.find((r) => matches(r.source, path)), undefined, `${path} should stay 404`);
  }
});
