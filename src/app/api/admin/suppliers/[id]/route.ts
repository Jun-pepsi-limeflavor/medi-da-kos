import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { supplierInputSchema } from "@/lib/schemas/supplier";
import { updateSupplier } from "@/lib/repo/suppliers";

export const runtime = "nodejs";

export const PUT = withAdmin(async (req, actor) => {
  const id = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = supplierInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  await updateSupplier(id, parsed.data, actor);
  return NextResponse.json({ ok: true });
});
