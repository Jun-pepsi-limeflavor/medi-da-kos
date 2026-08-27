"use client";

import { useState } from "react";

export default function MailProviderDiagnose({ account }: { account: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function handleDiagnose() {
    setBusy(true);
    setResult(null);

    try {
      const res = await fetch(
        `/api/admin/settings/mail-providers/${encodeURIComponent(account)}/diagnose`,
        { method: "POST" }
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      setResult(json);
    } catch {
      setResult({ ok: false, error: "요청에 실패했습니다." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDiagnose}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "진단 중…" : "진단"}
      </button>

      {result && (
        <div className="text-xs">
          {result.ok ? (
            <p className="text-green-400">✅ {account} 접근 가능</p>
          ) : (
            <div className="text-red-400">
              <p>❌ {account} — {result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
