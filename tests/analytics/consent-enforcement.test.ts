// 쿠키 동의 적용(P1) 테스트: 정책 버전 2·Functional 제거, GPC 우선, Google Consent Mode 신호, Channel Talk 추적 옵션,
// GA client id·UTM의 Analytics 동의 연결, 카테고리별 저장소 정리 범위.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()].sort();
  }
}

// Minimal browser globals: storage, location, a cookie jar that records deletions, and the GPC flag.
const local = new MemoryStorage();
const session = new MemoryStorage();
const jar = new Map<string, string>();
const cookieWrites: string[] = [];
let gpc = false;
Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: session, configurable: true });
Object.defineProperty(globalThis, "location", { value: { hostname: "www.medidakos.com", search: "" }, configurable: true, writable: true });
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      cookieWrites.push(value);
      const [pair] = value.split(";");
      const [name] = pair.split("=");
      if (/Max-Age=0/.test(value)) jar.delete(name.trim());
    },
  },
});
Object.defineProperty(globalThis.navigator, "globalPrivacyControl", { get: () => gpc, configurable: true });

const consent = await import("../../src/lib/cookie-consent/consent.ts");
const cleanup = await import("../../src/lib/cookie-consent/cleanup.ts");
const google = await import("../../src/lib/analytics/google-consent.ts");
const gaEnv = await import("../../src/lib/analytics/analytics-env.ts");
const gaClient = await import("../../src/lib/analytics/ga-client-id.ts");
const utm = await import("../../src/hooks/use-utm-params.ts");

const CONSENT_ID = "0b6f2d64-3f1a-4c5e-9d2b-7a1e5c3b9f00";
/** A choice the server has already confirmed (P2), so this file tests only the P1 enforcement. */
function choose(choices: { analytics: boolean; marketing: boolean }) {
  local.setItem(consent.CONSENT_STORAGE_KEY, JSON.stringify(consent.createConsent(choices, new Date(), { consentId: CONSENT_ID, confirmed: choices })));
}

test("policy version 2 has only Analytics and Marketing; a version-1 record (with functional) asks again", () => {
  assert.equal(consent.POLICY_VERSION, 2);
  assert.deepEqual(consent.OPTIONAL_COOKIE_CATEGORIES, ["analytics", "marketing"]);
  const v1 = { version: 1, consentId: CONSENT_ID, confirmed: { analytics: true, marketing: true }, analytics: true, marketing: true, functional: true, savedAt: new Date().toISOString(), expiresAt: "2099-01-01T00:00:00.000Z" };
  assert.equal(consent.parseConsent(JSON.stringify(v1)), null);
});

test("no choice yet means nothing optional runs", () => {
  local.removeItem(consent.CONSENT_STORAGE_KEY);
  assert.deepEqual(consent.effectiveChoices(null, false), { analytics: false, marketing: false });
  assert.equal(consent.hasCookieConsent("analytics"), false);
  assert.equal(consent.hasCookieConsent("marketing"), false);
});

test("GPC always wins over Marketing, before and after saving", () => {
  const all = consent.createConsent(consent.ALL_ACCEPTED, new Date(), { consentId: CONSENT_ID, confirmed: consent.ALL_ACCEPTED });
  assert.deepEqual(consent.effectiveChoices(all, true), { analytics: true, marketing: false });
  assert.deepEqual(consent.applyGpc(consent.ALL_ACCEPTED, true), { analytics: true, marketing: false });
  assert.deepEqual(consent.applyGpc(consent.ALL_ACCEPTED, false), consent.ALL_ACCEPTED);

  gpc = true;
  try {
    choose(consent.ALL_ACCEPTED); // stored all-on, but the browser now sends GPC
    assert.equal(consent.hasCookieConsent("marketing"), false);
    assert.equal(consent.hasCookieConsent("analytics"), true);
  } finally {
    gpc = false;
  }
});

