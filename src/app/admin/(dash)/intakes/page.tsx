import { getAdminDb } from "@/lib/firebase-admin";
import { listIntakeReviews } from "@/lib/repo/intake-reviews";
import { intakeReviewId } from "@/lib/schemas/intake-review";
import IntakeTableClient from "./IntakeTableClient";
import { type IntakeRowDetail } from "./IntakeDetailModal";

export const dynamic = "force-dynamic";

async function loadRows(): Promise<IntakeRowDetail[]> {
  const db = getAdminDb();
  const [ordersSnap, samplesSnap, contactSnap, landingSnap, koreaLeadsSnap, reviews] =
    await Promise.all([
      db.collection("orders").get(),
      db.collection("sampleRequests").get(),
      db.collection("contact").get(),
      db.collection("landingRequests").get(),
      db.collection("koreaLeads").get(),
      listIntakeReviews(),
    ]);

  // orders·sampleRequests는 uid만 갖고 있는 경우가 많으므로 users에서 사용자 프로필을 조회
  const uids = new Set<string>();
  for (const d of [...ordersSnap.docs, ...samplesSnap.docs]) {
    const uid = d.data().uid;
    if (typeof uid === "string" && uid) uids.add(uid);
  }
  const userDocs = uids.size
    ? await db.getAll(...[...uids].map((uid) => db.collection("users").doc(uid)))
    : [];
  const userByUid = new Map(
    userDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]),
  );

  const rows: IntakeRowDetail[] = [];

  for (const d of ordersSnap.docs) {
    const data = d.data();
    const user = data.uid ? userByUid.get(data.uid) : undefined;
    const email = (user?.email as string) || (data.email as string) || (data.buyerEmail as string) || "";
    const company = (user?.companyName as string) || (data.companyName as string) || "";
    const brief = (data.briefSnapshot || {}) as {
      step1?: { selection?: string };
      step4?: { orderQuantity?: string };
      step6?: { productName?: string };
    };
    const pType = brief.step6?.productName || brief.step1?.selection || (data.title as string) || "화장품";
    const qty = brief.step4?.orderQuantity ? `${parseInt(brief.step4.orderQuantity, 10).toLocaleString()}개` : "";

    rows.push({
      id: intakeReviewId("order", d.id),
      source: "order",
      externalId: d.id,
      sourceRef: `orders/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: email || company || data.uid || "—",
      companyName: company || undefined,
      contactName: contact || undefined,
      email: email || undefined,
      phone: (user?.phone as string) || (data.shippingAddress?.phone as string) || undefined,
      country: (user?.country as string) || (data.shippingAddress?.country as string) || undefined,
      review: reviews.get(intakeReviewId("order", d.id)) ?? null,
      summaryText: `[ODM] ${pType} ${qty}`.trim(),
      shippingAddress: data.shippingAddress,
      briefSnapshot: data.briefSnapshot,
    });
  }

  for (const d of samplesSnap.docs) {
    const data = d.data();
    const user = data.uid ? userByUid.get(data.uid) : undefined;
    const email = (user?.email as string) || (data.email as string) || "";
    const contact = (user?.displayName as string) || (data.shippingAddress?.recipientName as string) || "";

    rows.push({
      id: intakeReviewId("sampleRequest", d.id),
      source: "sampleRequest",
      externalId: d.id,
      sourceRef: `sampleRequests/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: email || data.uid || "—",
      companyName: (user?.companyName as string) || undefined,
      contactName: contact || undefined,
      email: email || undefined,
      phone: (user?.phone as string) || (data.shippingAddress?.phone as string) || undefined,
      country: (user?.country as string) || (data.shippingAddress?.country as string) || undefined,
      review: reviews.get(intakeReviewId("sampleRequest", d.id)) ?? null,
      summaryText: `샘플: ${data.sampleProductName || "제품"} (${data.sampleQuantity || 1}개)`,
      sampleProductName: data.sampleProductName,
      sampleQuantity: data.sampleQuantity,
      shippingAddress: data.shippingAddress,
    });
  }

  for (const d of contactSnap.docs) {
    const data = d.data();
    rows.push({
      id: intakeReviewId("contact", d.id),
      source: "contact",
      externalId: d.id,
      sourceRef: `contact/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: data.email ?? data.companyName ?? "—",
      companyName: data.companyName || undefined,
      contactName: data.name || data.contactName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      country: data.country || undefined,
      review: reviews.get(intakeReviewId("contact", d.id)) ?? null,
      summaryText: data.businessType ? `[${data.businessType}] ${data.message || ""}` : data.message || "",
      message: data.message,
      businessType: data.businessType,
    });
  }

  for (const d of landingSnap.docs) {
    const data = d.data();
    rows.push({
      id: intakeReviewId("landingRequest", d.id),
      source: "landingRequest",
      externalId: d.id,
      sourceRef: `landingRequests/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: data.email ?? data.companyName ?? "—",
      companyName: data.companyName || undefined,
      contactName: data.name || data.contactName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      country: data.country || undefined,
      review: reviews.get(intakeReviewId("landingRequest", d.id)) ?? null,
      summaryText: data.serviceType ? `[${data.serviceType}] ${data.message || ""}` : data.message || "",
      message: data.message,
      serviceType: data.serviceType,
    });
  }

  for (const d of koreaLeadsSnap.docs) {
    const data = d.data();
    rows.push({
      id: intakeReviewId("koreaLead", d.id),
      source: "koreaLead",
      externalId: d.id,
      sourceRef: `koreaLeads/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: data.email ?? data.companyName ?? "—",
      companyName: data.companyName || undefined,
      contactName: data.name || data.contactName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      country: data.country || undefined,
      review: reviews.get(intakeReviewId("koreaLead", d.id)) ?? null,
      summaryText: `[볼륨: ${data.expectedVolume || "미정"}] ${data.message || ""}`,
      message: data.message,
      expectedVolume: data.expectedVolume,
      expectedVolumeLabel: data.expectedVolumeLabel,
      businessType: data.businessType,
      positioningArm: data.positioningArm,
    });
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return rows;
}

export default async function IntakesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawFilter = typeof params.status === "string" ? params.status : "raw";
  const filter =
    rawFilter === "all" || rawFilter === "qualified" || rawFilter === "rejected" || rawFilter === "test"
      ? (rawFilter as "raw" | "qualified" | "rejected" | "test" | "all")
      : "raw";

  const rows = await loadRows();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
          인테이크 판정 및 상세 미리보기
          <span className="text-xs bg-neutral-800 text-neutral-300 border border-neutral-700 px-2.5 py-0.5 rounded-full font-mono">
            총 {rows.length}건
          </span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          다양한 채널(주문 브리프, 샘플 신청, 콜드메일 랜딩, Contact 등)로 유입된 고객 문의 상세를 미리보고 공식 딜로 전환합니다.
        </p>
      </div>

      <IntakeTableClient rows={rows} initialFilter={filter} />
    </div>
  );
}
