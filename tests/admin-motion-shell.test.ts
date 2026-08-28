import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("관리자 레이아웃은 서버 인가 뒤에 전용 모션 래퍼를 둔다", () => {
  const source = readFileSync("src/app/admin/(dash)/layout.tsx", "utf8");

  assert.match(source, /import AdminMotionShell from "\.\/AdminMotionShell"/);
  assert.match(source, /<AdminMotionShell>/);
  assert.match(source, /<main[\s\S]*>\s*\{children\}\s*<\/main>/);
});
