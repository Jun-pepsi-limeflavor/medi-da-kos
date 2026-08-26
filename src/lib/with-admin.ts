import "server-only";
import { NextResponse, type NextRequest } from "next/server";
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
  // session route의 DELETE 분기와 속성을 맞춘다 — 이름·도메인·path만 맞으면
  // 브라우저는 지우지만, 두 자리가 다르면 다음 사람이 차이를 의미로 읽는다.
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
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
