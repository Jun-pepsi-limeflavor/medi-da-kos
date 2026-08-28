import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { ConversationNotFoundError } from "@/lib/repo/conversations";
import { markThreadHandled, ThreadNotConnectedError, ThreadNotFoundError } from "@/lib/repo/threads";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: RouteContext<"/api/admin/threads/[threadKey]/handled">,
) {
  const { threadKey } = await context.params;
  return withAdmin(async (_request, actor) => {
    try {
      await markThreadHandled(threadKey, actor);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof ThreadNotFoundError || error instanceof ConversationNotFoundError) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      if (error instanceof ThreadNotConnectedError) {
        return NextResponse.json({ error: "thread is not connected to a conversation" }, { status: 409 });
      }
      throw error;
    }
  })(req);
}
