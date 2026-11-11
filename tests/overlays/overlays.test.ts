// 오버레이 정책 테스트: 쿠키 동의 기록(6개월 만료·정책 버전·형식 검증), Promotion 팝업 새 방문·자동 노출 판정, SNS 게시물 표시 보조 함수(모달 비율 포함).
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const consent = await import("../../src/lib/cookie-consent/consent.ts");
const visit = await import("../../src/lib/promo/visit.ts");
const social = await import("../../src/lib/social/types.ts");

const NOW = new Date("2026-11-11T09:00:00Z");

test("a saved choice is kept for 6 months, then the visitor is asked again", () => {
  const saved = consent.createConsent(consent.ALL_ACCEPTED, NOW);
  assert.equal(saved.version, consent.POLICY_VERSION);
  assert.equal(saved.expiresAt, "2027-05-11T09:00:00.000Z");
  assert.deepEqual(Object.keys(saved).sort(), ["analytics", "expiresAt", "functional", "marketing", "savedAt", "version"]);
  const raw = JSON.stringify(saved);
  assert.deepEqual(consent.parseConsent(raw, Date.parse("2027-05-11T08:59:59Z")), saved);
  assert.equal(consent.parseConsent(raw, Date.parse("2027-05-11T09:00:00Z")), null);
});

test("6 months later clamps to the month's last day", () => {
  assert.equal(consent.addMonths(new Date("2026-08-31T00:00:00Z"), 6).toISOString(), "2027-02-28T00:00:00.000Z");
});

test("an outdated policy version or a malformed record counts as no choice", () => {
  const saved = consent.createConsent(consent.ALL_REJECTED, NOW);
  const now = NOW.getTime();
  assert.equal(consent.parseConsent(JSON.stringify({ ...saved, version: consent.POLICY_VERSION + 1 }), now), null);
  assert.equal(consent.parseConsent(JSON.stringify({ ...saved, version: consent.POLICY_VERSION - 1 }), now), null);
  assert.equal(consent.parseConsent(JSON.stringify({ ...saved, analytics: "yes" }), now), null);
  assert.equal(consent.parseConsent("not json", now), null);
  assert.equal(consent.parseConsent(null, now), null);
});

test("a new visit: no activity in this tab, or 30+ minutes idle and coming from outside", () => {
  const now = NOW.getTime();
  assert.equal(visit.isNewVisit({ lastActivity: null, now, sameOriginReferrer: true }), true);
  assert.equal(visit.isNewVisit({ lastActivity: now - 29 * 60_000, now, sameOriginReferrer: false }), false);
  assert.equal(visit.isNewVisit({ lastActivity: now - 30 * 60_000, now, sameOriginReferrer: false }), true);
  assert.equal(visit.isNewVisit({ lastActivity: now - 60 * 60_000, now, sameOriginReferrer: true }), false);
});

test("the promotion popup opens only for a new visit that starts on Home, once", () => {
  const base = { visit: { id: "1", isNew: true, landingPath: "/" }, pathname: "/", promoActive: true, barClicked: false, seenVisitId: null, isBot: false };
  assert.equal(visit.shouldAutoOpenPromo(base), true);
  assert.equal(visit.shouldAutoOpenPromo({ ...base, seenVisitId: "1" }), false, "already shown this visit");
  assert.equal(visit.shouldAutoOpenPromo({ ...base, seenVisitId: "0" }), true, "shown in an earlier visit");
  assert.equal(visit.shouldAutoOpenPromo({ ...base, visit: { ...base.visit, landingPath: "/contact" } }), false, "visit started elsewhere");
  assert.equal(visit.shouldAutoOpenPromo({ ...base, visit: { ...base.visit, isNew: false } }), false, "reload / internal return");
  assert.equal(visit.shouldAutoOpenPromo({ ...base, barClicked: true }), false, "announcement bar clicked");
  assert.equal(visit.shouldAutoOpenPromo({ ...base, promoActive: false }), false, "promotion ended");
  assert.equal(visit.shouldAutoOpenPromo({ ...base, isBot: true }), false, "bot");
});

test("social posts: kind follows the media items, dates are shown in English", () => {
  const image = { type: "image" as const, src: "a.jpg", alt: "", width: 1, height: 1 };
  const video = { type: "video" as const, src: "a.mp4", width: 1, height: 1 };
  assert.equal(social.socialPostKind({ media: [image, image] }), "post");
  assert.equal(social.socialPostKind({ media: [image, video] }), "video");
  assert.equal(social.formatSocialDate("2026-11-03T23:30:00Z"), "November 3, 2026");
  assert.equal(social.formatSocialDate("bad"), "");
  assert.equal(social.socialPostKey({ platform: "tiktok", id: "7" }), "tiktok-7");
});

test("social modal ratio: first media item, clamped to 9:16–16:9", () => {
  const item = (width: number, height: number) => ({ type: "image" as const, src: "a.jpg", alt: "", width, height });
  assert.equal(social.socialPostRatio({ media: [item(1080, 1080)] }), 1);
  assert.equal(social.socialPostRatio({ media: [item(1080, 1350)] }), 0.8);
  assert.equal(social.socialPostRatio({ media: [item(540, 960), item(1600, 900)] }), 9 / 16, "carousel keeps the first item's ratio");
  assert.equal(social.socialPostRatio({ media: [item(300, 1000)] }), 9 / 16, "taller than 9:16 is clamped");
  assert.equal(social.socialPostRatio({ media: [item(3000, 1000)] }), 16 / 9, "wider than 16:9 is clamped");
  assert.equal(social.socialPostRatio({ media: [] }), 1);
});
