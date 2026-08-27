import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { buyerInputSchema } from "@/lib/schemas/buyer";
import { updateBuyer, EmailTakenError } from "@/lib/repo/buyers";

export const runtime = "nodejs";

export const PUT = withAdmin(async (req, actor) => {
  const id = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = buyerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    await updateBuyer(id, parsed.data, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json({ error: "email taken", email: err.email }, { status: 409 });
    }
    throw err;
  }
});
