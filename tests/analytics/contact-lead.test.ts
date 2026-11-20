// Contact 전환 이벤트(generate_lead · Meta Lead) 회귀 테스트: 실제 저장(saved: true)일 때만 한 번, Mock 제출은 전송 없음,
// 기존 운영과 같은 이름·매개변수, 개인정보 없음, 추적 오류가 호출부로 새지 않음.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { trackContactLead } = await import("../../src/lib/analytics/events.ts");

type Call = { tool: "gtag" | "fbq"; name: string; params: Record<string, unknown> };

function capture(href: string, run: () => void, opts: { throwInGtag?: boolean } = {}) {
  const calls: Call[] = [];
  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  const url = new URL(href);
  globalScope.window = {
    location: { hostname: url.hostname, search: url.search },
    gtag: (_command: string, name: string, params: Record<string, unknown>) => {
      if (opts.throwInGtag) throw new Error("gtag broken");
      calls.push({ tool: "gtag", name, params });
    },
    fbq: (_command: string, name: string, params: Record<string, unknown>) => calls.push({ tool: "fbq", name, params }),
  };
  const info = console.info;
  const error = console.error;
  console.info = () => {};
  console.error = () => {};
  try {
    run();
  } finally {
    globalScope.window = previous;
    console.info = info;
    console.error = error;
  }
  return calls;
}

const utm = { utmSource: "google", utmMedium: "cpc", utmCampaign: "renewal" };

test("a real save sends generate_lead and Meta Lead once, with the previous production parameters", () => {
  const calls = capture("https://www.medidakos.com/contact", () => trackContactLead({ saved: true }, utm));
  assert.deepEqual(calls, [
    {
      tool: "gtag",
      name: "generate_lead",
      params: {
        form_id: "contact-page",
        lead_type: "inquiry",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "renewal",
        is_test: false,
      },
    },
    { tool: "fbq", name: "Lead", params: { content_name: "contact-page" } },
  ]);
});

test("a mock submission (saved: false) sends nothing, even on the production domain", () => {
  assert.deepEqual(capture("https://www.medidakos.com/contact", () => trackContactLead({ saved: false }, utm)), []);
});

test("off the production domain: GA marked is_test, Meta Lead goes to the (dev) pixel loaded there", () => {
  const calls = capture("https://dev.medidakos.com/contact", () => trackContactLead({ saved: true }, {}));
  assert.deepEqual(calls.map((c) => [c.tool, c.name, c.params?.is_test]), [
    ["gtag", "generate_lead", true],
    ["fbq", "Lead", undefined],
  ]);
});

test("with ?qa=1: GA marked is_test, Meta not sent", () => {
  const calls = capture("https://www.medidakos.com/contact?qa=1", () => trackContactLead({ saved: true }, {}));
  assert.deepEqual(calls.map((c) => [c.tool, c.name, c.params.is_test]), [["gtag", "generate_lead", true]]);
});

test("no personal data in the event parameters", () => {
  const calls = capture("https://www.medidakos.com/contact", () => trackContactLead({ saved: true }, utm));
  const keys = calls.flatMap((c) => Object.keys(c.params));
  for (const key of keys) assert.ok(!/email|name$|company|message|phone/i.test(key) || key === "content_name", key);
});

test("a tracking error never reaches the caller (the saved inquiry still shows success)", () => {
  assert.doesNotThrow(() =>
    capture("https://www.medidakos.com/contact", () => trackContactLead({ saved: true }, utm), { throwInGtag: true }),
  );
});
