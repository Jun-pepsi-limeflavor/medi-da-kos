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

  let healthSummary: Awaited<ReturnType<typeof ingestHealthSummary>>;
  let buyers: Awaited<ReturnType<typeof listBuyers>> = [];
  let suppliers: Awaited<ReturnType<typeof listSuppliers>> = [];
  let rollups: Awaited<ReturnType<typeof listConversationRollups>> = [];
  let conversationDetail = null;
  let selectedConversationId = requestedConversationId;

  let reviewItems: Awaited<ReturnType<typeof listReviewIdentities>> = [];
  let reviewDetail = null;
  let selectedIdentityId = requestedIdentityId;

  if (queue === "customer-work") {
    // If conversationId is known ahead of time, fetch detail concurrently in 1 hop
    if (requestedConversationId) {
      const [h, b, s, r, cd] = await Promise.all([
        ingestHealthSummary(),
        listBuyers(),
        listSuppliers(),
        listConversationRollups("customer-work"),
        getConversationDetail(requestedConversationId),
      ]);
      healthSummary = h;
      buyers = b;
      suppliers = s;
      rollups = r;
      conversationDetail = cd;
    } else {
      const [h, b, s, r] = await Promise.all([
        ingestHealthSummary(),
        listBuyers(),
        listSuppliers(),
        listConversationRollups("customer-work"),
      ]);
      healthSummary = h;
      buyers = b;
      suppliers = s;
      rollups = r;
      if (rollups.length > 0) {
        selectedConversationId = rollups[0].id;
        conversationDetail = await getConversationDetail(selectedConversationId);
      }
    }
  } else {
    // Review queue: fetch concurrently in 1 hop if identityId is known
    if (requestedIdentityId) {
      const [h, b, s, items, rd] = await Promise.all([
        ingestHealthSummary(),
        listBuyers(),
        listSuppliers(),
        listReviewIdentities(queue),
        getReviewIdentityDetail(requestedIdentityId),
      ]);
      healthSummary = h;
      buyers = b;
      suppliers = s;
      reviewItems = items;
      reviewDetail = rd;
    } else {
      const [h, b, s, items] = await Promise.all([
        ingestHealthSummary(),
        listBuyers(),
        listSuppliers(),
        listReviewIdentities(queue),
      ]);
      healthSummary = h;
      buyers = b;
      suppliers = s;
      reviewItems = items;
      if (reviewItems.length > 0) {
        selectedIdentityId = reviewItems[0].identity.id;
        reviewDetail = await getReviewIdentityDetail(selectedIdentityId);
      }
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
