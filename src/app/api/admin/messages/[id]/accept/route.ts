import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { extractionSchema } from "@/lib/schemas/extraction";
import { getMessage, acceptMessageExtraction } from "@/lib/repo/messages";
import { getThread } from "@/lib/repo/threads";
import { syncDealFromAcceptedExtraction } from "@/lib/repo/deals";
import type { AdminIdentity } from "@/lib/admin-auth";

export const runtime = "nodejs";

export const POST = withAdmin(async (req: NextRequest, actor: AdminIdentity) => {
  const match = req.nextUrl.pathname.match(
    /^\/api\/admin\/messages\/(.+)\/accept\/?$/,
  );
  if (!match) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const id = decodeURIComponent(match[1]);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("accepted" in body)) {
    return NextResponse.json(
      { error: "accepted field is required" },
      { status: 400 },
    );
  }

  const parsed = extractionSchema.safeParse(body.accepted);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid extraction", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const message = await getMessage(id);
  if (!message) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }

  await acceptMessageExtraction(id, parsed.data, actor.email);

  let syncedDealId: string | null = null;
  let syncedDealReference: string | null = null;

  if (message.threadKey) {
    const thread = await getThread(message.threadKey);
    if (thread?.dealId) {
      try {
        const syncRes = await syncDealFromAcceptedExtraction(
          thread.dealId,
          parsed.data,
          actor.email,
          id,
          message.threadKey,
        );
        syncedDealId = syncRes.deal.id;
        syncedDealReference = syncRes.deal.reference;
      } catch (syncErr) {
        console.warn("[accept] failed to sync to linked deal:", syncErr);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    syncedDealId,
    syncedDealReference,
  });
});

