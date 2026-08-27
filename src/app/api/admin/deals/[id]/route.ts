import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { dealInputSchema } from "@/lib/schemas/deal";
import { getDealWithSubcollections, updateDeal } from "@/lib/repo/deals";

export const runtime = "nodejs";

function extractDealId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("deals");
  if (idx === -1 || idx + 1 >= segments.length) return null;
  return decodeURIComponent(segments[idx + 1]);
}

export const GET = withAdmin(async (req) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const deal = await getDealWithSubcollections(id);
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  return NextResponse.json(deal);
});

export const PATCH = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const parsed = dealInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await updateDeal(id, parsed.data, actor);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorWithCode = err as { code?: number };
    if (errorWithCode?.code === 5) {
      return NextResponse.json({ error: "deal not found" }, { status: 404 });
    }
    throw err;
  }
});
