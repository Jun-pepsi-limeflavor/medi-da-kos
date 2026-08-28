import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { sampleRoundInputSchema, sampleRoundPatchSchema } from "@/lib/schemas/deal";
import {
  addSampleRound,
  updateSampleRound,
  DuplicateSampleRoundError,
} from "@/lib/repo/deals";

export const runtime = "nodejs";

const patchSampleSchema = z
  .object({
    roundId: z.string().trim().min(1, { message: "roundId는 필수입니다" }),
  })
  .and(sampleRoundPatchSchema);

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
  const parsed = sampleRoundInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const roundId = await addSampleRound(id, parsed.data, actor);
    return NextResponse.json({ id: roundId }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateSampleRoundError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
});

export const PATCH = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = patchSampleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { roundId, ...patch } = parsed.data;
  await updateSampleRound(id, roundId, patch, actor);
  return NextResponse.json({ ok: true }, { status: 200 });
});
