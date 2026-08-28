import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Factory,
  Link2,
  Mail,
  Paperclip,
} from "lucide-react";
import { listThreadMessages } from "@/lib/repo/messages";
import { listThreads } from "@/lib/repo/threads";
import type { Message } from "@/lib/schemas/message";
import type { Thread } from "@/lib/schemas/thread";

const CHANNEL_LABELS: Record<Thread["channel"], string> = {
  gmail_thomas: "Gmail · Thomas",
  gmail_hally: "Gmail · Hally",
  gmail_rheekw: "Gmail · Rheekw",
  gmail_songjh: "Gmail · Songjh",
  gmail_kimhs: "Gmail · Kimhs",
  gmail_parkjy: "Gmail · Parkjy",
  outlook_support: "Outlook · Support",
  channeltalk: "Channel Talk",
  web: "웹 문의",
};

const SIDE_LABELS: Record<Thread["side"], string> = {
  brand: "바이어",
  factory: "제조사",
  unknown: "상대 미확인",
};

function sideStyle(side: Thread["side"]): string {
  if (side === "brand") return "border-amber-800/80 bg-amber-950/50 text-amber-300";
  if (side === "factory") return "border-purple-800/80 bg-purple-950/50 text-purple-300";
  return "border-neutral-700 bg-neutral-900 text-neutral-400";
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function attachmentSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

type TimelineItem = {
  message: Message;
  thread: Thread;
  side: Thread["side"];
};

export default async function DealConversationTimeline({ dealId }: { dealId: string }) {
  const linkedThreads = (await listThreads()).filter((thread) => thread.dealId === dealId);
  const threadMessages = await Promise.all(
    linkedThreads.map(async (thread) => ({
      thread,
      messages: await listThreadMessages(thread.threadKey),
    })),
  );
  const timeline: TimelineItem[] = threadMessages.flatMap(({ thread, messages }) =>
    messages.map((message) => ({
      message,
      thread,
      side: thread.side === "unknown" ? message.side : thread.side,
    })),
  );
  timeline.sort((a, b) => a.message.sentAt.localeCompare(b.message.sentAt));

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-neutral-100">이 딜의 대화</h2>
            <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[10px] text-neutral-400">
              {linkedThreads.length}개 스레드 · {timeline.length}개 메시지
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            연결된 모든 바이어·제조사 스레드를 시간순으로 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />바이어</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" />제조사</span>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 text-center">
          <Factory className="h-5 w-5 text-neutral-700" />
          <p className="text-sm text-neutral-400">이 딜에 연결된 대화가 없습니다.</p>
          <p className="text-xs text-neutral-600">받은편지함에서 스레드를 이 딜에 연결하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="max-h-[min(720px,calc(100vh-300px))] overflow-y-auto p-4 sm:p-5">
          <div className="space-y-5">
            {timeline.map(({ message, thread, side }) => {
              const inbound = message.direction === "in";
              return (
                <article
                  key={`${thread.threadKey}:${message.id}`}
                  className={`flex gap-2.5 sm:gap-3 ${inbound ? "" : "flex-row-reverse"}`}
                >
                  <div className={`mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] ${side === "brand" ? "border-amber-800 bg-amber-950 text-amber-300" : side === "factory" ? "border-purple-800 bg-purple-950 text-purple-300" : "border-neutral-700 bg-neutral-900 text-neutral-500"}`}>
                    {inbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`min-w-0 max-w-[88%] sm:max-w-[78%] ${inbound ? "" : "items-end"}`}>
                    <div className={`mb-1.5 flex flex-wrap items-center gap-1.5 ${inbound ? "" : "justify-end"}`}>
                      <div className="min-w-0">
                        <div className={`flex flex-wrap items-center gap-1.5 ${inbound ? "" : "justify-end"}`}>
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${sideStyle(side)}`}>{SIDE_LABELS[side]}</span>
                          <span className="text-xs font-semibold text-neutral-200">{message.fromName || message.from}</span>
                          <span className="text-[10px] text-neutral-600">{inbound ? "수신" : "발신"}</span>
                        </div>
                        <p className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-600 ${inbound ? "" : "justify-end"}`}>
                          <Mail className="h-3 w-3" /> {CHANNEL_LABELS[thread.channel]} · {dateLabel(message.sentAt)}
                        </p>
                      </div>
                    </div>
                    <div className={`rounded-2xl border px-3.5 py-3 ${inbound ? "rounded-tl-sm border-neutral-800 bg-neutral-950/60" : "rounded-tr-sm border-indigo-900/70 bg-indigo-950/30"}`}>
                      {message.subject && <p className="text-xs font-medium text-neutral-400">{message.subject}</p>}
                      <p className={`${message.subject ? "mt-2 " : ""}whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300`}>{message.bodyText}</p>
                    </div>
                    {message.attachments.length > 0 && (
                      <div className={`mt-2 flex flex-wrap gap-1.5 ${inbound ? "" : "justify-end"}`}>
                        {message.attachments.map((attachment) => {
                          const attachmentLabel = <>
                            <Paperclip className="h-3 w-3 shrink-0 text-indigo-400" />
                            <span className="max-w-48 truncate">{attachment.filename}</span>
                            <span className="text-neutral-600">{attachmentSize(attachment.size)}</span>
                          </>;
                          const attachmentClass = "inline-flex max-w-full items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-[10px]";
                          return thread.channel.startsWith("gmail_") ? (
                            <a
                              key={attachment.attachmentId}
                              href={`/api/admin/messages/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(attachment.attachmentId)}`}
                              download={attachment.filename}
                              className={`${attachmentClass} text-neutral-400 transition-colors hover:border-indigo-700 hover:text-neutral-200`}
                            >
                              {attachmentLabel}
                            </a>
                          ) : (
                            <span key={attachment.attachmentId} className={`${attachmentClass} text-neutral-600`} title="이 제공자의 첨부 다운로드는 아직 지원하지 않습니다.">
                              {attachmentLabel}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <Link
                      href={`/admin/inbox/${encodeURIComponent(thread.threadKey)}`}
                      className={`mt-2 inline-flex items-center gap-1 text-[10px] text-indigo-400 transition-colors hover:text-indigo-300 ${inbound ? "" : "float-right"}`}
                    >
                      전체 스레드 <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
