// 쿠키 선택 저장·서버 증빙 전송(consent-sync.ts): Consent ID 생성·유지, 동의는 서버 확인 후 실행, 거부·철회는 즉시,
// outbox 재시도·중복 없는 재전송, 409(예전 고지)면 다시 묻기, GPC, 유형(consent/reject/update/withdraw) 판정.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test, beforeEach } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);

class MemoryStorage {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}
const local = new MemoryStorage();
let gpc = false;
Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
Object.defineProperty(globalThis.navigator, "globalPrivacyControl", { get: () => gpc, configurable: true });

type Sent = { url: string; body: Record<string, unknown> };
let sent: Sent[] = [];
let respond: (body: Record<string, unknown>) => number = () => 201;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body));
  sent.push({ url, body });
  const status = respond(body);
  if (status === 0) throw new TypeError("network down");
  return { status } as Response;
}) as typeof fetch;

const consent = await import("../../src/lib/cookie-consent/consent.ts");
const sync = await import("../../src/lib/cookie-consent/consent-sync.ts");
const { NOTICE_HASH } = await import("../../src/lib/cookie-consent/notice.ts");

const settle = () => sync.flushConsentOutbox();

beforeEach(() => {
  local.map.clear();
  sent = [];
  respond = () => 201;
  gpc = false;
});

test("action: first choice consent/reject, later withdraw if anything turned off, else update", () => {
  assert.equal(sync.decideAction(null, { analytics: true, marketing: false }), "consent");
  assert.equal(sync.decideAction(null, { analytics: false, marketing: false }), "reject");
  assert.equal(sync.decideAction({ analytics: true, marketing: true }, { analytics: true, marketing: false }), "withdraw");
  assert.equal(sync.decideAction({ analytics: false, marketing: false }, { analytics: true, marketing: false }), "update");
  assert.equal(sync.decideAction({ analytics: true, marketing: false }, { analytics: true, marketing: false }), "update");
});

test("Accept All: nothing runs until the server records it; then tracking is allowed", async () => {
  respond = () => 500; // server down first
  const event = sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  await settle();
  const stored = consent.readConsent()!;
  assert.ok(consent.isUuidV4(stored.consentId));
  assert.deepEqual({ a: stored.analytics, m: stored.marketing }, { a: true, m: true }, "the choice itself is kept");
  assert.equal(consent.hasCookieConsent("analytics"), false, "not confirmed → no tracking");
  assert.equal(consent.hasCookieConsent("marketing"), false);
  assert.equal(sync.readOutbox().length, 1, "kept for retry");

  respond = () => 201; // next page load retries the same event
  await settle();
  assert.equal(sync.readOutbox().length, 0);
  assert.equal(consent.hasCookieConsent("analytics"), true);
  assert.equal(consent.hasCookieConsent("marketing"), true);
  assert.deepEqual(new Set(sent.map((s) => s.body.eventId)), new Set([event.eventId]), "retries reuse the eventId");
  const body = sent[0].body;
  assert.deepEqual(Object.keys(body).sort(), ["action", "analytics", "clientSavedAt", "consentId", "eventId", "marketing", "noticeHash", "policyVersion", "source"]);
  assert.equal(body.noticeHash, NOTICE_HASH);
  assert.equal(body.policyVersion, consent.POLICY_VERSION);
  assert.equal(body.action, "consent");
  assert.equal(sent[0].url, "/api/cookie-consent");
});

test("Reject / withdraw stop tracking at once even if the server is unreachable", async () => {
  sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  await settle();
  assert.equal(consent.hasCookieConsent("analytics"), true);

  respond = () => 0; // network down
  sync.submitChoice({ analytics: false, marketing: true }, "settings");
  assert.equal(consent.hasCookieConsent("analytics"), false, "withdrawn immediately");
  assert.equal(consent.hasCookieConsent("marketing"), true, "untouched category stays");
  await settle();
  const pending = sync.readOutbox();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].action, "withdraw");

  sync.submitChoice(consent.ALL_REJECTED, "banner");
  assert.equal(consent.hasCookieConsent("marketing"), false);
  await settle();
  assert.equal(sync.readOutbox().length, 2, "both events wait, in order");
  respond = () => 201;
  await settle();
  assert.equal(sync.readOutbox().length, 0);
  assert.equal(consent.hasCookieConsent("analytics"), false, "a late ack never re-enables a withdrawn category");
  assert.equal(consent.hasCookieConsent("marketing"), false);
});

test("Consent ID: created at the first choice, kept for later choices and after expiry", async () => {
  assert.equal(local.getItem(consent.CONSENT_STORAGE_KEY), null, "no ID before any choice");
  sync.submitChoice(consent.ALL_REJECTED, "banner");
  const id = consent.readConsent()!.consentId;
  sync.submitChoice(consent.ALL_ACCEPTED, "settings");
  assert.equal(consent.readConsent()!.consentId, id);
  await settle();

  const expired = { ...consent.readConsent()!, expiresAt: "2000-01-01T00:00:00.000Z" };
  local.setItem(consent.CONSENT_STORAGE_KEY, JSON.stringify(expired));
  assert.equal(consent.readConsent(), null, "expired → asked again");
  const event = sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  assert.equal(event.consentId, id, "re-consent keeps the browser's ID");
  assert.equal(event.action, "consent");

  local.map.clear();
  const fresh = sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  assert.notEqual(fresh.consentId, id, "cleared storage → new ID");
});

test("409 (old wording/policy in this tab): dropped and the banner asks again, keeping the Consent ID", async () => {
  respond = () => 409;
  const event = sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  await settle();
  assert.equal(sync.readOutbox().length, 0);
  assert.equal(consent.readConsent(), null, "choice no longer valid → banner");
  assert.equal(consent.hasCookieConsent("analytics"), false);
  assert.equal(consent.readPreviousConsentId(), event.consentId);
});

test("400 is dropped without retry; duplicate (200) counts as recorded", async () => {
  respond = () => 400;
  sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  await settle();
  assert.equal(sync.readOutbox().length, 0);
  assert.equal(consent.hasCookieConsent("analytics"), false, "never confirmed");

  respond = () => 200;
  sync.submitChoice(consent.ALL_ACCEPTED, "settings");
  await settle();
  assert.equal(consent.hasCookieConsent("analytics"), true);
});

test("GPC: Accept All is stored and sent with Marketing off", async () => {
  gpc = true;
  const event = sync.submitChoice(consent.ALL_ACCEPTED, "banner");
  await settle();
  assert.equal(event.marketing, false);
  assert.equal(consent.readConsent()!.marketing, false);
  assert.equal(consent.hasCookieConsent("analytics"), true);
  assert.equal(consent.hasCookieConsent("marketing"), false);
});

test("events older than the 6-month choice validity are dropped, not sent", async () => {
  local.setItem(sync.OUTBOX_STORAGE_KEY, JSON.stringify([{ eventId: "6f1c1f52-6a7b-4c1e-8f3a-2d9b8c7e6a51", clientSavedAt: "2020-01-01T00:00:00.000Z" }]));
  await settle();
  assert.equal(sent.length, 0);
  assert.equal(sync.readOutbox().length, 0);
});
