import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { supplierInputSchema } from "@/lib/schemas/supplier";
import { createSupplier, DuplicateSupplierError } from "@/lib/repo/suppliers";

export const runtime = "nodejs";

export const POST = withAdmin(async (req, actor) => {
  const body = await req.json().catch(() => null);
  const parsed = supplierInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const id = await createSupplier(parsed.data, actor);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateSupplierError) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    throw err;
  }
});
