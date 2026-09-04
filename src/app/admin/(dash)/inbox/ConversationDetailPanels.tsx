"use client";

import { use } from "react";
import type { ConversationDetail } from "@/lib/repo/conversations";
import ConversationTimeline from "./ConversationTimeline";
import ConversationInspector from "./ConversationInspector";

export default function ConversationDetailPanels({
  detailPromise,
  mobilePanel,
  isCollapsed,
  onToggleCollapse,
}: {
  detailPromise: Promise<ConversationDetail | null>;
  mobilePanel: "desktop" | "timeline" | "inspector";
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const detail = use(detailPromise);

  if (mobilePanel === "timeline") return <ConversationTimeline detail={detail} />;
  if (mobilePanel === "inspector") return <ConversationInspector detail={detail} />;

  return (
    <>
      <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden border-r border-neutral-800">
        <ConversationTimeline detail={detail} />
      </div>
      <div className={`h-full min-h-0 overflow-hidden ${isCollapsed ? "w-12 shrink-0 bg-neutral-950" : "w-[440px] xl:w-[480px] shrink-0"}`}>
        <ConversationInspector detail={detail} isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} />
      </div>
    </>
  );
}
