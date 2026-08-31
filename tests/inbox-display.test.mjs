import { test } from "node:test";
import assert from "node:assert/strict";
import { getIdentityDisplay } from "../src/lib/inbox-display.ts";

test("inbox identity display prefers email and never exposes Channel Talk key", () => {
  assert.deepEqual(getIdentityDisplay({
    kind: "email",
    value: "Buyer@Example.TEST",
    displayName: "Buyer",
  }), { primary: "buyer@example.test", email: "buyer@example.test" });
  assert.deepEqual(getIdentityDisplay({
    kind: "channeltalk",
    value: "main:visitor-1",
    displayName: "Buyer",
  }), { primary: "Buyer", secondary: "이메일 미제공" });
  assert.deepEqual(getIdentityDisplay({
    kind: "channeltalk",
    value: "main:visitor-2",
  }), { primary: "채널톡 사용자", secondary: "이메일 미제공" });
});
