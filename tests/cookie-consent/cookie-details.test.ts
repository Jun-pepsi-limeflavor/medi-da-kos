// Cookie Details(고지)와 실제 정리 로직의 정합성: Analytics·Marketing 행은 철회 시 cleanup.ts가 지우는 항목이어야 하고,
// cleanup.ts가 지우는 저장 키는 Details에 고지돼 있어야 한다. 행 구성(14행)·저장 방식(Type)도 고정한다.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { COOKIE_DETAIL_GROUPS, STORAGE_TYPES } = await import("../../src/components/cookie-consent/cookie-data.ts");
const cleanup = await import("../../src/lib/cookie-consent/cleanup.ts");

const group = (title: string) => COOKIE_DETAIL_GROUPS.find((g) => g.title === title)?.items ?? [];
const names = (title: string) => group(title).map((item) => item.name);

test("Cookie Details: 14 rows — Essential 3, Analytics 4, Marketing 7 — in the Settings category order", () => {
  assert.deepEqual(COOKIE_DETAIL_GROUPS.map((g) => g.title), ["Essential Cookies", "Analytics Cookies", "Marketing Cookies"]);
  assert.deepEqual(names("Essential Cookies"), ["ch-session-248070", "ch-veil-id", "_dd_s_v2"]);
  assert.deepEqual(names("Analytics Cookies"), ["_ga", "_ga_NQPD9VE63R", "medidakos_ga_client_id", "medidakos_utm_params"]);
  assert.deepEqual(names("Marketing Cookies"), ["_fbp", "_fbc", "lastExternalReferrer", "lastExternalReferrerTime", "_gcl_aw", "_gcl_gs", "_gcl_ls"]);
  assert.equal(COOKIE_DETAIL_GROUPS.flatMap((g) => g.items).length, 14);
});

test("every row has a known storage type and non-empty provider, purpose and expiration", () => {
  const expected: Record<string, string> = {
    medidakos_ga_client_id: "Session storage",
    medidakos_utm_params: "Session storage",
    lastExternalReferrer: "Local storage",
    lastExternalReferrerTime: "Local storage",
    _gcl_ls: "Local storage",
  };
  for (const item of COOKIE_DETAIL_GROUPS.flatMap((g) => g.items)) {
    assert.ok((STORAGE_TYPES as readonly string[]).includes(item.type), item.name);
    assert.equal(item.type, expected[item.name] ?? "Cookie", item.name);
    for (const field of [item.provider, item.purpose, item.expiration]) assert.ok(field.trim().length > 0, item.name);
  }
});

/** Is `item` removed by clearing `category`? Cookies by the cleanup name rules, Web Storage by its key lists. */
function clearedBy(category: "analytics" | "marketing", item: { name: string; type: string }): boolean {
  if (item.type === "Cookie") return cleanup.cookieNamesFor(category, `${item.name}=x`).includes(item.name);
  const keys = cleanup.storageKeysFor(category);
  return (item.type === "Local storage" ? keys.local : keys.session).includes(item.name);
}

test("Analytics and Marketing rows are exactly what withdrawing that category clears; Essential rows are never cleared", () => {
  for (const item of group("Analytics Cookies")) assert.ok(clearedBy("analytics", item), `analytics clears ${item.name}`);
  for (const item of group("Marketing Cookies")) assert.ok(clearedBy("marketing", item), `marketing clears ${item.name}`);
  for (const item of group("Essential Cookies")) {
    assert.ok(!clearedBy("analytics", item) && !clearedBy("marketing", item), `${item.name} is Essential`);
  }
});

test("Google Ads rows (_gcl_*) are cleared by either withdrawal; Meta rows only by Marketing; GA4 rows only by Analytics", () => {
  for (const item of group("Marketing Cookies")) {
    const googleAds = item.name.startsWith("_gcl_");
    assert.equal(clearedBy("analytics", item), googleAds, `${item.name} under Analytics withdrawal`);
  }
  for (const item of group("Analytics Cookies")) assert.equal(clearedBy("marketing", item), false, `${item.name} survives Marketing withdrawal`);
});

test("every Web Storage key the cleanup removes is disclosed in Cookie Details", () => {
  const disclosed = new Set(COOKIE_DETAIL_GROUPS.flatMap((g) => g.items).filter((i) => i.type !== "Cookie").map((i) => i.name));
  for (const category of ["analytics", "marketing"] as const) {
    const { local, session } = cleanup.storageKeysFor(category);
    for (const key of [...local, ...session]) assert.ok(disclosed.has(key), `${key} (${category}) is in Cookie Details`);
  }
});
