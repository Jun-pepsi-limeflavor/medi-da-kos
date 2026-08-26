import "server-only";
// "next/server.js" (아니라 확장자 없는 "next/server")로 쓴다: next 패키지에
// exports map이 없어서, 이 파일을 node --test로 직접 import할 때 ESM 리졸버가
// 확장자 없는 서브패스를 못 찾는다. 실제 경로라 Next 번들러 쪽 해석은 그대로다.
import { NextResponse, type NextRequest } from "next/server.js";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  assertAllowedAdmin,
  NotAdminError,
  type AdminIdentity,
} from "@/lib/admin-auth";

export type AdminHandler = (
  req: NextRequest,
  actor: AdminIdentity,
) => Promise<Response> | Response;

function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export function withAdmin(handler: AdminHandler) {
  return async function guarded(req: NextRequest): Promise<Response> {
    const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!cookie) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // getAdminAuth() 는 서비스 계정이 없거나 손상됐으면 던진다. try 밖에 둬서
    // 설정 오류가 401로 삼켜지지 않고 그대로 전파되게 한다 (session route와 동일).
    const auth = getAdminAuth();

    let decoded;
    try {
      decoded = await auth.verifySessionCookie(cookie, true);
    } catch {
      return clearSessionCookie(
        NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
      );
    }

    let actor: AdminIdentity;
    try {
      actor = assertAllowedAdmin(decoded);
    } catch (err) {
      if (err instanceof NotAdminError) {
        return clearSessionCookie(
          NextResponse.json({ error: "not authorized" }, { status: 403 }),
        );
      }
      throw err; // BACKOFFICE_ADMIN_EMAILS 누락 → 500
    }

    return handler(req, actor);
  };
}
