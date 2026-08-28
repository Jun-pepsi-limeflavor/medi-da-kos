import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { dealInputSchema } from "@/lib/schemas/deal";
import { listDeals, createDeal, InvalidIntakeReviewError } from "@/lib/repo/deals";

export const runtime = "nodejs";

export const GET = withAdmin(async () => {
  const deals = await listDeals();
  return NextResponse.json({ deals });
});

export const POST = withAdmin(async (req, actor) => {
  const body = await req.json().catch(() => null);
  const parsed = dealInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const id = await createDeal(parsed.data, actor);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidIntakeReviewError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
});
