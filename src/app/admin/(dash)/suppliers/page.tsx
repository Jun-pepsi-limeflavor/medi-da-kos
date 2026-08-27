import { listSuppliers } from "@/lib/repo/suppliers";
import SupplierForm from "./SupplierForm";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <h1 className="text-lg font-semibold">제조사 {suppliers.length}곳</h1>
        <SupplierForm />
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
                <th className="text-left py-2 font-medium">주 담당자</th>
                <th className="text-left py-2 font-medium">연락처</th>
                <th className="text-left py-2 font-medium">대응 인증</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 font-medium text-neutral-100">{s.companyName}</td>
                  <td className="py-2.5">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
                      {s.capabilities.join(" · ")}
                    </span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
