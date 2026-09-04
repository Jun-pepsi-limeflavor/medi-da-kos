import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { measureAdminOperation } from "@/lib/admin-performance";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  assertAllowedAdmin,
  NotAdminError,
  type AdminIdentity,
} from "@/lib/admin-auth";

/**
 * 서버 컴포넌트용 세션 가드.
 * withAdmin 과 판정 로직은 같지만 실패 처리가 다르다 —
 * 라우트는 401 을 주고 페이지는 로그인으로 보낸다.
 */
export const requireAdminPage = cache(async function requireAdminPage(): Promise<AdminIdentity> {
  return measureAdminOperation("admin.auth", async () => {
  const store = await cookies();          // Next 16 에서 cookies() 는 비동기다
  const cookie = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) redirect("/admin/login");

  let decoded;
  try {
    decoded = await getAdminAuth().verifySessionCookie(cookie, true);
  } catch {
    redirect("/admin/login");
  }

  try {
    return assertAllowedAdmin(decoded);
  } catch (err) {
    if (err instanceof NotAdminError) redirect("/admin/login");
    throw err;   // BACKOFFICE_ADMIN_EMAILS 누락 → 500
  }
  });
});
