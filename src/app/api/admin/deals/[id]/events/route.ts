import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { appendEvent, DealNotFoundError } from "@/lib/repo/deals";

export const runtime = "nodejs";

const createEventInputSchema = z.object({
  body: z.string().trim().min(1, { message: "내용은 필수입니다" }),
  sourceRefs: z.array(z.string().trim()).default([]),
});

function extractDealId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("deals");
  if (idx === -1 || idx + 1 >= segments.length) return null;
  return decodeURIComponent(segments[idx + 1]);
}

export const POST = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const eventId = await appendEvent(
      id,
      {
        type: "note",
        body: parsed.data.body,
        sourceRefs: parsed.data.sourceRefs,
      },
      actor
    );
    return NextResponse.json({ id: eventId, ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DealNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});
