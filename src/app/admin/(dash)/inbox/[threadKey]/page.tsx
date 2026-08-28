import { applyAddressMatch, getThread } from "@/lib/repo/threads";
import { listThreadMessages } from "@/lib/repo/messages";
import { getIntakeReview, setIntakeReview } from "@/lib/repo/intake-reviews";
import { isApprovedGmailMailbox } from "@/lib/gmail-auth";
import type { Message } from "@/lib/schemas/message";
import type { IntakeReview } from "@/lib/schemas/intake-review";
import { requireAdminPage } from "@/lib/admin-page";
import ThreadActions from "../ThreadActions";
import ExtractionPanel from "./ExtractionPanel";
import ThreadReplyForm from "./ThreadReplyForm";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  Download,
  Factory,
  Link2,
  Mail,
  Paperclip,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatDatetime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

const CHANNEL_LABELS: Record<Message["channel"], string> = {
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

const SIDE_LABELS: Record<Message["side"], string> = {
  brand: "바이어 대화",
  factory: "제조사 대화",
  unknown: "상대 판정 필요",
};

function sideBadgeStyle(side: Message["side"]): string {
  if (side === "brand") return "border-sky-800/80 bg-sky-950/70 text-sky-300";
  if (side === "factory") return "border-emerald-800/80 bg-emerald-950/70 text-emerald-300";
  return "border-amber-800/80 bg-amber-950/70 text-amber-300";
}

function attachmentSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ threadKey: string }>;
}) {
  const { threadKey } = await params;
  const decodedKey = decodeURIComponent(threadKey);

  const actor = await requireAdminPage();

  const rawThread = await getThread(decodedKey);
  if (!rawThread) {
    return (
      <div className="space-y-6">
        <Link href="/admin/inbox" className="text-xs text-neutral-400 hover:text-neutral-200">
          ← 돌아가기
        </Link>
        <p className="text-sm text-neutral-500">스레드를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const messages = await listThreadMessages(decodedKey);

  // Task 3 Step 1 — 열 때마다 상대 주소를 다시 대조한다. 나중에 바이어가
  // 등록되면 다음 열람에서 자동으로 side가 올라간다.
  const { thread, counterpartyEmail, buyerCandidate, supplierCandidate } =
    await applyAddressMatch(rawThread, messages);

  // 최신 인바운드 메시지(앵커 메시지) 탐색
  const anchorMessage =
    [...messages].reverse().find((m) => m.direction === "in") ??
    messages[messages.length - 1] ??
    null;

  // Task 3 Step 4 — web 채널은 폼 제출 쪽 인테이크가 따로 있다. 메일함
  // 채널(gmail_*·outlook_*·channeltalk)로 들어온 스레드를 처음 열었을 때만
  // raw 판정을 만든다. 이미 있으면 손대지 않는다 — 상태를 덮지 않는다.
  let existingReview: IntakeReview | null = null;
  if (thread.channel !== "web") {
    existingReview = await getIntakeReview("message", decodedKey);
    if (!existingReview) {
      existingReview = await setIntakeReview(
        "message",
        decodedKey,
        {
          sourceRef: `threads/${decodedKey}`,
          status: "raw",
          reason: "",
          isTest: false,
          isTestReason: "",
        },
        actor,
      );
    }
  }

  const latestMessage = messages[messages.length - 1];
  const conversationName =
    latestMessage?.fromName || latestMessage?.from || counterpartyEmail || "알 수 없는 상대";
  const dealHref = thread.dealId ? `/admin/deals/${encodeURIComponent(thread.dealId)}` : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <Link
          href="/admin/inbox"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 받은편지함
        </Link>
        <span className="text-[11px] text-neutral-600">원문 {messages.length}개</span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70">
        <div className="flex flex-col gap-4 border-b border-neutral-800 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-sm font-semibold text-neutral-100">
              {conversationName.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold text-white">{conversationName}</h1>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${sideBadgeStyle(thread.side)}`}>
                  {thread.side === "brand" ? <Building2 className="mr-1 inline h-3 w-3" /> : <Factory className="mr-1 inline h-3 w-3" />}
                  {SIDE_LABELS[thread.side]}
                </span>
                {thread.linkState === "linked" && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-indigo-800/80 bg-indigo-950/50 px-2 py-0.5 text-[10px] text-indigo-300">
                    <Link2 className="h-3 w-3" /> 연결됨
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-neutral-500">
                {counterpartyEmail || latestMessage?.from || "상대 주소를 확인할 수 없습니다."}
              </p>
            </div>
            {dealHref ? (
              <Link
                href={dealHref}
                className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-indigo-800/80 bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-900/50 sm:inline-flex"
              >
                <Link2 className="h-3.5 w-3.5" /> 딜 보기
              </Link>
            ) : (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-500 sm:inline-flex">
                <Link2 className="h-3.5 w-3.5" /> 딜 미연결
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-neutral-600" />{CHANNEL_LABELS[thread.channel]}</span>
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate"><ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />{thread.sourceAccount}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-neutral-600" />최근 {formatDatetime(thread.lastMessageAt)}</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />{thread.readState === "read" ? "읽음" : "읽지 않음"}</span>
          </div>
        </div>
        <div className="border-b border-neutral-800 bg-neutral-950/25 px-4 py-3 sm:px-5">
          <ThreadActions
            thread={thread}
            counterpartyEmail={counterpartyEmail}
            buyerCandidate={buyerCandidate ? { id: buyerCandidate.id, name: buyerCandidate.name } : null}
            supplierCandidate={supplierCandidate ? { id: supplierCandidate.id, companyName: supplierCandidate.companyName } : null}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/30">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">대화 기록</h2>
              <p className="mt-0.5 text-[11px] text-neutral-500">시간순 원문 · {messages.length}개 메시지</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600"><Paperclip className="h-3.5 w-3.5" />첨부 포함</span>
          </div>
          {messages.length === 0 ? (
            <p className="p-6 text-center text-xs text-neutral-500">메시지가 없습니다.</p>
          ) : (
            <div className="max-h-[min(760px,calc(100vh-250px))] space-y-5 overflow-y-auto p-4 sm:p-5">
              {messages.map((msg: Message) => {
                const isInbound = msg.direction === "in";
                return (
                  <article key={msg.id} className={`flex gap-3 ${isInbound ? "" : "flex-row-reverse"}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${isInbound ? "border border-neutral-700 bg-neutral-800 text-neutral-200" : "border border-indigo-800/80 bg-indigo-950/60 text-indigo-300"}`}>
                      {isInbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className={`min-w-0 max-w-[90%] sm:max-w-[82%] ${isInbound ? "" : "items-end"}`}>
                      <div className={`mb-1.5 flex flex-wrap items-center gap-2 ${isInbound ? "" : "justify-end"}`}>
                        <span className="text-xs font-semibold text-neutral-200">{msg.fromName || msg.from}</span>
                        <span className="text-[10px] text-neutral-600">{formatDatetime(msg.sentAt)}</span>
                        {anchorMessage && msg.id === anchorMessage.id && (
                          <span className="rounded border border-indigo-800 bg-indigo-950/60 px-1.5 py-0.5 text-[10px] text-indigo-300">추출 대상</span>
                        )}
                      </div>
                      <div className={`rounded-2xl border px-3.5 py-3 text-sm leading-6 text-neutral-200 ${isInbound ? "rounded-tl-sm border-neutral-800 bg-neutral-900" : "rounded-tr-sm border-indigo-900/70 bg-indigo-950/35"}`}>
                        {msg.subject && <p className="mb-2 text-xs font-semibold text-neutral-400">{msg.subject}</p>}
                        <p className="whitespace-pre-wrap break-words">{msg.bodyText}</p>
                      </div>
                      {msg.attachments.length > 0 && (
                        <div className={`mt-2 grid gap-1.5 ${isInbound ? "" : "justify-items-end"}`}>
                          {msg.attachments.map((att) => {
                            const attachmentLabel = <>
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                              <span className="truncate">{att.filename}</span>
                              <span className="shrink-0 text-[10px] text-neutral-600">{attachmentSize(att.size)}</span>
                            </>;
                            const attachmentClass = "inline-flex max-w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-300";
                            return thread.channel.startsWith("gmail_") ? (
                              <a
                                key={att.attachmentId}
                                href={`/api/admin/messages/${encodeURIComponent(msg.id)}/attachments/${encodeURIComponent(att.attachmentId)}`}
                                download={att.filename}
                                className={`${attachmentClass} transition-colors hover:border-indigo-700 hover:bg-neutral-800 hover:text-white`}
                              >
                                {attachmentLabel}<Download className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                              </a>
                            ) : (
                              <span key={att.attachmentId} className={`${attachmentClass} text-neutral-500`} title="이 제공자의 첨부 다운로드는 아직 지원하지 않습니다.">
                                {attachmentLabel}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {thread.channel.startsWith("gmail_") && isApprovedGmailMailbox(thread.sourceAccount) && (
            <ThreadReplyForm threadKey={decodedKey} />
          )}
        </section>

        <div className="xl:sticky xl:top-6">
          {anchorMessage ? (
            <ExtractionPanel
              anchorMessage={anchorMessage}
              threadKey={decodedKey}
              thread={thread}
              intakeReview={existingReview}
            />
          ) : (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
              분석할 수신 메시지가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
