import { listThreads, type ThreadFilters } from "@/lib/repo/threads";
import { listThreadMessages } from "@/lib/repo/messages";
import type { Thread } from "@/lib/schemas/thread";
import { needsReply } from "@/lib/schemas/thread";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR");
}

function getSideBadgeStyle(side: Thread["side"]): string {
  if (side === "brand") return "bg-blue-900 border-blue-700 text-blue-200";
  if (side === "factory") return "bg-green-900 border-green-700 text-green-200";
  return "bg-yellow-900 border-yellow-700 text-yellow-200"; // unknown
}

interface ThreadWithAttachments extends Thread {
  hasAttachments: boolean;
  senderName: string;
  subject: string;
  bodySnippet: string;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Parse filters from URL
  const filters: ThreadFilters = {};
  if (params.readState && typeof params.readState === "string") {
    filters.readState = params.readState as Thread["readState"];
  }
  if (params.triageState && typeof params.triageState === "string") {
    filters.triageState = params.triageState as Thread["triageState"];
  }
  if (params.linkState && typeof params.linkState === "string") {
    filters.linkState = params.linkState as Thread["linkState"];
  }
  if (params.side && typeof params.side === "string") {
    filters.side = params.side as Thread["side"];
  }
  if (params.channel && typeof params.channel === "string") {
    filters.channel = params.channel as Thread["channel"];
  }
  if (params.needsReply === "true") filters.needsReply = true;

  const threads = await listThreads(filters);

  // 목록 한 줄에 보일 발신자·제목·본문 미리보기·첨부 여부 — 마지막 메시지 기준.
  // listThreadMessages()는 sentAt 오름차순이라 배열의 마지막이 최신이다.
  const threadsWithAttachments: ThreadWithAttachments[] = await Promise.all(
    threads.map(async (thread) => {
      const messages = await listThreadMessages(thread.threadKey);
      const hasAttachments = messages.some(
        (msg) => msg.attachments && msg.attachments.length > 0
      );
      const latest = messages[messages.length - 1];
      return {
        ...thread,
        hasAttachments,
        senderName: latest?.fromName || latest?.from || thread.sourceAccount,
        subject: latest?.subject ?? "",
        bodySnippet: (latest?.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h1 className="text-lg font-semibold">받은편지함 {threadsWithAttachments.length}개</h1>
      </div>

      {threadsWithAttachments.length === 0 ? (
        <p className="text-sm text-neutral-500">스레드가 없습니다.</p>
      ) : (
        <div className="space-y-1 divide-y divide-neutral-900">
          {threadsWithAttachments.map((thread) => {
            const lastMessageTime = new Date(thread.lastMessageAt);
            const isUnread = thread.readState === "unread";
            const needs = needsReply(thread);
            const dotColor = needs ? "text-yellow-400" : "text-neutral-600";

            return (
              <Link key={thread.threadKey} href={`/admin/inbox/${encodeURIComponent(thread.threadKey)}`}>
                <div
                  className={`py-3 px-4 cursor-pointer hover:bg-neutral-900 transition-colors ${
                    isUnread ? "font-semibold bg-neutral-900/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-base ${dotColor}`}>●</span>
                    <span className="flex-1 text-sm truncate">{thread.senderName}</span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${getSideBadgeStyle(thread.side)}`}
                    >
                      {thread.side}
                    </span>
                    <span className="text-[11px] text-neutral-500 w-24">
                      {thread.channel}
                    </span>
                    {thread.hasAttachments && <span className="text-sm">📎</span>}
                    <span className="text-xs text-neutral-500 w-16 text-right">
                      {formatRelativeTime(lastMessageTime)}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 truncate ml-7">
                    {thread.subject && <span className="text-neutral-300">{thread.subject}</span>}
                    {thread.subject && thread.bodySnippet && " — "}
                    {thread.bodySnippet}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
