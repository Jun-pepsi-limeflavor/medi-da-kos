import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { supplierEngagementInputSchema } from "@/lib/schemas/deal";
import {
  DealNotFoundError,
  EngagementNotFoundError,
  InvalidEngagementReferenceError,
  replaceSupplierEngagement,
} from "@/lib/repo/deals";

export const runtime = "nodejs";

const replaceSchema = z.object({
  oldEngagementId: z.string().trim().min(1),
  replacement: supplierEngagementInputSchema,
  reason: z.string().trim().min(1),
  sourceRefs: z.array(z.string().trim().min(1)).max(50).default([]),
});

function extractDealId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.indexOf("deals");
  return index === -1 || index + 1 >= segments.length
    ? null
    : decodeURIComponent(segments[index + 1]);
}

export const POST = withAdmin(async (req, actor) => {
  const dealId = extractDealId(req.nextUrl.pathname);
  if (!dealId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const parsed = replaceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const id = await replaceSupplierEngagement(
      dealId,
      parsed.data.oldEngagementId,
      parsed.data.replacement,
      parsed.data.reason,
      actor,
      parsed.data.sourceRefs,
    );
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    if (err instanceof DealNotFoundError || err instanceof EngagementNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidEngagementReferenceError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
});
