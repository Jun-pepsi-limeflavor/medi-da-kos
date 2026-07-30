import { createHmac } from "crypto";
import { NextResponse } from "next/server";

function hashMemberId(memberId: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, "hex");
  return createHmac("sha256", key).update(memberId).digest("hex");
}

export async function POST(request: Request) {
  const secretKeyHex = process.env.CHANNEL_TALK_MEMBER_HASH_SECRET;
  if (!secretKeyHex) {
    return NextResponse.json({ memberHash: undefined });
  }

  let memberId: string | undefined;
  try {
    const body = (await request.json()) as { memberId?: string };
    memberId = body.memberId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!memberId || typeof memberId !== "string") {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }

  const memberHash = hashMemberId(memberId, secretKeyHex);

  return NextResponse.json({ memberHash });
}
