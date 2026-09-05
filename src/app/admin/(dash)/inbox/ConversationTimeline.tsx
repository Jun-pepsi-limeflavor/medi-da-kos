"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Forward,
  Mail,
  SlidersHorizontal,
} from "lucide-react";
import type { ConversationDetail } from "@/lib/repo/conversations";
import MessageBodyClean from "./MessageBodyClean";
import ThreadReplyForm from "./[threadKey]/ThreadReplyForm";
import { isForwardedMessage } from "./ReviewQueue";

interface ConversationTimelineProps {
  detail: ConversationDetail | null;
}

const CHANNEL_NAMES: Record<string, string> = {
  gmail_thomas: "Thomas",
  gmail_hally: "Hally",
  gmail_support: "Support",
  gmail_rheekw: "Rheekw",
  gmail_songjh: "Songjh",
  gmail_kimhs: "Kimhs",
  gmail_parkjy: "Parkjy",
  outlook_support: "Support",
  channeltalk: "채널톡",
  web: "웹 문의",
};

export default function ConversationTimeline({
  detail,
}: ConversationTimelineProps) {
  const searchParams = useSearchParams();

  const [expandedForwards, setExpandedForwards] = useState<Record<string, boolean>>({});

  function toggleForward(id: string) {
    setExpandedForwards((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
  const activeThread = threads[0];
  
  // Query param links for mobile navigation
  const queueParams = new URLSearchParams(searchParams.toString());
  queueParams.set("panel", "queue");

  const inspectorParams = new URLSearchParams(searchParams.toString());
  inspectorParams.set("panel", "inspector");

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      {/* Header Bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-900/70 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Back to Queue */}
          <Link
            href={`/admin/inbox?${queueParams.toString()}`}
            aria-label="대화 목록으로 돌아가기"
            className="lg:hidden inline-flex items-center justify-center p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 min-h-[36px] min-w-[36px]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-100 truncate max-w-[200px] sm:max-w-[320px]">
                {conversation.counterpartyLabel || "알 수 없는 고객"}
              </h2>
              <span className="text-[11px] font-mono text-neutral-500">
                총 {messages.length}건
              </span>
            </div>
            {(conversation.lastSubject || conversation.lastSnippet) && (
              <p className="text-xs text-neutral-400 truncate max-w-[240px] sm:max-w-[400px]">
                {conversation.lastSubject || conversation.lastSnippet}
              </p>
            )}
          </div>
        </div>

        {/* Right side controls: Mobile inspector button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Button to open Inspector Panel */}
          <Link
            href={`/admin/inbox?${inspectorParams.toString()}`}
            aria-label="대화 상세 설정 열기"
            className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 min-h-[44px]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-xs">인스펙터</span>
          </Link>
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-neutral-500">
            <Mail className="mb-2 h-8 w-8 text-neutral-700" />
            <p>이 대화에 등록된 메시지가 없습니다.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isInbound = msg.direction === "in";
            const isAutomation = msg.authorRole === "automation";
            const channelName = CHANNEL_NAMES[msg.channel] || msg.channel;
            const sentDate = new Date(msg.sentAt);
            const isFwd = isForwardedMessage(msg);
            const isFwdExpanded = expandedForwards[msg.id || String(idx)];

            if (isFwd && !isFwdExpanded) {
              return (
                <div key={msg.id || idx} className="flex justify-center my-2">
                  <button
                    type="button"
                    onClick={() => toggleForward(msg.id || String(idx))}
                    className="inline-flex items-center gap-2 rounded-full border border-purple-900/50 bg-purple-950/30 px-3.5 py-1.5 text-[11px] text-purple-300 hover:bg-purple-950/60 hover:text-purple-200 hover:border-purple-700/60 transition-all shadow-sm group"
                  >
                    <Forward className="h-3.5 w-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                    <span>
                      사내 전달: {msg.fromName ? `${msg.fromName} (${msg.from.split("@")[0]})` : msg.from} ➔ {msg.to?.map(e => e.split("@")[0]).join(", ") || "내부"}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {sentDate.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-purple-400 font-semibold ml-1">펼치기 ▾</span>
                  </button>
                </div>
              );
            }

            return (
              <div
                key={msg.id || idx}
                className={`flex w-full ${
                  isInbound
                    ? "justify-start pr-6 sm:pr-16"
                    : "justify-end pl-6 sm:pl-16"
                }`}
              >
                <div
                  className={`w-full max-w-[90%] sm:max-w-[84%] rounded-2xl border p-4.5 transition-all space-y-3.5 shadow-md ${
                    isFwd
                      ? "border-purple-900/60 bg-purple-950/20 text-neutral-100 rounded-tr-sm"
                      : isInbound
                        ? "border-neutral-800 bg-neutral-900/90 text-neutral-200 rounded-tl-sm"
                        : "border-indigo-900/50 bg-indigo-950/25 text-neutral-100 rounded-tr-sm"
                  }`}
                >
                  {/* Forward Header if expanded */}
                  {isFwd && (
                    <div className="flex items-center justify-between border-b border-purple-900/50 pb-2 text-[10px] text-purple-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Forward className="h-3 w-3 text-purple-400" />
                        사내 포워딩 메시지
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleForward(msg.id || String(idx))}
                        className="text-purple-400 hover:text-purple-200 underline font-medium"
                      >
                        접기 ▴
                      </button>
                    </div>
                  )}

                  {/* Message Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                          isInbound
                            ? "border-sky-800 bg-sky-950/80 text-sky-300"
                            : "border-indigo-700 bg-indigo-950/90 text-indigo-200"
                        }`}
                      >
                        {isInbound ? (
                          <ArrowDownLeft className="h-3 w-3" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        {isInbound ? "수신 (Inbound)" : "발신 (Outbound)"}
                      </span>

                      <span className="text-xs font-semibold text-neutral-100 truncate max-w-[200px]">
                        {isAutomation ? "자동 안내" : msg.fromName ? `${msg.fromName} (${msg.from})` : msg.from}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <span className="rounded bg-neutral-800/80 px-2 py-0.5 font-mono text-[10px] border border-neutral-700/50">
                        {channelName}
                      </span>
                      <time dateTime={msg.sentAt} title={sentDate.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}>
                        {sentDate.toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Seoul",
                        })}
                      </time>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-neutral-100 truncate">
                      {msg.subject || "(제목 없음)"}
                    </h4>
                  </div>

                  {/* Message Body & Media Content */}
                  <div className="rounded-xl bg-neutral-950/80 p-4 text-xs leading-relaxed text-neutral-200 font-sans break-words border border-neutral-800/60 select-text">
                    <MessageBodyClean
                      bodyText={msg.bodyText || ""}
                      attachments={msg.attachments}
                      messageId={msg.id}
                      isGmail={msg.channel.startsWith("gmail_")}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action and Reply Box */}
      {activeThread && (
        <div className="shrink-0 border-t border-neutral-800/80">
          <ThreadReplyForm threadKey={activeThread.threadKey} />
        </div>
      )}
    </div>
  );
}
