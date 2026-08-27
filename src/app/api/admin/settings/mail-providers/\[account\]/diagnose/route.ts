import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { getGmailToken } from "@/lib/gmail-auth";

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ account: string }> }
) {
  const { account } = await params;

  if (req.method !== "POST") {
    return NextResponse.json({ error: "method not allowed" }, { status: 405 });
  }

  try {
    await getGmailToken(account);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message });
  }
}

export const POST = withAdmin(handler);
