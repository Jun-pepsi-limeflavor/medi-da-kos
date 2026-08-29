"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { AlertCircle, Clock, Search, UserX, CheckCircle2, MessageSquare } from "lucide-react";
import type { ConversationRollup } from "@/lib/schemas/conversation";

interface ConversationQueueProps {
  rollups: ConversationRollup[];
  selectedId?: string;
  totalUnanswered: number;
}

const WORKFLOW_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "진행 중", color: "border-sky-800/80 bg-sky-950/60 text-sky-300" },
  waiting_customer: { label: "고객 대기", color: "border-amber-800/80 bg-amber-950/60 text-amber-300" },
  done: { label: "완료", color: "border-emerald-800/80 bg-emerald-950/60 text-emerald-300" },
};

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function ConversationQueue({
  rollups,
  selectedId,
}: ConversationQueueProps) {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterWorkflow, setFilterWorkflow] = useState<string>("all");

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rollups.filter((item) => {
      if (filterWorkflow !== "all" && item.workflowState !== filterWorkflow) {
        return false;
      }
      if (!term) return true;
      const matchLabel = item.counterpartyLabel?.toLowerCase().includes(term);
      const matchSubject = item.lastSubject?.toLowerCase().includes(term);
      const matchOwner = item.ownerEmail?.toLowerCase().includes(term);
      const matchSnippet = item.lastSnippet?.toLowerCase().includes(term);
      return matchLabel || matchSubject || matchOwner || matchSnippet;
    });
  }, [rollups, searchTerm, filterWorkflow]);

  const nowIso = new Date().toISOString();

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-neutral-800 bg-neutral-950 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="shrink-0 border-b border-neutral-800 p-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="고객명, 제목, 담당자 검색…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/90 py-1.5 pl-8 pr-3 text-xs text-neutral-200 placeholder:text-neutral-500 outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
          <button
            type="button"
            onClick={() => setFilterWorkflow("all")}
            aria-pressed={filterWorkflow === "all"}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              filterWorkflow === "all"
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            전체 ({rollups.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterWorkflow("active")}
            aria-pressed={filterWorkflow === "active"}
            className={`rounded-md px-2 py-1 font-medium transition-colors ${
              filterWorkflow === "active"
                ? "bg-sky-950/80 text-sky-300 border border-sky-800/80"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            진행 중
          </button>
          <button
            type="button"
            onClick={() => setFilterWorkflow("waiting_customer")}
            aria-pressed={filterWorkflow === "waiting_customer"}
            className={`rounded-md px-2 py-1 font-medium transition-colors ${
              filterWorkflow === "waiting_customer"
                ? "bg-amber-950/80 text-amber-300 border border-amber-800/80"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            고객 대기
          </button>
          <button
            type="button"
            onClick={() => setFilterWorkflow("done")}
            aria-pressed={filterWorkflow === "done"}
            className={`rounded-md px-2 py-1 font-medium transition-colors ${
              filterWorkflow === "done"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            완료
          </button>
        </div>
      </div>

      {/* List items */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-neutral-800/60" role="list">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            <MessageSquare className="mx-auto mb-2 h-6 w-6 text-neutral-600" />
            조건에 맞는 대화가 없습니다
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = item.id === selectedId;
            const isOverdue = item.workflowState !== "done" && item.dueAt && item.dueAt < nowIso;
            const stateInfo = WORKFLOW_LABELS[item.workflowState] || WORKFLOW_LABELS.active;

            // Build href preserving other params
            const params = new URLSearchParams(searchParams.toString());
            params.set("queue", "customer-work");
            params.set("conversationId", item.id);
            params.set("panel", "timeline");

            return (
              <Link
                key={item.id}
                href={`/admin/inbox?${params.toString()}`}
                role="listitem"
                aria-current={isSelected ? "true" : undefined}
                className={`block p-3.5 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset ${
                  isSelected
                    ? "bg-neutral-900 border-l-2 border-indigo-500 pl-3"
                    : "hover:bg-neutral-900/60 text-neutral-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-xs text-neutral-100 truncate">
                    {item.counterpartyLabel || "미지정 고객"}
                  </span>
                  <span className="text-[10px] text-neutral-500 shrink-0">
                    {formatTimeAgo(item.lastActivityAt)}
                  </span>
                </div>

                <p className="text-xs text-neutral-300 truncate font-medium mb-1">
                  {item.lastSubject || "(제목 없음)"}
                </p>

                {item.lastSnippet && (
                  <p className="text-[11px] text-neutral-400 line-clamp-1 mb-2 leading-relaxed">
                    {item.lastSnippet}
                  </p>
                )}

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${stateInfo.color}`}
                  >
                    {item.workflowState === "done" ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <Clock className="h-2.5 w-2.5" />
                    )}
                    {stateInfo.label}
                  </span>

                  {item.unansweredThreadCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded border border-rose-900/80 bg-rose-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                      <AlertCircle className="h-2.5 w-2.5" />
                      답장 필요 {item.unansweredThreadCount}건
                    </span>
                  )}

                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 rounded border border-rose-800 bg-rose-950 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                      기한 초과
                    </span>
                  )}

                  {item.ownerEmail ? (
                    <span className="text-[10px] text-neutral-400 rounded bg-neutral-800/80 px-1.5 py-0.5 truncate max-w-[120px]">
                      {item.ownerEmail.split("@")[0]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded bg-neutral-800/90 text-neutral-400 px-1.5 py-0.5 text-[10px]">
                      <UserX className="h-2.5 w-2.5" />
                      미배정
                    </span>
                  )}

                  {item.providerLabels && item.providerLabels.length > 0 && (
                    <span className="text-[10px] text-neutral-500 ml-auto">
                      {item.providerLabels.join(", ")}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
