import Link from "next/link";
import { listSuppliers } from "@/lib/repo/suppliers";
import { listDealsWithDetails } from "@/lib/repo/deals";
import type { DealDetails, SupplierEngagement } from "@/lib/schemas/deal";
import SupplierForm from "./SupplierForm";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [suppliers, deals] = await Promise.all([
    listSuppliers(),
    listDealsWithDetails(),
  ]);

  const params = await searchParams;
  const prefillEmail = typeof params.prefillEmail === "string" ? params.prefillEmail : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h1 className="text-lg font-semibold">제조사 {suppliers.length}곳</h1>
        <SupplierForm prefillEmail={prefillEmail} />
      </div>

      {suppliers.length === 0 ? (
        <p className="text-sm text-neutral-500">등록된 제조사가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="text-left py-2 font-medium">회사명</th>
                <th className="text-left py-2 font-medium">역량</th>
                <th className="text-left py-2 font-medium">참여 딜 (진행/확정/기각)</th>
                <th className="text-left py-2 font-medium">주 담당자</th>
                <th className="text-left py-2 font-medium">연락처</th>
                <th className="text-left py-2 font-medium">대응 인증</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {suppliers.map((s) => {
                const engagements = deals.flatMap((d: DealDetails) =>
                  d.supplierEngagements
                    .filter((e: SupplierEngagement) => e.supplierId === s.id)
                    .map((e: SupplierEngagement) => ({ deal: d.deal, engagement: e }))
                );

                const fixedDeals = engagements.filter((x) => x.engagement.contactStatus === "fix");
                const activeDeals = engagements.filter((x) => x.engagement.contactStatus === "ing");
                const droppedDeals = engagements.filter((x) => x.engagement.contactStatus === "drop");

                return (
                  <tr key={s.id}>
                    <td className="py-2.5 font-medium text-neutral-100">{s.companyName}</td>
                    <td className="py-2.5">
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
                        {s.capabilities.join(" · ")}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {engagements.length === 0 ? (
                        <span className="text-neutral-500 text-xs">참여 딜 없음</span>
                      ) : (
                        <div className="flex flex-col gap-1 text-xs">
                          {fixedDeals.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                                확정 {fixedDeals.length}
                              </span>
                              {fixedDeals.map((x) => (
                                <span key={x.deal.id} className="inline-flex items-center gap-0.5">
                                  <Link
                                    href={`/admin/deals/${x.deal.id}`}
                                    className="text-neutral-200 hover:text-white underline text-[11px] truncate max-w-[130px]"
                                    title={`${x.deal.reference}${x.engagement.notes ? `\n[메모] ${x.engagement.notes}` : ""}`}
                                  >
                                    {x.deal.reference}
                                  </Link>
                                  {x.engagement.notes && (
                                    <span
                                      className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-indigo-300 border border-neutral-700 cursor-help"
                                      title={`[메모] ${x.engagement.notes}`}
                                    >
                                      메모
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {activeDeals.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800 font-medium">
                                진행중 {activeDeals.length}
                              </span>
                              {activeDeals.map((x) => (
                                <span key={x.deal.id} className="inline-flex items-center gap-0.5">
                                  <Link
                                    href={`/admin/deals/${x.deal.id}`}
                                    className="text-neutral-300 hover:text-white underline text-[11px] truncate max-w-[130px]"
                                    title={`${x.deal.reference}${x.engagement.notes ? `\n[메모] ${x.engagement.notes}` : ""}`}
                                  >
                                    {x.deal.reference}
                                  </Link>
                                  {x.engagement.notes && (
                                    <span
                                      className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-indigo-300 border border-neutral-700 cursor-help"
                                      title={`[메모] ${x.engagement.notes}`}
                                    >
                                      메모
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {droppedDeals.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                                기각 {droppedDeals.length}
                              </span>
                              {droppedDeals.map((x) => (
                                <span key={x.deal.id} className="inline-flex items-center gap-0.5">
                                  <Link
                                    href={`/admin/deals/${x.deal.id}`}
                                    className="text-neutral-500 hover:text-neutral-300 underline text-[11px] truncate max-w-[130px]"
                                    title={`${x.deal.reference}${x.engagement.notes ? `\n[메모] ${x.engagement.notes}` : ""}`}
                                  >
                                    {x.deal.reference}
                                  </Link>
                                  {x.engagement.notes && (
                                    <span
                                      className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-indigo-300 border border-neutral-700 cursor-help"
                                      title={`[메모] ${x.engagement.notes}`}
                                    >
                                      메모
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-neutral-300">{s.contacts[0].name}</td>
                    <td className="py-2.5 text-neutral-400">
                      <div>{s.contacts[0].phone || "—"}</div>
                      <div className="text-xs">{s.contacts[0].email}</div>
                    </td>
                    <td className="py-2.5 text-xs text-neutral-400">
                      {s.supportedCerts.length ? s.supportedCerts.join(", ") : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <SupplierForm supplier={s} />
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
