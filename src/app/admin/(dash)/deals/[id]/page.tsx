import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page";
import { getDealWithSubcollections } from "@/lib/repo/deals";
import { listSuppliers } from "@/lib/repo/suppliers";
import DealDetailClient from "./DealDetailClient";
import DealConversationTimeline from "./DealConversationTimeline";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;

  const [dealDetails, suppliers] = await Promise.all([
    getDealWithSubcollections(id),
    listSuppliers(),
  ]);

  if (!dealDetails) {
    notFound();
  }

  return (
    <DealDetailClient
      initialDeal={dealDetails}
      allSuppliers={suppliers}
      conversation={<DealConversationTimeline dealId={id} />}
    />
  );
}
