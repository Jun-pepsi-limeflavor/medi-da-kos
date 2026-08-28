import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import {
  classifyIdentity,
  ConversationEntityNotFoundError,
  ConversationIdentityNotFoundError,
  ConversationNotFoundError,
  ConversationRelationConflictError,
} from "@/lib/repo/conversations";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: RouteContext<"/api/admin/conversation-identities/[identityId]/classify">,
) {
  const { identityId } = await context.params;
  return withAdmin(async (request, actor) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid input" }, { status: 400 });
    }
    try {
      await classifyIdentity(identityId, body, actor);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "invalid input", issues: error.issues }, { status: 400 });
      }
      if (
        error instanceof ConversationIdentityNotFoundError
        || error instanceof ConversationNotFoundError
        || error instanceof ConversationEntityNotFoundError
      ) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      if (error instanceof ConversationRelationConflictError) {
        return NextResponse.json({ error: "conflicting link" }, { status: 409 });
      }
      throw error;
    }
  })(req);
}
