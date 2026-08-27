import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { getGmailToken } from "@/lib/gmail-auth";

export const runtime = "nodejs";

export const POST = withAdmin(async (req: NextRequest) => {
  const account = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  if (!account) return NextResponse.json({ error: "account required" }, { status: 400 });

  try {
    await getGmailToken(account);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message });
  }
});
