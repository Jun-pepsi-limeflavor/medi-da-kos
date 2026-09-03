import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { getMessage, updateMessageExtraction } from "@/lib/repo/messages";
import { runMessageExtraction } from "@/lib/extractor";

export const runtime = "nodejs";

export const POST = withAdmin(async (req: NextRequest) => {
  const match = req.nextUrl.pathname.match(
    /^\/api\/admin\/messages\/(.+)\/extract\/?$/,
  );
  if (!match) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const id = decodeURIComponent(match[1]);

  const message = await getMessage(id);
  if (!message) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }

  try {
    const { extraction, confidence } = await runMessageExtraction(
      message.bodyText,
      message.subject,
      message.from,
    );

    await updateMessageExtraction(id, extraction, confidence, "completed");

    return NextResponse.json({
      ok: true,
      extraction,
      confidence,
    });
  } catch (err: unknown) {
    const messageError = err instanceof Error ? err.message : String(err);
    console.error(`[extract route] Failed extracting message ${id}:`, messageError);

    // 실패 시 parseStatus를 failed로 갱신
    await updateMessageExtraction(id, {}, {}, "failed").catch(() => {});

    return NextResponse.json(
      { error: "extraction failed", details: messageError },
      { status: 500 },
    );
  }
});
