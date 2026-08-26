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

export function withAdmin(handler: AdminHandler) {
  return async function guarded(req: NextRequest): Promise<Response> {
    const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!cookie) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    } catch {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    let actor: AdminIdentity;
    try {
      actor = assertAllowedAdmin(decoded);
    } catch (err) {
      if (err instanceof NotAdminError) {
        return NextResponse.json({ error: "not authorized" }, { status: 403 });
      }
      throw err; // BACKOFFICE_ADMIN_EMAILS 누락 → 500
    }

    return handler(req, actor);
  };
}
