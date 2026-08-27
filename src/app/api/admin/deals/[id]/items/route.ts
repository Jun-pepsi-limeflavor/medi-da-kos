import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { dealItemInputSchema } from "@/lib/schemas/deal";
import { addItem, DealNotFoundError } from "@/lib/repo/deals";

export const runtime = "nodejs";

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
  const parsed = dealItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const itemId = await addItem(id, parsed.data, actor);
    return NextResponse.json({ id: itemId, ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DealNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});
