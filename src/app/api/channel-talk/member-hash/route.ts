import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { memberHashResponse } from "@/lib/channel-talk-member-hash";

// 로그인한 본인 uid의 memberHash만 준다(Authorization: Bearer <Firebase ID 토큰>). 판정은 memberHashResponse.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  const result = await memberHashResponse({
    authorization: request.headers.get("authorization"),
    body,
    secretKeyHex: process.env.CHANNEL_TALK_MEMBER_HASH_SECRET,
    verifyIdToken: (idToken) => getAdminAuth().verifyIdToken(idToken),
  });

  return NextResponse.json(result.body, { status: result.status });
}
