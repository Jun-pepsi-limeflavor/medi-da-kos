"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Info,
  Mail,
  Paperclip,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import type { ConversationDetail } from "@/lib/repo/conversations";
import { needsReply } from "@/lib/schemas/thread";

interface ConversationTimelineProps {
  detail: ConversationDetail | null;
  onOpenInspector?: () => void;
}

const CHANNEL_NAMES: Record<string, string> = {
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

export default function ConversationTimeline({
  detail,
}: ConversationTimelineProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedThreadKey, setSelectedThreadKey] = useState<string>(
    detail?.threads[0]?.threadKey || "",
  );
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [handling, setHandling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-neutral-950 p-8 text-center text-neutral-500">
        <Mail className="mb-3 h-10 w-10 text-neutral-700" />
        <h3 className="text-sm font-semibold text-neutral-400">대화를 선택해주세요</h3>
        <p className="text-xs text-neutral-500 mt-1">
          왼쪽 목록에서 고객 대화를 선택하여 메시지 타임라인과 답장 도구를 확인하세요.
        </p>
      </div>
    );
  }

  const { conversation, threads, messages } = detail;
  const activeThread = threads.find((t) => t.threadKey === selectedThreadKey) || threads[0];
  const isThreadPendingReply = activeThread ? needsReply(activeThread) : false;

  // Query param links for mobile navigation
  const queueParams = new URLSearchParams(searchParams.toString());
  queueParams.set("panel", "queue");

  const inspectorParams = new URLSearchParams(searchParams.toString());
  inspectorParams.set("panel", "inspector");

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThread || !replyText.trim() || sending) return;

    setSending(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(
        `/api/admin/threads/${encodeURIComponent(activeThread.threadKey)}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyText: replyText.trim() }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setActionError(err?.error || "답장 전송에 실패했습니다.");
        return;
      }

      setReplyText("");
      setActionSuccess("답장이 성공적으로 발송되었습니다.");
      router.refresh();
    } catch {
      setActionError("네트워크 오류가 발생했습니다. 중복 발송을 방지하기 위해 잠시 후 다시 확인해주세요.");
    } finally {
      setSending(false);
    }
  }

  async function handleMarkHandled() {
    if (!activeThread || handling) return;

    setHandling(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(
        `/api/admin/threads/${encodeURIComponent(activeThread.threadKey)}/handled`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setActionError(err?.error || "수동 처리 완료 실패");
        return;
      }

      setActionSuccess("스레드가 수동 처리 완료되었습니다.");
      router.refresh();
    } catch {
      setActionError("네트워크 오류가 발생했습니다.");
    } finally {
      setHandling(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-neutral-800 p-3.5 bg-neutral-900/60">
        <div className="flex items-center gap-2">
          {/* Mobile Back Button to Queue */}
          <Link
            href={`/admin/inbox?${queueParams.toString()}`}
            aria-label="목록으로 돌아가기"
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>

          <div>
            <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              {conversation.counterpartyLabel || "고객 대화"}
              {conversation.workflowState === "active" && (
                <span className="text-[10px] px-2 py-0.5 rounded border border-sky-800 bg-sky-950 text-sky-300 font-medium">
                  진행 중
                </span>
              )}
              {conversation.workflowState === "waiting_customer" && (
                <span className="text-[10px] px-2 py-0.5 rounded border border-amber-800 bg-amber-950 text-amber-300 font-medium">
                  고객 대기
                </span>
              )}
              {conversation.workflowState === "done" && (
                <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-800 bg-emerald-950 text-emerald-300 font-medium">
                  완료
                </span>
              )}
            </h2>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              총 {messages.length}개 메시지 · {threads.length}개 원문 스레드 연결
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Inspector Toggle */}
          <Link
            href={`/admin/inbox?${inspectorParams.toString()}`}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 min-h-[44px]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            상세 보기
          </Link>
        </div>
      </div>

      {/* Original Thread Selector Tabs (if multi-thread) */}
      {threads.length > 1 && (
        <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto border-b border-neutral-800/80 bg-neutral-900/40 px-3.5 py-2">
          <span className="text-[11px] font-semibold text-neutral-400 mr-1">스레드 선택:</span>
          {threads.map((t) => {
            const isSelected = (activeThread?.threadKey || "") === t.threadKey;
            const needs = needsReply(t);
            const channelLabel = CHANNEL_NAMES[t.channel] || t.channel;
            return (
              <button
                key={t.threadKey}
                type="button"
                onClick={() => setSelectedThreadKey(t.threadKey)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  isSelected
                    ? "bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                }`}
              >
                <span>{channelLabel}</span>
                {needs && (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" title="답장 필요" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Messages Timeline Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            수신된 메시지 원문이 없습니다.
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isInbound = msg.direction === "in";
            const channelName = CHANNEL_NAMES[msg.channel] || msg.channel;
            const sentDate = new Date(msg.sentAt);

            return (
              <div
                key={msg.id || idx}
                className={`rounded-xl border p-4 transition-all ${
                  isInbound
                    ? "border-neutral-800 bg-neutral-900/90 text-neutral-200 mr-4 sm:mr-12"
                    : "border-indigo-950/80 bg-indigo-950/20 text-neutral-100 ml-4 sm:ml-12"
                }`}
              >
                {/* Message Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold border ${
                        isInbound
                          ? "border-sky-800 bg-sky-950/60 text-sky-300"
                          : "border-indigo-700 bg-indigo-950/80 text-indigo-200"
                      }`}
                    >
                      {isInbound ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {isInbound ? "수신 (Inbound)" : "발신 (Outbound)"}
                    </span>

                    <span className="text-xs font-semibold text-neutral-100">
                      {msg.fromName ? `${msg.fromName} (${msg.from})` : msg.from}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="rounded bg-neutral-800/80 px-2 py-0.5 font-mono text-[10px]">
                      {channelName}
                    </span>
                    <time dateTime={msg.sentAt} title={sentDate.toLocaleString("ko-KR")}>
                      {sentDate.toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>

                {/* Subject & Detail Link */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <h4 className="text-xs font-bold text-neutral-100">
                    {msg.subject || "(제목 없음)"}
                  </h4>
                  <Link
                    href={`/admin/inbox/${encodeURIComponent(msg.threadKey)}`}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 shrink-0"
                  >
                    원문 / 인테이크 추출 확인 &rarr;
                  </Link>
                </div>

                {/* Message Body Content */}
                {msg.bodyText ? (
                  <div className="mt-2.5 rounded-lg bg-neutral-950/70 p-3.5 text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap font-sans break-words border border-neutral-800/60 select-text max-h-[500px] overflow-y-auto">
                    {msg.bodyText}
                  </div>
                ) : (
                  <div className="mt-1 text-xs italic text-neutral-500 py-1">
                    (본문 내용이 비어있습니다)
                  </div>
                )}

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2 pt-2 border-t border-neutral-800/60">
                    {msg.attachments.map((att, attIdx) => (
                      <span
                        key={att.attachmentId || attIdx}
                        className="inline-flex items-center gap-1.5 rounded-md bg-neutral-800/80 px-2.5 py-1 text-[11px] text-neutral-300 border border-neutral-700/50"
                      >
                        <Paperclip className="h-3 w-3 text-neutral-400" />
                        <span className="max-w-[240px] truncate">{att.filename}</span>
                        <span className="text-neutral-500 text-[10px]">
                          ({Math.max(1, Math.round(att.size / 1024))} KB)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Action and Reply Box */}
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/90 p-3 sm:p-4 space-y-3">
        {/* Status Alerts */}
        {actionError && (
          <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/80 px-3 py-2 text-xs text-rose-300">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/80 px-3 py-2 text-xs text-emerald-300">
            {actionSuccess}
          </div>
        )}

        {/* Action Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-200">
              {activeThread ? `${CHANNEL_NAMES[activeThread.channel] || activeThread.channel} 회신` : "답장"}
            </span>
            {isThreadPendingReply && (
              <span className="text-[10px] rounded bg-rose-950 text-rose-300 border border-rose-900 px-1.5 py-0.5 font-medium">
                답장 대기 중
              </span>
            )}
          </div>

          {activeThread && (
            <button
              type="button"
              onClick={handleMarkHandled}
              disabled={handling}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 disabled:opacity-50 min-h-[36px]"
            >
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              {handling ? "처리 중…" : "수동 처리 완료"}
            </button>
          )}
        </div>

        {/* Reply Form */}
        <form onSubmit={handleSendReply} className="space-y-2.5">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={sending || !activeThread}
            placeholder={
              activeThread
                ? "고객에게 발송할 답장 내용을 입력하세요…"
                : "회신할 스레드가 없습니다"
            }
            rows={3}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-xs leading-5 text-neutral-100 placeholder:text-neutral-500 outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:opacity-50"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 flex items-center gap-1">
              <Info className="h-3 w-3" />
              원문 메시지의 스레드 정보(In-Reply-To, References)가 유지되어 안전하게 전송됩니다.
            </span>

            <button
              type="submit"
              disabled={sending || !replyText.trim() || !activeThread}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "발송 중…" : "답장 발송"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
