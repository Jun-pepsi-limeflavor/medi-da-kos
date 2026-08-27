import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { buyerInputSchema } from "@/lib/schemas/buyer";
import { createBuyer, EmailTakenError } from "@/lib/repo/buyers";

export const runtime = "nodejs";

export const POST = withAdmin(async (req, actor) => {
  const body = await req.json().catch(() => null);
  const parsed = buyerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const id = await createBuyer(parsed.data, actor);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return NextResponse.json({ error: "email taken", email: err.email }, { status: 409 });
    }
    throw err;
  }
});
