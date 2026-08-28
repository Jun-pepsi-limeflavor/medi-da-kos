import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { setIntakeReview } from "@/lib/repo/intake-reviews";

export const runtime = "nodejs";

export const PUT = withAdmin(async (req, actor) => {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const externalId = decodeURIComponent(segments.pop() ?? "");
  const source = decodeURIComponent(segments.pop() ?? "");
  if (!source || !externalId) {
    return NextResponse.json({ error: "source and externalId required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  try {
    const review = await setIntakeReview(source, externalId, body, actor);
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid input", issues: err.issues }, { status: 400 });
    }
    throw err;
  }
});
