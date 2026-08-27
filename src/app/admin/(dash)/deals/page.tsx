import { requireAdminPage } from "@/lib/admin-page";
import { listDealsWithDetails } from "@/lib/repo/deals";
import { listIntakeReviews } from "@/lib/repo/intake-reviews";
import { getMessage } from "@/lib/repo/messages";
import { intakeReviewId } from "@/lib/schemas/intake-review";
import type { Extraction } from "@/lib/schemas/extraction";
import CrmKanbanBoard from "@/components/crm/CrmKanbanBoard";
import CreateDealModal, {
  type QualifiedIntakeSummary,
  type DealPrefillData,
} from "./CreateDealModal";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams?: Promise<{ createFromMessage?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const createFromMessageId = params?.createFromMessage;

  const [deals, intakeReviewsMap, prefillMsg] = await Promise.all([
    listDealsWithDetails(),
    listIntakeReviews(),
    createFromMessageId ? getMessage(createFromMessageId) : Promise.resolve(null),
  ]);

  const qualifiedIntakes: QualifiedIntakeSummary[] = [];
  for (const [id, r] of intakeReviewsMap.entries()) {
    if (r.status === "qualified" && !r.isTest && !r.dealId) {
      qualifiedIntakes.push({
        id,
        source: r.source,
        externalId: r.externalId,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
      });
    }
  }

  let prefillData: DealPrefillData | undefined = undefined;
  let autoOpen = false;

  if (prefillMsg) {
    const ext =
      (prefillMsg.accepted as Extraction) ??
      (prefillMsg.extraction as Extraction) ??
      {};
    const matchedIntakeId = intakeReviewId("message", prefillMsg.threadKey);
    const company = ext.buyer?.brandName || "";
    const contact = ext.buyer?.name || prefillMsg.fromName || "";
    const email = ext.buyer?.email || prefillMsg.from || "";
    const itemSummary = ext.items?.[0]?.productName || "";
    const ref = company
      ? `${company} ${itemSummary ? itemSummary + " " : ""}PO`
      : itemSummary
        ? `${itemSummary} Inquiry`
        : `Message Deal (${prefillMsg.id.slice(0, 8)})`;

    prefillData = {
      intakeReviewId: matchedIntakeId,
      reference: ref,
      buyerId: email.toLowerCase(),
      companyName: company || contact,
      contactName: contact || company,
      email: email,
      country: ext.buyer?.country || ext.shipping?.country || "미국 (USA)",
      shippingCountry: ext.shipping?.country || ext.buyer?.country || "미국 (USA)",
      city: ext.shipping?.city || "",
      targetSampleDate: ext.timeline?.sampleTargetDate || "",
      targetDeliveryDate: ext.timeline?.targetLaunchDate || "",
      certifications:
        (ext.certifications?.requiredCerts || []).join(", ") || "CPNP, FDA",
    };
    autoOpen = true;
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            딜 파이프라인 원장
            <span className="text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2.5 py-0.5 rounded-full font-mono">
              {deals.length}건
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            8개 브랜드 단계와 공장 단계 연동, 샘플 회차 및 배송 구간을 실시간으로 운영합니다.
          </p>
        </div>

        <CreateDealModal
          qualifiedIntakes={qualifiedIntakes}
          prefillData={prefillData}
          autoOpen={autoOpen}
        />
      </div>


      {/* Main Kanban Board */}
      <CrmKanbanBoard deals={deals} />
    </div>
  );
}
