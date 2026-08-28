import { requireAdminPage } from "@/lib/admin-page";
import { listDealsWithDetails } from "@/lib/repo/deals";
import { listIntakeReviews, resolveQualifiedIntakeDetails } from "@/lib/repo/intake-reviews";
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
  searchParams?: Promise<{ createFromMessage?: string; createFromIntake?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const createFromMessageId = params?.createFromMessage;
  const createFromIntakeId = params?.createFromIntake;

  const [deals, intakeReviewsMap, prefillMsg] = await Promise.all([
    listDealsWithDetails(),
    listIntakeReviews(),
    createFromMessageId ? getMessage(createFromMessageId) : Promise.resolve(null),
  ]);

  const rawQualified: Array<{
    id: string;
    source: string;
    externalId: string;
    reviewedBy?: string;
    reviewedAt?: string;
  }> = [];
  for (const [id, r] of intakeReviewsMap.entries()) {
    if (r.status === "qualified" && !r.isTest && !r.dealId) {
      rawQualified.push({
        id,
        source: r.source,
        externalId: r.externalId,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
      });
    }
  }

  const qualifiedIntakes: QualifiedIntakeSummary[] =
    await resolveQualifiedIntakeDetails(rawQualified);

  let prefillData: DealPrefillData | undefined = undefined;
  let autoOpen = false;

  if (createFromIntakeId) {
    const targetIntake = qualifiedIntakes.find((q) => q.id === createFromIntakeId);
    if (targetIntake) {
      const brand = targetIntake.companyName || targetIntake.contactName || "Deal";
      const firstItem = targetIntake.items?.[0];
      const itemText = firstItem?.productType || "";
      const volText = firstItem?.volume ? ` ${firstItem.volume}` : "";
      prefillData = {
        intakeReviewId: targetIntake.id,
        reference: `${brand} ${itemText}${volText} PO`.trim(),
        buyerId: targetIntake.email?.toLowerCase(),
        companyName: targetIntake.companyName,
        contactName: targetIntake.contactName,
        email: targetIntake.email,
        phone: targetIntake.phone,
        country: targetIntake.country || "미국 (USA)",
        recipientName: targetIntake.shippingInfo?.recipientName,
        addressLine1: targetIntake.shippingInfo?.addressLine1,
        city: targetIntake.shippingInfo?.city,
        shippingCountry: targetIntake.shippingInfo?.country,
        postalCode: targetIntake.shippingInfo?.postalCode,
        taxId: targetIntake.shippingInfo?.taxId,
        targetSampleDate: targetIntake.timeline?.targetSampleDate,
        targetDeliveryDate: targetIntake.timeline?.targetDeliveryDate,
        certifications: targetIntake.certifications?.join(", "),
        additionalRequests: targetIntake.additionalRequests,
        items: targetIntake.items,
      };
      autoOpen = true;
    }
  } else if (prefillMsg) {
    const ext =
      (prefillMsg.accepted as Extraction) ??
      (prefillMsg.extraction as Extraction) ??
      {};
    const matchedIntakeId = intakeReviewId("message", prefillMsg.threadKey);
    const existingIntake = intakeReviewsMap.get(matchedIntakeId);

    if (!existingIntake?.dealId) {
      const company = ext.buyer?.brandName || "";
      const contact = ext.buyer?.name || prefillMsg.fromName || "";
      const email = ext.buyer?.email || prefillMsg.from || "";
      const itemSummary = ext.items?.[0]?.productName || "";
      const ref = company
        ? `${company} ${itemSummary ? itemSummary + " " : ""}PO`
        : itemSummary
          ? `${itemSummary} Inquiry`
          : `Message Deal (${prefillMsg.id.slice(0, 8)})`;

      const prefillItems = (ext.items || []).map((it) => ({
        productType: it.productName || it.category || "화장품",
        variantName: it.variantName || "",
        volume: it.volume || "",
        quantity: typeof it.expectedQty === "number" && it.expectedQty > 0 ? Math.floor(it.expectedQty) : 1000,
        formulaSpec: {
          targetTexture: it.formula?.formulaType || it.formula?.notes || undefined,
          keyIngredients: it.formula?.keyIngredients || undefined,
          notes: it.formula?.notes || undefined,
        },
        packagingSpec: {
          containerType: it.packaging?.containerType || undefined,
          material: it.packaging?.material || undefined,
          closure: it.packaging?.outerBox || undefined,
          notes: it.packaging?.notes || undefined,
        },
      }));

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
        items: prefillItems.length > 0 ? prefillItems : undefined,
      };
      autoOpen = true;
    }
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
