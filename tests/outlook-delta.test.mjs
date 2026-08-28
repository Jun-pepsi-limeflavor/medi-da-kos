import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GraphRequestError,
  initialDeltaUrl,
  listDeltaPages,
} from "../functions-ingest/outlook.js";

function response(json, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => json };
}

test("Graph delta consumes every nextLink before exposing the deltaLink", async () => {
  const requests = [];
  const first = "https://graph.test/page-1";
  const second = "https://graph.test/page-2";
  const result = await listDeltaPages("token", {
    mailbox: "support@example.test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url === initialDeltaUrl({ mailbox: "support@example.test", baseUrl: "https://graph.test/v1.0" })) {
        return response({ value: [{ id: "m1" }], "@odata.nextLink": first });
      }
      if (url === first) return response({ value: [{ id: "m2" }], "@odata.nextLink": second });
      if (url === second) return response({
        value: [{ id: "m3" }, { id: "deleted", "@removed": { reason: "deleted" } }],
        "@odata.deltaLink": "https://graph.test/delta-token",
      });
      throw new Error(`unexpected URL ${url}`);
    },
    baseUrl: "https://graph.test/v1.0",
  });

  assert.deepEqual(result.messages.map((message) => message.id), ["m1", "m2", "m3"]);
  assert.equal(result.removed[0].id, "deleted");
  assert.equal(result.deltaLink, "https://graph.test/delta-token");
  assert.equal(requests.length, 3);
  assert.equal(requests[0].options.headers.Authorization, "Bearer token");
  assert.match(requests[0].options.headers.Prefer, /odata\.maxpagesize/);
});

test("an empty completed delta round returns an empty message set and cursor", async () => {
  const result = await listDeltaPages("token", {
    deltaLink: "https://graph.test/delta-token",
    fetchImpl: async () => response({ value: [], "@odata.deltaLink": "https://graph.test/delta-token-2" }),
  });
  assert.deepEqual(result.messages, []);
  assert.equal(result.deltaLink, "https://graph.test/delta-token-2");
  assert.equal(result.pages.length, 1);
});

test("expired delta is surfaced as a typed error without reading provider body", async () => {
  await assert.rejects(
    () => listDeltaPages("token", {
      deltaLink: "https://graph.test/expired",
      fetchImpl: async () => response({ error: { message: "private details" } }, 410),
    }),
    (error) => {
      assert.ok(error instanceof GraphRequestError);
      assert.equal(error.code, "DELTA_EXPIRED");
      assert.equal(error.status, 410);
      assert.equal(error.message, "Microsoft Graph request failed (410)");
      return true;
    },
  );
});
