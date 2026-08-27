import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import { listIntakeReviews } from "@/lib/repo/intake-reviews";
import { intakeReviewId, type IntakeReview } from "@/lib/schemas/intake-review";
import IntakeActions from "./IntakeActions";

export const dynamic = "force-dynamic";

type RawSource = "order" | "sampleRequest" | "contact" | "koreaLead";

type IntakeRow = {
  source: RawSource;
  externalId: string;
  sourceRef: string;
  createdAt: string;
  buyerLabel: string;
  review: IntakeReview | null;
};

type EffectiveStatus = "raw" | "qualified" | "rejected" | "test";

const SOURCE_LABEL: Record<RawSource, string> = {
  order: "주문",
  sampleRequest: "샘플 요청",
  contact: "문의",
  koreaLead: "콜드메일 리드",
};

const STATUS_LABEL: Record<EffectiveStatus | "all", string> = {
  raw: "판정 대기",
  qualified: "승인",
  rejected: "거절",
  test: "내부 테스트",
  all: "전체",
};

const STATUS_BADGE: Record<EffectiveStatus, string> = {
  raw: "border-neutral-700 text-neutral-400",
  qualified: "border-emerald-800 text-emerald-400",
  rejected: "border-red-800 text-red-400",
  test: "border-amber-800 text-amber-400",
};

function effectiveStatus(review: IntakeReview | null): EffectiveStatus {
  if (!review) return "raw";
  if (review.isTest) return "test";
  return review.status === "qualified" ? "qualified" : review.status === "rejected" ? "rejected" : "raw";
}

async function loadRows(): Promise<IntakeRow[]> {
  const db = getAdminDb();
  const [ordersSnap, samplesSnap, contactSnap, koreaSnap, reviews] = await Promise.all([
    db.collection("orders").get(),
    db.collection("sampleRequests").get(),
    db.collection("contact").get(),
    db.collection("koreaLeads").get(),
    listIntakeReviews(),
  ]);

  // orders·sampleRequests는 uid만 갖고 있다 — users에서 이메일을 한 번에 조회해 붙인다.
  const uids = new Set<string>();
  for (const d of [...ordersSnap.docs, ...samplesSnap.docs]) {
    const uid = d.data().uid;
    if (typeof uid === "string" && uid) uids.add(uid);
  }
  const userDocs = uids.size
    ? await db.getAll(...[...uids].map((uid) => db.collection("users").doc(uid)))
    : [];
  const emailByUid = new Map(
    userDocs.filter((d) => d.exists).map((d) => [d.id, (d.data()?.email as string | undefined) ?? d.id]),
  );

  const rows: IntakeRow[] = [];

  for (const d of ordersSnap.docs) {
    const data = d.data();
    rows.push({
      source: "order",
      externalId: d.id,
      sourceRef: `orders/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: emailByUid.get(data.uid) ?? data.uid ?? "—",
      review: reviews.get(intakeReviewId("order", d.id)) ?? null,
    });
  }
  for (const d of samplesSnap.docs) {
    const data = d.data();
    rows.push({
      source: "sampleRequest",
      externalId: d.id,
      sourceRef: `sampleRequests/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: emailByUid.get(data.uid) ?? data.uid ?? "—",
      review: reviews.get(intakeReviewId("sampleRequest", d.id)) ?? null,
    });
  }
  for (const d of contactSnap.docs) {
    const data = d.data();
    rows.push({
      source: "contact",
      externalId: d.id,
      sourceRef: `contact/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: data.email ?? data.companyName ?? "—",
      review: reviews.get(intakeReviewId("contact", d.id)) ?? null,
    });
  }
  for (const d of koreaSnap.docs) {
    const data = d.data();
    rows.push({
      source: "koreaLead",
      externalId: d.id,
      sourceRef: `koreaLeads/${d.id}`,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      buyerLabel: data.email ?? data.companyName ?? "—",
      review: reviews.get(intakeReviewId("koreaLead", d.id)) ?? null,
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
  const filter: EffectiveStatus | "all" =
    rawFilter === "all" || rawFilter === "qualified" || rawFilter === "rejected" || rawFilter === "test"
      ? rawFilter
      : "raw";

  const rows = await loadRows();
  const visible = filter === "all" ? rows : rows.filter((r) => effectiveStatus(r.review) === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h1 className="text-lg font-semibold">인테이크 판정 {visible.length}건</h1>
        <div className="flex gap-1 text-xs">
          {(["raw", "qualified", "rejected", "test", "all"] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/intakes?status=${s}`}
              className={`px-3 py-1.5 rounded-lg border ${
                filter === s
                  ? "border-indigo-600 bg-indigo-950 text-indigo-300"
                  : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">해당하는 인테이크가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="text-left py-2 font-medium">원천</th>
                <th className="text-left py-2 font-medium">생성 시각</th>
                <th className="text-left py-2 font-medium">바이어</th>
                <th className="text-left py-2 font-medium">판정</th>
                <th className="text-left py-2 font-medium">사유</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {visible.map((row) => {
                const status = effectiveStatus(row.review);
                return (
                  <tr key={intakeReviewId(row.source, row.externalId)}>
                    <td className="py-2.5 text-neutral-300">{SOURCE_LABEL[row.source]}</td>
                    <td className="py-2.5 text-neutral-400 text-xs">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString("ko-KR") : "—"}
                    </td>
                    <td className="py-2.5 font-medium text-neutral-100">{row.buyerLabel}</td>
                    <td className="py-2.5">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${STATUS_BADGE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-neutral-400">
                      {row.review?.reason || "—"}
                    </td>
                    <td className="py-2.5">
                      <IntakeActions source={row.source} externalId={row.externalId} sourceRef={row.sourceRef} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
