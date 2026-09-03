import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/with-admin";
import { listThreadMessages, updateMessageExtraction } from "@/lib/repo/messages";
import { getThread, listThreadsByConversation } from "@/lib/repo/threads";
import { runThreadExtraction } from "@/lib/extractor";
import type { Message } from "@/lib/schemas/message";

export const runtime = "nodejs";

export const POST = withAdmin(async (req: NextRequest) => {
  const match = req.nextUrl.pathname.match(
    /^\/api\/admin\/threads\/(.+)\/extract\/?$/,
  );
  if (!match) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const threadKey = decodeURIComponent(match[1]);

  const currentThread = await getThread(threadKey);
  let messages: Message[] = [];

  if (currentThread?.conversationId) {
    // 동일 고객 대화(Conversation)에 속한 모든 형제 스레드 메시지 통합 취합
    const siblingThreads = await listThreadsByConversation(currentThread.conversationId);
    const messagesPerThread = await Promise.all(
      siblingThreads.map((t) => listThreadMessages(t.threadKey)),
    );
    messages = messagesPerThread.flat();
  } else {
    messages = await listThreadMessages(threadKey);
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "no messages in thread" }, { status: 404 });
  }

  // 시간순 정렬
  messages.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));

  try {
    const { extraction, confidence } = await runThreadExtraction(messages);

    // 최신 인바운드 메시지(또는 가장 최신 메시지)에 추출 결과를 저장
    const latestInbound = [...messages].reverse().find((m) => m.direction !== "out") || messages[messages.length - 1];
    if (latestInbound) {
      await updateMessageExtraction(latestInbound.id, extraction, confidence, "completed");
    }

    return NextResponse.json({
      ok: true,
      extraction,
      confidence,
      targetMessageId: latestInbound?.id,
      messageCount: messages.length,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[thread extract route] Failed extracting thread ${threadKey}:`, errorMessage);

    return NextResponse.json(
      { error: "thread extraction failed", details: errorMessage },
      { status: 500 },
    );
  }
});