test("Google consent signals: analytics_storage follows Analytics, ad_* follow Marketing", () => {
  assert.deepEqual(google.GOOGLE_CONSENT_DEFAULT, {
    analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
  });
  assert.deepEqual(google.googleConsentState({ analytics: true, marketing: false }), {
    analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
  });
  assert.deepEqual(google.googleConsentState({ analytics: true, marketing: true }), {
    analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted",
  });
});

test("GA client id is never read without Analytics consent, even when GA is marked active", async () => {
  jar.set("_ga", "GA1.1.111.222");
  gaEnv.setActiveGaId("G-TEST12345");
  try {
    choose({ analytics: false, marketing: true });
    assert.equal(await gaClient.getActiveGaClientId(), null);
    choose({ analytics: true, marketing: false });
    assert.equal(await gaClient.getActiveGaClientId(), "111.222");
  } finally {
    gaEnv.setActiveGaId(null);
    session.removeItem("medidakos_ga_client_id");
    jar.clear();
  }
});

test("UTM is stored and attached only with Analytics consent", () => {
  (globalThis.location as { search: string }).search = "?utm_source=mail&utm_campaign=q4";
  try {
    choose({ analytics: false, marketing: true });
    assert.deepEqual(utm.readUtmParams(), {});
    assert.equal(session.getItem("medidakos_utm_params"), null);
    choose({ analytics: true, marketing: false });
    assert.equal(utm.readUtmParams().utmSource, "mail");
    assert.notEqual(session.getItem("medidakos_utm_params"), null);
  } finally {
    (globalThis.location as { search: string }).search = "";
    session.removeItem("medidakos_utm_params");
  }
});

test("cookie names per category; Essential, chat and consent cookies are never matched", () => {
  const cookies = "_ga=1; _ga_ABC123=2; _gid=3; _fbp=4; _fbc=5; _gcl_au=6; ch-veil-id=7; ch-session-248070=8; _dd_s_v2=9; other=10";
  assert.deepEqual(cleanup.cookieNamesFor("analytics", cookies), ["_ga", "_ga_ABC123", "_gid"]);
  assert.deepEqual(cleanup.cookieNamesFor("marketing", cookies), ["_fbp", "_fbc", "_gcl_au"]);
});

test("cookie deletion domains cover host-only, the host and parent domains (never a bare TLD)", () => {
  assert.deepEqual(cleanup.cookieDomainsFor("www.medidakos.com"), [undefined, "www.medidakos.com", ".www.medidakos.com", ".medidakos.com"]);
  assert.deepEqual(cleanup.cookieDomainsFor("medidakos.com"), [undefined, "medidakos.com", ".medidakos.com"]);
  assert.deepEqual(cleanup.cookieDomainsFor("localhost"), [undefined]);
  assert.deepEqual(cleanup.cookieDomainsFor("127.0.0.1"), [undefined]);
});

test("clearing a category removes only its cookies and caches", () => {
  for (const [k, v] of Object.entries({ _ga: "1", _ga_ABC: "2", _fbp: "3", "ch-veil-id": "4", _dd_s_v2: "5" })) jar.set(k, v);
  session.setItem("medidakos_ga_client_id", "x");
  session.setItem("medidakos_utm_params", "{}");
  session.setItem("mdk:promo-seen", "v");
  local.setItem("lastExternalReferrer", "x");
  local.setItem("Channel.ch-veil-id", "x");

  cleanup.clearCategoryStorage("analytics");
  assert.deepEqual([...jar.keys()].sort(), ["_dd_s_v2", "_fbp", "ch-veil-id"]);
  assert.deepEqual(session.keys(), ["mdk:promo-seen"]);
  assert.ok(cookieWrites.some((w) => w.startsWith("_ga=;") && w.includes("Domain=.medidakos.com")));

  cleanup.clearCategoryStorage("marketing");
  assert.deepEqual([...jar.keys()].sort(), ["_dd_s_v2", "ch-veil-id"]);
  assert.equal(local.getItem("lastExternalReferrer"), null);
  assert.equal(local.getItem("Channel.ch-veil-id"), "x");
  jar.clear();
});
