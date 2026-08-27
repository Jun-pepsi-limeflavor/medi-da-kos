import { listIngestState } from "@/lib/repo/ingest-state";
import MailProviderDiagnose from "./MailProviderDiagnose";

export const dynamic = "force-dynamic";

export default async function MailProvidersPage() {
  const states = await listIngestState();

  function formatLastSuccess(lastSuccessAt: string | null, updatedAt: string): string {
    if (!lastSuccessAt) return "—";
    const lastSuccess = new Date(lastSuccessAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSuccess.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffMs / 86400000);
    return `${diffDays}일 전`;
  }

  function getStatus(state: typeof states[number]) {
    if (state.lastError) {
      return { label: "오류", dot: "bg-red-500", color: "text-red-400" };
    }
    if (state.processedCount === 0 && state.lastError === null) {
      return { label: "정상 0건", dot: "bg-yellow-500", color: "text-yellow-400" };
    }
    return { label: "연결됨", dot: "bg-green-500", color: "text-green-400" };
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-800 pb-4">
        <h1 className="text-lg font-semibold">메일 제공자 {states.length}개</h1>
      </div>

      {states.length === 0 ? (
        <p className="text-sm text-neutral-500">등록된 메일 계정이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="text-left py-2 font-medium">계정</th>
                <th className="text-left py-2 font-medium">상태</th>
                <th className="text-left py-2 font-medium">마지막 성공</th>
                <th className="text-left py-2 font-medium">처리건</th>
                <th className="text-left py-2 font-medium">오류</th>
                <th className="text-right py-2 font-medium">진단</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {states.map((state) => {
                const status = getStatus(state);
                return (
                  <tr key={state.account}>
                    <td className="py-3 font-medium text-neutral-100">{state.account}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                        <span className={status.color}>{status.label}</span>
                      </div>
                    </td>
                    <td className="py-3 text-neutral-400">
                      {formatLastSuccess(state.lastSuccessAt, state.updatedAt)}
                    </td>
                    <td className="py-3 text-neutral-400">{state.processedCount}통</td>
                    <td className="py-3 text-xs text-neutral-500">
                      {state.lastError ? (
                        <div className="truncate max-w-xs" title={state.lastError}>
                          {state.lastError}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <MailProviderDiagnose account={state.account} />
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
