import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { getGmailToken } from "@/lib/gmail-auth";

export const runtime = "nodejs";

export const POST = withAdmin(async (req: NextRequest) => {
  // 경로가 /settings/mail-providers/{account}/diagnose이므로 마지막이 아니라
  // 뒤에서 두 번째 세그먼트가 account다 (threads/[threadKey]/link 라우트와 동일 패턴).
  const account = req.nextUrl.pathname.split("/").filter(Boolean).slice(-2)[0];
  if (!account) return NextResponse.json({ error: "account required" }, { status: 400 });

  try {
    await getGmailToken(decodeURIComponent(account));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message });
  }
});
