import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

// Edge 런타임이라 firebase-admin 을 쓸 수 없다.
// 여기서 하는 일은 쿠키 유무를 보고 리디렉트하는 것뿐이다.
// 실제 검증은 withAdmin 이 한다.
// Next 공식 문서: Proxy는 "full session management or authorization solution"으로
// 쓰면 안 되고 optimistic check 용도다 — 이 파일이 하는 일이 정확히 그것이다.
export function proxy(req: NextRequest) {
  if (req.cookies.get(ADMIN_SESSION_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/((?!login$|login/).*)"],
};
