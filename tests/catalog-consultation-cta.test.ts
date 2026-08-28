import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) =>
  readFile(
    new URL(path, import.meta.url),
    "utf8",
  );

test("catalog consultation CTA uses the WebGL specular button without changing its behavior", async () => {
  const [catalogLanding, specularButton] = await Promise.all([
    source("../src/components/landing/CatalogLanding.tsx"),
    source("../src/components/landing/SpecularButton.tsx"),
  ]);

  assert.match(catalogLanding, /import \{ SpecularButton \} from "\.\/SpecularButton";/);
  assert.match(catalogLanding, /<SpecularButton[\s\S]*disabled=\{selected\.length === 0\}/);
  assert.match(catalogLanding, /<SpecularButton[\s\S]*onClick=\{\(\) => \{ setFormItems\(selected\); setForm\(true\); \}\}/);
  assert.match(catalogLanding, /intensity=\{1\.7\}/);
  assert.match(catalogLanding, /shineSize=\{22\}/);
  assert.match(catalogLanding, /shineFade=\{58\}/);
  assert.match(catalogLanding, /proximity=\{420\}/);
  assert.match(catalogLanding, /bg-white\/\[\.48\]/);
  assert.match(catalogLanding, /rounded-2xl/);
  assert.match(catalogLanding, /shadow-\[0_4px_30px_rgba\(0,0,0,0\.1\)\]/);
  assert.match(catalogLanding, /backdrop-blur-\[4\.9px\]/);
  assert.match(catalogLanding, /border-white\/\[\.44\]/);
  assert.match(specularButton, /from "ogl"/);
  assert.match(specularButton, /new Renderer\(/);
  assert.match(specularButton, /ResizeObserver/);
  assert.match(specularButton, /aria-hidden/);
  assert.match(specularButton, /disabled/);
});
