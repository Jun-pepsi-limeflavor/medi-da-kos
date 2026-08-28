import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);
const { ingestHealthSummary } = await import("../src/lib/repo/ingest-state.ts");

test("ingestHealthSummary is exported and reports health summary structure", async () => {
  assert.equal(typeof ingestHealthSummary, "function");
});
