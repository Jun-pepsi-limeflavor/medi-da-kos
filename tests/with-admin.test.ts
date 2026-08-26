import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { NextRequest } from "next/server.js";

// with-admin.ts는 tsconfig의 "@/*" 별칭으로 다른 src/lib 파일을 가져온다.
// node --test는 그 별칭도, 소스의 확장자 생략도 모른다 — 동적 import 전에
// 등록해두는 최소 리졸버 훅으로 흉내낸다 (esm-alias-loader.mjs 참고).
register("./esm-alias-loader.mjs", import.meta.url);
const { withAdmin } = await import("../src/lib/with-admin.ts");
const { ADMIN_SESSION_COOKIE } = await import("../src/lib/admin-auth.ts");

beforeEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_B64;
});

// 요점: 서비스 계정 미설정은 "세션 만료"가 아니라 배포 설정 오류다. withAdmin이
// getAdminAuth()를 try 안에 두면 이 오류가 401 unauthenticated로 둔갑한다 —
// verifySessionCookie가 실패했을 때와 구분이 안 되어, 다음 사람이 "쿠키가
// 이상한가?"로 엉뚱한 곳을 판다. getAdminAuth()는 try 밖에 있어야 한다.
test("FIREBASE_SERVICE_ACCOUNT_B64 가 없으면 401로 삼키지 않고 예외가 전파된다", async () => {
  const handler = withAdmin(() => new Response("ok"));
  const req = new NextRequest("http://localhost/api/admin/x", {
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=fake-session-cookie` },
  });
  await assert.rejects(() => handler(req), /FIREBASE_SERVICE_ACCOUNT_B64/);
});
