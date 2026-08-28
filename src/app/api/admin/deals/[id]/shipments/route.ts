import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { shipmentInputSchema, shipmentPatchSchema } from "@/lib/schemas/deal";
import { upsertShipment } from "@/lib/repo/deals";

export const runtime = "nodejs";

const patchShipmentSchema = z
  .object({
    shipmentId: z.string().trim().min(1, { message: "shipmentId는 필수입니다" }),
  })
  .and(shipmentPatchSchema);

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
  const parsed = shipmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const shipmentId = await upsertShipment(id, parsed.data, actor);
  return NextResponse.json({ id: shipmentId }, { status: 201 });
});

export const PATCH = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = patchShipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { shipmentId, ...patch } = parsed.data;
  await upsertShipment(id, patch, actor, shipmentId);
  return NextResponse.json({ ok: true, id: shipmentId }, { status: 200 });
});
