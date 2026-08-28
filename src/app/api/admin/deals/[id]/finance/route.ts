import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { dealFinanceInputSchema } from "@/lib/schemas/deal-finance";
import { getDealFinance, updateDealFinance } from "@/lib/repo/deal-finance";

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

  const finance = await getDealFinance(id);
  return NextResponse.json({ finance });
});

export const PUT = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = dealFinanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  await updateDealFinance(id, parsed.data, actor);
  return NextResponse.json({ ok: true }, { status: 200 });
});
