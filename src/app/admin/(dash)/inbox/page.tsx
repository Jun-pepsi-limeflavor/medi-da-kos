import "server-only";
import { listBuyers } from "@/lib/repo/buyers";
import { listSuppliers } from "@/lib/repo/suppliers";
import {
  getConversationDetail,
  getReviewIdentityDetail,
  listConversationRollups,
  listReviewIdentities,
} from "@/lib/repo/conversations";
import { ingestHealthSummary } from "@/lib/repo/ingest-state";
import InboxWorkspace, { type InboxQueueType } from "./InboxWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const rawQueue = typeof params.queue === "string" ? params.queue : "customer-work";
  const queue: InboxQueueType =
    rawQueue === "unclassified" || rawQueue === "supplier" || rawQueue === "advertising"
      ? rawQueue
      : "customer-work";

  const requestedConversationId = typeof params.conversationId === "string" ? params.conversationId : undefined;
  const requestedIdentityId = typeof params.identityId === "string" ? params.identityId : undefined;
  const rawPanel = typeof params.panel === "string" ? params.panel : "queue";
  const mobilePanel: "queue" | "timeline" | "inspector" =
    rawPanel === "timeline" || rawPanel === "inspector" ? rawPanel : "queue";

  // Parallel initial fetches
  const [healthSummary, buyers, suppliers, rollups] = await Promise.all([
    ingestHealthSummary(),
    listBuyers(),
    listSuppliers(),
    listConversationRollups("customer-work"),
  ]);

  let conversationDetail = null;
  let selectedConversationId = requestedConversationId;

  let reviewItems: Awaited<ReturnType<typeof listReviewIdentities>> = [];
  let reviewDetail = null;
  let selectedIdentityId = requestedIdentityId;

  if (queue === "customer-work") {
    if (!selectedConversationId && rollups.length > 0) {
      selectedConversationId = rollups[0].id;
    }
    if (selectedConversationId) {
      conversationDetail = await getConversationDetail(selectedConversationId);
    }
  } else {
    reviewItems = await listReviewIdentities(queue);
    if (!selectedIdentityId && reviewItems.length > 0) {
      selectedIdentityId = reviewItems[0].identity.id;
    }
    if (selectedIdentityId) {
      reviewDetail = await getReviewIdentityDetail(selectedIdentityId);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            고객 중심 통합 받은편지함
            <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-semibold">
              v2
            </span>
          </h1>
        </div>
      </div>

      <InboxWorkspace
        queue={queue}
        rollups={rollups}
        conversationDetail={conversationDetail}
        reviewItems={reviewItems}
        reviewDetail={reviewDetail}
        healthSummary={healthSummary}
        selectedConversationId={selectedConversationId}
        selectedIdentityId={selectedIdentityId}
        mobilePanel={mobilePanel}
        buyers={buyers}
        suppliers={suppliers}
      />
    </div>
  );
}
