import "server-only";
import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildReplyMime, sendMessage } from "../../../../../../../functions-ingest/gmail.js";
import { getGmailToken, isApprovedGmailMailbox } from "@/lib/gmail-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getThread } from "@/lib/repo/threads";
import { listThreadMessages } from "@/lib/repo/messages";
import { withAdmin } from "@/lib/with-admin";
import type { Message } from "@/lib/schemas/message";

export const runtime = "nodejs";

const replyInputSchema = z.object({
  bodyText: z.string().trim().min(1).max(100_000),
}).strict();

type StoredProviderMetadata = {
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

function getPathThreadKey(req: NextRequest): string | null {
  const match = req.nextUrl.pathname.match(/\/threads\/([^/]+)\/reply\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
}

function replySubject(subject: string): string {
  const clean = subject.replace(/[\r\n]/g, " ").trim() || "Medidakos inquiry";
  return /^re\s*:/i.test(clean) ? clean : `Re: ${clean}`;
}

function getReferences(message: Message & StoredProviderMetadata): string {
  const references = message.references?.trim();
  const messageId = message.messageId?.trim();
  if (references && messageId && !references.split(/\s+/).includes(messageId)) {
    return `${references} ${messageId}`;
  }
  return references || messageId || "";
}

async function persistOutboundReply(params: {
  threadKey: string;
  thread: Awaited<ReturnType<typeof getThread>>;
  recipient: string;
  subject: string;
  bodyText: string;
  provider: { id: string; threadId: string; historyId: string };
  messageId: string;
}): Promise<void> {
  if (!params.thread) throw new Error("thread not found");
  const db = getAdminDb();
  const now = new Date().toISOString();
  const messageDocId = `${params.thread.channel}:${params.provider.id}`;
  const messageRef = db.collection("messages").doc(messageDocId);
  const threadRef = db.collection("threads").doc(params.threadKey);

  await db.runTransaction(async (tx) => {
    const [threadSnap, messageSnap] = await Promise.all([
      tx.get(threadRef),
      tx.get(messageRef),
    ]);
    if (!threadSnap.exists) throw new Error("thread disappeared before reply was saved");

    if (!messageSnap.exists) {
      tx.create(messageRef, {
        channel: params.thread!.channel,
        side: params.thread!.side,
        sideSource: params.thread!.sideSource,
        sourceAccount: params.thread!.sourceAccount,
        externalId: params.provider.id,
        providerThreadId: params.provider.threadId,
        threadKey: params.threadKey,
        historyId: params.provider.historyId,
        direction: "out",
        from: params.thread!.sourceAccount,
        fromName: "Medidakos",
        to: [params.recipient],
        subject: params.subject,
        bodyText: params.bodyText,
        attachments: [],
        sentAt: now,
        messageId: params.messageId,
        parseStatus: "pending",
        createdAt: now,
        sourceUpdatedAt: now,
      });
    }

    // Update only provider activity. Human-owned link, side, read, and triage
    // state remain untouched by a reply.
    tx.update(threadRef, {
      lastMessageAt: now,
      lastDirection: "out",
      updatedAt: now,
    });
  });
}

export const POST = withAdmin(async (req) => {
  const threadKey = getPathThreadKey(req);
  if (!threadKey) return NextResponse.json({ error: "threadKey required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = replyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid reply", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const thread = await getThread(threadKey);
  if (!thread) return NextResponse.json({ error: "thread not found" }, { status: 404 });

  if (thread.channel === "channeltalk") {
    const accessKey = process.env.CHANNELTALK_ACCESS_KEY;
    const accessSecret = process.env.CHANNELTALK_ACCESS_SECRET;
    const channelVersion = process.env.CHANNELTALK_CHANNEL_VERSION || "5";

    if (!accessKey || !accessSecret) {
      return NextResponse.json({ error: "Channel Talk credentials not configured" }, { status: 500 });
    }

    const { sendChatMessage } = await import("../../../../../../../functions-ingest/channeltalk.js");
    let sentMsg: any;
    try {
      sentMsg = await sendChatMessage(
        thread.providerThreadId,
        { plainText: parsed.data.bodyText },
        { accessKey, accessSecret, channelVersion },
      );
    } catch (err: any) {
      return NextResponse.json(
        { error: `Channel Talk send failed: ${err?.message || "unknown"}` },
        { status: 502 },
      );
    }

    const provider = {
      id: sentMsg.id || `ct-msg-${Date.now()}`,
      threadId: thread.providerThreadId,
      historyId: String(sentMsg.version ?? sentMsg.id ?? Date.now()),
    };
    const messageId = provider.id;

    try {
      await persistOutboundReply({
        threadKey,
        thread,
        recipient: thread.sourceAccount,
        subject: "Channel Talk Reply",
        bodyText: parsed.data.bodyText,
        provider,
        messageId,
      });
    } catch {
      return NextResponse.json(
        { error: "reply was sent but could not be linked; do not retry this reply" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      threadKey,
      messageId: provider.id,
    });
  }

  if (!thread.channel.startsWith("gmail_")) {
    return NextResponse.json({ error: "this thread does not support Gmail or Channel Talk replies" }, { status: 409 });
  }
  const expectedChannel = `gmail_${thread.sourceAccount.split("@")[0]}`;
  if (thread.channel !== expectedChannel) {
    return NextResponse.json({ error: "thread mailbox and channel do not match" }, { status: 409 });
  }
  if (!isApprovedGmailMailbox(thread.sourceAccount)) {
    return NextResponse.json({ error: "mailbox is not approved for replies" }, { status: 409 });
  }

  const messages = await listThreadMessages(threadKey);
  const latestInbound = [...messages]
    .filter((message) => message.direction === "in")
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    .at(-1) as (Message & StoredProviderMetadata) | undefined;
  if (!latestInbound || !isEmail(latestInbound.from)) {
    return NextResponse.json({ error: "no valid inbound recipient in thread" }, { status: 409 });
  }

  const messageId = `<mdk-${randomUUID()}@medidakos.com>`;
  const references = getReferences(latestInbound);
  const subject = replySubject(latestInbound.subject);
  const raw = buildReplyMime({
    from: thread.sourceAccount,
    to: latestInbound.from,
    subject,
    bodyText: parsed.data.bodyText,
    inReplyTo: latestInbound.messageId,
    references,
    messageId,
  });

  // Token purpose and mailbox are selected from the stored thread. No client
  // field can choose the sender or request a different delegated subject.
  const token = await getGmailToken(thread.sourceAccount, { purpose: "send" });
  const provider = await sendMessage(token, {
    raw,
    threadId: thread.providerThreadId,
  });
  if (provider.threadId !== thread.providerThreadId) {
    return NextResponse.json(
      { error: "provider returned a different thread; do not retry this reply" },
      { status: 502 },
    );
  }

  try {
    await persistOutboundReply({
      threadKey,
      thread,
      recipient: latestInbound.from,
      subject,
      bodyText: parsed.data.bodyText,
      provider,
      messageId,
    });
  } catch {
    // Gmail accepted the send. Returning a normal retriable server error here
    // could make an admin produce a duplicate; the scheduled poll will later
    // reconcile the provider message by its deterministic ID.
    return NextResponse.json(
      { error: "reply was sent but could not be linked; do not retry this reply" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    threadKey,
    messageId: provider.id,
  });
});
