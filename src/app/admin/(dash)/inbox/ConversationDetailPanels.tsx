"use client";

import { use } from "react";
import type { ConversationDetail } from "@/lib/repo/conversations";
import ConversationTimeline from "./ConversationTimeline";
import ConversationInspector from "./ConversationInspector";

export default function ConversationDetailPanels({
  detailPromise,
  detail,
  mobilePanel,
  isCollapsed,
  onToggleCollapse,
}: {
  detailPromise?: Promise<ConversationDetail | null>;
  detail: ConversationDetail | null;
  mobilePanel: "desktop" | "timeline" | "inspector";
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const resolvedDetail = detailPromise ? use(detailPromise) : detail;

  if (mobilePanel === "timeline") return <ConversationTimeline detail={resolvedDetail} />;
  if (mobilePanel === "inspector") return <ConversationInspector detail={resolvedDetail} />;

  return (
    <>
      <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden border-r border-neutral-800">
        <ConversationTimeline detail={resolvedDetail} />
      </div>
      <div className={`h-full min-h-0 overflow-hidden ${isCollapsed ? "w-12 shrink-0 bg-neutral-950" : "w-[440px] xl:w-[480px] shrink-0"}`}>
        <ConversationInspector detail={resolvedDetail} isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} />
      </div>
    </>
  );
}
