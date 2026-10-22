import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("./esm-alias-loader.mjs", import.meta.url);
const { trackEmailClick, trackEmailCopy } = await import("../src/lib/analytics.ts");

function captureGtag(href: string, run: () => void) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  const url = new URL(href);
  globalScope.window = {
    location: { hostname: url.hostname, search: url.search },
    gtag: (_command: string, name: string, params: Record<string, unknown>) => calls.push({ name, params }),
  };
  try {
    run();
  } finally {
    globalScope.window = previous;
  }
  return calls;
}

test("contact and footer share one email_click event, split by link_location", () => {
  const calls = captureGtag("https://medidakos.com/contact", () => {
    trackEmailClick("contact", "a@b.com");
    trackEmailClick("footer", "a@b.com");
  });
  assert.deepEqual(
    calls.map((c) => [c.name, c.params.link_location, c.params.link_url, c.params.is_test]),
    [
      ["email_click", "contact", "mailto:a@b.com", false],
      ["email_click", "footer", "mailto:a@b.com", false],
    ],
  );
});

test("email events are marked as test with ?qa=1", () => {
  const calls = captureGtag("https://www.medidakos.com/contact?qa=1", () => trackEmailCopy("footer"));
  assert.deepEqual(calls, [
    { name: "email_copy", params: { link_location: "footer", method: "manual", is_test: true } },
  ]);
});
