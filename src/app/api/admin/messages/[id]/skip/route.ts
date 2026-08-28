import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { getMessage, setMessageParseStatus } from "@/lib/repo/messages";
import type { AdminIdentity } from "@/lib/admin-auth";

export const runtime = "nodejs";

export const POST = withAdmin(async (req: NextRequest, _actor: AdminIdentity) => {
  const match = req.nextUrl.pathname.match(
    /^\/api\/admin\/messages\/([^/]+)\/skip\/?$/,
  );
  if (!match) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const id = decodeURIComponent(match[1]);

  const message = await getMessage(id);
  if (!message) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }

  await setMessageParseStatus(id, "skipped");

  return NextResponse.json({ ok: true });
});
