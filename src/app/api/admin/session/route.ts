import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  assertAllowedAdmin,
  NotAdminError,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  const auth = getAdminAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  try {
    assertAllowedAdmin(decoded);
  } catch (err) {
    if (err instanceof NotAdminError) {
      return NextResponse.json({ error: "not authorized" }, { status: 403 });
    }
    throw err; // 설정 누락 → 500
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });

  const res = NextResponse.json({ ok: true });
  // lax, not strict: a top-level nav from an email/Slack link must carry the cookie.
  // Safe here because the only state-changing route (this POST) requires a bearer
  // idToken in the body — there's no ambient-cookie CSRF surface for lax to widen.
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
