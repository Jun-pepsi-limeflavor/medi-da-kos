// 공통 레이아웃 설정 테스트: Navbar 현재 메뉴 판정, Announcement Bar 표시 페이지, 프로모션 종료 시각.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { activeNavHref, showsAnnouncementBar } = await import("../../src/lib/config/routes.ts");
const { isYearEndPromoActive, YEAR_END_PROMO } = await import("../../src/lib/config/promo.ts");

test("active nav item follows the pathname, including nested paths", () => {
  assert.equal(activeNavHref("/about-us"), "/about-us");
  assert.equal(activeNavHref("/services"), "/services");
  assert.equal(activeNavHref("/portfolio"), "/portfolio");
  assert.equal(activeNavHref("/faq"), "/faq");
  assert.equal(activeNavHref("/portfolio/anything"), "/portfolio");
});

test("Home, Contact, policy and auth pages have no active nav item", () => {
  for (const path of ["/", "/contact", "/privacy-policy", "/terms-of-service", "/login", "/signup", "/portfolio-old"]) {
    assert.equal(activeNavHref(path), null, path);
  }
});

test("Announcement Bar shows only on Home, About Us, Services, Portfolio and FAQ", () => {
  for (const path of ["/", "/about-us", "/services", "/portfolio", "/faq"]) assert.ok(showsAnnouncementBar(path), path);
  for (const path of ["/contact", "/privacy-policy", "/terms-of-service", "/login", "/signup"]) assert.ok(!showsAnnouncementBar(path), path);
});

test("year-end promo ends after 2026-12-31 23:59 KST", () => {
  assert.equal(isYearEndPromoActive(Date.parse("2026-12-31T23:59:59+09:00")), true);
  assert.equal(isYearEndPromoActive(Date.parse("2027-01-01T00:00:00+09:00")), false);
  assert.equal(isYearEndPromoActive(Date.parse("2026-12-31T15:00:00Z")), false); // = 2027-01-01 00:00 KST
  assert.equal(YEAR_END_PROMO.code, "year-end-2026");
});
