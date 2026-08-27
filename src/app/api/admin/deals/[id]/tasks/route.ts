import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { dealTaskInputSchema } from "@/lib/schemas/deal";
import { createTask, completeTask } from "@/lib/repo/deals";

export const runtime = "nodejs";

const patchTaskSchema = z.object({
  taskId: z.string().trim().min(1, { message: "taskId는 필수입니다" }),
  action: z.literal("complete"),
});

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
  const parsed = dealTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const taskId = await createTask(id, parsed.data, actor);
  return NextResponse.json({ id: taskId }, { status: 201 });
});

export const PATCH = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = patchTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  await completeTask(id, parsed.data.taskId, actor);
  return NextResponse.json({ ok: true }, { status: 200 });
});
