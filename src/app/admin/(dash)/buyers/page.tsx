import { listBuyers } from "@/lib/repo/buyers";
import BuyerForm from "./BuyerForm";

export const dynamic = "force-dynamic";

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const buyers = await listBuyers();
  const params = await searchParams;
  const prefillEmail = typeof params.prefillEmail === "string" ? params.prefillEmail : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h1 className="text-lg font-semibold">바이어 {buyers.length}명</h1>
        <BuyerForm prefillEmail={prefillEmail} />
      </div>

      {buyers.length === 0 ? (
        <p className="text-sm text-neutral-500">등록된 바이어가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="text-left py-2 font-medium">이름</th>
                <th className="text-left py-2 font-medium">브랜드</th>
                <th className="text-left py-2 font-medium">이메일</th>
                <th className="text-left py-2 font-medium">국가</th>
                <th className="text-left py-2 font-medium">유입</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {buyers.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 font-medium text-neutral-100">{b.name}</td>
                  <td className="py-2.5 text-neutral-300">{b.brandName || "—"}</td>
                  <td className="py-2.5 text-neutral-400 text-xs">
                    {b.emails.map((e) => <div key={e}>{e}</div>)}
                  </td>
                  <td className="py-2.5 text-neutral-400">{b.country || "—"}</td>
                  <td className="py-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
                      {b.inflowChannel}
                    </span>
                  </td>
                  <td className="py-2.5 text-right"><BuyerForm buyer={b} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
