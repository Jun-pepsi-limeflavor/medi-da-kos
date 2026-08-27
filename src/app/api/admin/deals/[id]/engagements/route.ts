import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import {
  supplierEngagementInputSchema,
} from "@/lib/schemas/deal";
import {
  addSupplierEngagement,
  updateSupplierEngagement,
  DealNotFoundError,
} from "@/lib/repo/deals";

export const runtime = "nodejs";

const patchEngagementSchema = z
  .object({
    engagementId: z.string().trim().min(1, { message: "engagementId는 필수입니다" }),
  })
  .and(supplierEngagementInputSchema.partial());

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
  const parsed = supplierEngagementInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const engagementId = await addSupplierEngagement(id, parsed.data, actor);
    return NextResponse.json({ id: engagementId, ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DealNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});

export const PATCH = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = patchEngagementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { engagementId, ...patch } = parsed.data;
  await updateSupplierEngagement(id, engagementId, patch, actor);
  return NextResponse.json({ ok: true, id: engagementId }, { status: 200 });
});
