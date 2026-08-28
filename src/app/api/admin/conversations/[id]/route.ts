import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import {
  ConversationNotFoundError,
  getConversationDetail,
  patchConversation,
} from "@/lib/repo/conversations";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: RouteContext<"/api/admin/conversations/[id]">) {
  const { id } = await context.params;
  return withAdmin(async () => {
    const detail = await getConversationDetail(id);
    return detail
      ? NextResponse.json(detail)
      : NextResponse.json({ error: "conversation not found" }, { status: 404 });
  })(req);
}

export async function PATCH(req: NextRequest, context: RouteContext<"/api/admin/conversations/[id]">) {
  const { id } = await context.params;
  return withAdmin(async (request, actor) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid input" }, { status: 400 });
    }
    try {
      await patchConversation(id, body, actor);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "invalid input", issues: error.issues }, { status: 400 });
      }
      if (error instanceof ConversationNotFoundError) {
        return NextResponse.json({ error: "conversation not found" }, { status: 404 });
      }
      throw error;
    }
  })(req);
}
