"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { unstable_catchError as catchError, type ErrorInfo } from "next/error";
import Link from "next/link";
import {
  AlertTriangle,
  Building,
  HelpCircle,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { ConversationRollup } from "@/lib/schemas/conversation";
import type { ConversationDetail, ReviewIdentityItem, ReviewIdentityDetail } from "@/lib/repo/conversations";
import type { IngestHealthSummary } from "@/lib/repo/ingest-state";
import type { Buyer } from "@/lib/schemas/buyer";
import type { Supplier } from "@/lib/schemas/supplier";

import ConversationQueue from "./ConversationQueue";
import ReviewQueue from "./ReviewQueue";
import ConversationDetailPanels from "./ConversationDetailPanels";

export type InboxQueueType = "customer-work" | "unclassified" | "supplier" | "advertising";

interface InboxWorkspaceProps {
  queue: InboxQueueType;
  rollups: ConversationRollup[];
  conversationDetail: ConversationDetail | null;
  conversationDetailPromise?: Promise<ConversationDetail | null>;
  reviewItems: ReviewIdentityItem[];
  reviewDetail: ReviewIdentityDetail | null;
  healthSummary: IngestHealthSummary;
  selectedConversationId?: string;
  selectedIdentityId?: string;
  mobilePanel: "queue" | "timeline" | "inspector";
  buyers: Buyer[];
  suppliers: Supplier[];
}

export default function InboxWorkspace({
  queue,
  rollups,
  conversationDetail,
  conversationDetailPromise,
  reviewItems,
  reviewDetail,
  healthSummary,
  selectedConversationId,
  selectedIdentityId,
  mobilePanel = "queue",
  buyers,
  suppliers,
}: InboxWorkspaceProps) {
  const searchParams = useSearchParams();
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  const totalUnanswered = rollups.reduce((acc, r) => acc + (r.unansweredThreadCount || 0), 0);
  function getQueueLink(targetQueue: InboxQueueType) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("queue", targetQueue);
    params.delete("conversationId");
    params.delete("identityId");
    params.set("panel", "queue");
    return `/admin/inbox?${params.toString()}`;
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
      {/* Health Summary Alert (if degraded) */}
      {!healthSummary.healthy && healthSummary.warnings.length > 0 && (
        <div
          role="alert"
          className="shrink-0 flex items-center justify-between border-b border-amber-900/60 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>수집 지연 경고:</strong>{" "}
              {healthSummary.warnings.map((w) => `${w.account} (${w.reason})`).join(", ")}
            </span>
          </div>
          <span className="text-[10px] text-amber-400/80">
            점검 시각: {new Date(healthSummary.checkedAt).toLocaleTimeString("ko-KR")}
          </span>
        </div>
      )}

      {/* Top Level Navigation Tabs */}
      <div className="shrink-0 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          <Link
            href={getQueueLink("customer-work")}
            aria-current={queue === "customer-work" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-all min-h-[40px] ${
              queue === "customer-work"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>고객 업무</span>
            {totalUnanswered > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {totalUnanswered}
              </span>
            )}
          </Link>

          <Link
            href={getQueueLink("unclassified")}
            aria-current={queue === "unclassified" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-all min-h-[40px] ${
              queue === "unclassified"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            <span>검토함</span>
            {queue === "unclassified" && reviewItems.length > 0 && (
              <span className="rounded-full bg-neutral-800 px-1.5 py-0.2 text-[10px] font-mono text-neutral-300">
                {reviewItems.length}
              </span>
            )}
          </Link>

          <Link
            href={getQueueLink("supplier")}
            aria-current={queue === "supplier" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-all min-h-[40px] ${
              queue === "supplier"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            <Building className="h-4 w-4" />
            <span>제조사</span>
          </Link>

          <Link
            href={getQueueLink("advertising")}
            aria-current={queue === "advertising" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-all min-h-[40px] ${
              queue === "advertising"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>광고·내부</span>
          </Link>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {queue === "customer-work" ? (
          <>
            {/* Desktop 3-Panel Flex Layout (>= 1024px) */}
            <div className="hidden lg:flex h-full min-h-0 overflow-hidden">
              <div className="w-80 shrink-0 h-full min-h-0 overflow-hidden border-r border-neutral-800">
                <ConversationQueue
                  rollups={rollups}
                  selectedId={selectedConversationId}
                  totalUnanswered={totalUnanswered}
                />
              </div>
              <DetailPanelsErrorBoundary key={selectedConversationId ?? "empty"}>
                <Suspense fallback={<DetailPanelsFallback isCollapsed={inspectorCollapsed} />}>
                  <ConversationDetailPanels
                    detailPromise={conversationDetailPromise}
                    detail={conversationDetail}
                    mobilePanel="desktop"
                    isCollapsed={inspectorCollapsed}
                    onToggleCollapse={() => setInspectorCollapsed((prev) => !prev)}
                  />
                </Suspense>
              </DetailPanelsErrorBoundary>
            </div>

            {/* Mobile / Tablet Staged Layout (< 1024px) */}
            <div className="lg:hidden h-full min-h-0 overflow-hidden">
              {mobilePanel === "queue" && (
                <ConversationQueue
                  rollups={rollups}
                  selectedId={selectedConversationId}
                  totalUnanswered={totalUnanswered}
                />
              )}
              {mobilePanel === "timeline" && (
                <DetailPanelsErrorBoundary key={selectedConversationId ?? "empty"} mobile>
                  <Suspense fallback={<DetailPanelsFallback mobile />}>
                    <ConversationDetailPanels
                      detailPromise={conversationDetailPromise}
                      detail={conversationDetail}
                      mobilePanel="timeline"
                    />
                  </Suspense>
                </DetailPanelsErrorBoundary>
              )}
              {mobilePanel === "inspector" && (
                <DetailPanelsErrorBoundary key={selectedConversationId ?? "empty"} mobile>
                  <Suspense fallback={<DetailPanelsFallback mobile />}>
                    <ConversationDetailPanels
                      detailPromise={conversationDetailPromise}
                      detail={conversationDetail}
                      mobilePanel="inspector"
                    />
                  </Suspense>
                </DetailPanelsErrorBoundary>
              )}
            </div>
          </>
        ) : (
          /* Review Queues */
          <ReviewQueue
            queue={queue as "unclassified" | "supplier" | "advertising"}
            items={reviewItems}
            selectedDetail={reviewDetail}
            selectedIdentityId={selectedIdentityId}
            buyers={buyers}
            suppliers={suppliers}
            conversations={rollups}
          />
        )}
      </div>
    </div>
  );
}

function DetailPanelsErrorFallback(
  { mobile = false }: { mobile?: boolean },
  { unstable_retry: retry }: ErrorInfo,
) {
  return (
    <div
      role="alert"
      className={`${mobile ? "h-full" : "flex-1"} flex min-w-0 flex-col items-center justify-center bg-neutral-950 p-8 text-center`}
    >
      <AlertTriangle className="mb-3 h-9 w-9 text-amber-500" />
      <h3 className="text-sm font-semibold text-neutral-200">대화 상세를 불러오지 못했습니다</h3>
      <p className="mt-1 text-xs text-neutral-500">대화 목록은 유지됩니다. 잠시 후 다시 시도해주세요.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 min-h-[40px] rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
      >
        다시 시도
      </button>
    </div>
  );
}

const DetailPanelsErrorBoundary = catchError(DetailPanelsErrorFallback);

function DetailPanelsFallback({ isCollapsed = false, mobile = false }: { isCollapsed?: boolean; mobile?: boolean }) {
  if (mobile) return <div className="h-full animate-pulse bg-neutral-900" aria-busy="true" />;

  return (
    <div className="flex flex-1 min-w-0 h-full" aria-busy="true">
      <div className="flex-1 border-r border-neutral-800 bg-neutral-950 p-6 space-y-4">
        <div className="h-5 w-2/5 animate-pulse rounded bg-neutral-800" />
        <div className="h-4 w-full animate-pulse rounded bg-neutral-800" />
      </div>
      <div className={`${isCollapsed ? "w-12" : "w-[440px] xl:w-[480px]"} shrink-0 bg-neutral-950 p-5`}>
        <div className="h-5 w-1/3 animate-pulse rounded bg-neutral-800" />
      </div>
    </div>
  );
}
