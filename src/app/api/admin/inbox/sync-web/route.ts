import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withAdmin } from "@/lib/with-admin";
import { syncAllWebSubmissions } from "@/lib/repo/web-inbound";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async () => {
  try {
    const summary = await syncAllWebSubmissions();
    revalidatePath("/admin/inbox");
    revalidatePath("/admin/intakes");

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    console.error("[api/admin/inbox/sync-web] error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "동기화 실패",
      },
      { status: 500 },
    );
  }
});
