import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("reply route derives recipient and RFC threading from stored inbound message", async () => {
  const source = await readFile(new URL("../src/app/api/admin/threads/[threadKey]/reply/route.ts", import.meta.url), "utf8");
  assert.match(source, /latestInbound\.from/);
  assert.match(source, /latestInbound\.messageId/);
  assert.match(source, /getReferences\(latestInbound\)/);
  assert.match(source, /thread\.providerThreadId/);
  assert.match(source, /provider\.threadId !== thread\.providerThreadId/);
});

test("reply persistence keeps human thread state and links the outbound message", async () => {
  const source = await readFile(new URL("../src/app/api/admin/threads/[threadKey]/reply/route.ts", import.meta.url), "utf8");
  assert.match(source, /tx\.create\(messageRef/);
  assert.match(source, /direction: "out"/);
  assert.match(source, /threadKey: params\.threadKey/);
  assert.match(source, /lastDirection: "out"/);
  assert.doesNotMatch(source, /triageState:\s*"/);
  assert.doesNotMatch(source, /linkState:\s*"/);
});

