import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { setThreadState } from "@/lib/repo/threads";

export const runtime = "nodejs";

export const PATCH = withAdmin(async (req, actor) => {
  const match = req.nextUrl.pathname.match(
    /^\/api\/admin\/threads\/(.+)\/state\/?$/
  );
  const threadKey = match ? decodeURIComponent(match[1]) : decodeURIComponent(req.nextUrl.pathname.split("/").filter(Boolean).slice(-2)[0] ?? "");
  if (!threadKey) return NextResponse.json({ error: "threadKey required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "invalid input" },
      { status: 400 }
    );
  }

  try {
    await setThreadState(decodeURIComponent(threadKey), body, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid input", issues: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }
});
