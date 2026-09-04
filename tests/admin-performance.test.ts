import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);
const { adminPerformanceEvent } = await import("../src/lib/admin-performance.ts");

test("admin performance events keep only rounded duration and numeric counts", () => {
  assert.deepEqual(
    adminPerformanceEvent("inbox.queue", 12.6, {
      conversations: 4,
      ignoredText: "buyer@example.test",
      ignoredObject: { subject: "private" },
      ignoredNaN: Number.NaN,
    }),
    {
      event: "admin_performance",
      operation: "inbox.queue",
      durationMs: 13,
      counts: { conversations: 4 },
    },
  );
});
