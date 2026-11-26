// 동의 고지 원문 보존: 현재 문구의 해시 = NOTICE_HASH = Git 스냅샷(docs/legal/cookie-consent/policy-v{N}.json).
// 문구를 바꾸고 해시·스냅샷을 갱신하지 않으면 실패한다. 모든 스냅샷은 자기 해시와 원문이 맞아야 한다(변조·덮어쓰기 감지).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { CONSENT_NOTICE, NOTICE_HASH } = await import("../../src/lib/cookie-consent/notice.ts");
const { POLICY_VERSION } = await import("../../src/lib/cookie-consent/consent.ts");

const DIR = new URL("../../docs/legal/cookie-consent/", import.meta.url);
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

test("the current wording hashes to NOTICE_HASH", () => {
  assert.equal(sha256(CONSENT_NOTICE), NOTICE_HASH, "wording changed: update NOTICE_HASH and the snapshot (or bump POLICY_VERSION)");
  assert.equal(CONSENT_NOTICE.policyVersion, POLICY_VERSION);
});

test("the current policy version has a Git snapshot with exactly this wording", () => {
  const snapshot = JSON.parse(readFileSync(new URL(`policy-v${POLICY_VERSION}.json`, DIR), "utf8"));
  assert.equal(snapshot.policyVersion, POLICY_VERSION);
  assert.equal(snapshot.noticeHash, NOTICE_HASH);
  assert.deepEqual(snapshot.notice, JSON.parse(JSON.stringify(CONSENT_NOTICE)));
});

test("every kept snapshot still matches its own hash", () => {
  const files = readdirSync(DIR).filter((name) => /^policy-v\d+\.json$/.test(name));
  assert.ok(files.length >= 1);
  for (const name of files) {
    const snapshot = JSON.parse(readFileSync(new URL(name, DIR), "utf8"));
    assert.equal(sha256(snapshot.notice), snapshot.noticeHash, name);
    assert.equal(`policy-v${snapshot.policyVersion}.json`, name);
  }
});
