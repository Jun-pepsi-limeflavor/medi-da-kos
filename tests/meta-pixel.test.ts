import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("./esm-alias-loader.mjs", import.meta.url);
const { trackMetaEvent } = await import("../src/lib/meta-pixel.ts");
const { trackEmailClick } = await import("../src/lib/analytics.ts");

function capture(href: string, run: () => void) {
  const fbq: unknown[][] = [];
  const gtag: unknown[][] = [];
  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  const url = new URL(href);
  globalScope.window = {
    location: { hostname: url.hostname, search: url.search },
    fbq: (...args: unknown[]) => fbq.push(args),
    gtag: (...args: unknown[]) => gtag.push(args),
  };
  const info = console.info;
  console.info = () => {};
  try {
    run();
  } finally {
    globalScope.window = previous;
    console.info = info;
  }
  return { fbq, gtag };
}

test("production visits send the standard event to Meta", () => {
  for (const host of ["https://www.medidakos.com/contact", "https://medidakos.com/contact"]) {
    const { fbq } = capture(host, () => trackMetaEvent("Lead", { content_name: "contact-page" }));
    assert.deepEqual(fbq, [["track", "Lead", { content_name: "contact-page" }]]);
  }
});

test("test traffic never reaches Meta", () => {
  for (const href of [
    "http://localhost:3000/contact",
    "https://medi-da-kos-git-feat.vercel.app/contact",
    "https://www.medidakos.com/contact?qa=1",
  ]) {
    assert.deepEqual(capture(href, () => trackMetaEvent("Lead")).fbq, [], href);
  }
});

test("email_click also sends Meta Contact without the address", () => {
  const { fbq, gtag } = capture("https://www.medidakos.com/contact", () =>
    trackEmailClick("footer", "a@b.com"),
  );
  assert.equal(gtag.length, 1);
  assert.deepEqual(fbq, [["track", "Contact", { content_name: "footer" }]]);
});
