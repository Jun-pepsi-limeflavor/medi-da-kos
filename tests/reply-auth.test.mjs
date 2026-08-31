import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_GMAIL_MAILBOXES,
  GMAIL_READ_SCOPE,
  GMAIL_SEND_SCOPE,
  normalizeGmailScopes,
  normalizeMailboxConfig,
} from "../functions-ingest/google-auth.js";

test("Gmail mailbox config is an exact approved account allowlist", () => {
  const config = normalizeMailboxConfig();
  assert.deepEqual(config.map(({ account }) => account), DEFAULT_GMAIL_MAILBOXES.map(({ account }) => account));
  assert.deepEqual(config.filter((mailbox) => mailbox.enabled).map(({ account }) => account), [
    "thomas@medidakoslabs.com",
    "hally@medidakoslabs.com",
    "support@medidakos.com",
  ]);
  assert.throws(
    () => normalizeMailboxConfig([{ account: "attacker@example.com", channel: "gmail_thomas" }]),
    /not approved/,
  );
  assert.throws(
    () => normalizeMailboxConfig([
      { account: "thomas@medidakoslabs.com", channel: "gmail_thomas" },
      { account: "THOMAS@MEDIDAKOSLABS.COM", channel: "gmail_thomas" },
    ]),
    /Duplicate/,
  );
});

test("only approved read/send Gmail OAuth scopes can be requested", () => {
  assert.deepEqual(normalizeGmailScopes(), [GMAIL_READ_SCOPE]);
  assert.deepEqual(normalizeGmailScopes("send"), [GMAIL_SEND_SCOPE]);
  assert.deepEqual(normalizeGmailScopes({ purpose: "readwrite" }), [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE]);
  assert.throws(() => normalizeGmailScopes({ scopes: ["cloud-platform"] }), /Unsupported/);
});

test("support@medidakos.com is an approved Gmail mailbox for reply and attachment access", async () => {
  // gmail-auth.ts is guarded by the "server-only" package, which throws when
  // imported outside a Server Component (confirmed: `node --test` import
  // fails with "This module cannot be imported from a Client Component
  // module."). Assert against source text, same as the route check below.
  const source = await readFile(new URL("../src/lib/gmail-auth.ts", import.meta.url), "utf8");
  assert.match(source, /\["support@medidakos\.com",\s*true\]/);
});

test("reply route is admin-only and chooses send credentials server-side", async () => {
  const source = await readFile(new URL("../src/app/api/admin/threads/[threadKey]/reply/route.ts", import.meta.url), "utf8");
  assert.match(source, /withAdmin\(async/);
  assert.match(source, /purpose: "send"/);
  assert.match(source, /getThread\(threadKey\)/);
  assert.match(source, /listThreadMessages\(threadKey\)/);
  assert.doesNotMatch(source, /body\.(from|to|subject|threadId)/);
});

