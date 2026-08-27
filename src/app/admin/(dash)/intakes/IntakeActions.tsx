"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingAction = "qualified" | "rejected" | "test";

export default function IntakeActions({
  source,
  externalId,
  sourceRef,
}: {
  source: string;
  externalId: string;
  sourceRef: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setPending(null);
    setReason("");
    setError(null);
  }

  async function submit() {
    if (!pending || !reason.trim()) return;
    setBusy(true);
    setError(null);

    // "내부 테스트"는 정상 판정 파이프라인에서 빠져야 하므로 rejected로 두고
    // isTest를 별도로 켠다 — isQualifiedIntake는 어차피 isTest면 항상 false다.
    const payload =
      pending === "test"
        ? { status: "rejected", reason, isTest: true, isTestReason: reason, sourceRef }
        : { status: pending, reason, isTest: false, sourceRef };

    const res = await fetch(
      `/api/admin/intake-reviews/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);

    if (!res.ok) {
      setError("저장에 실패했습니다.");
      return;
    }

    cancel();
    router.refresh();
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유를 입력하세요"
          className="text-xs bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 w-44 text-neutral-100"
        />
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={submit}
          className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
        >
          {busy ? "저장 중…" : "확인"}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-xs px-2 py-1 rounded-lg text-neutral-400 hover:bg-neutral-800"
        >
          취소
        </button>
        {error && <span role="alert" className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        type="button"
        onClick={() => setPending("qualified")}
        className="text-xs px-2 py-1 rounded-lg border border-emerald-800 text-emerald-400 hover:bg-emerald-950"
      >
        정상 리드로 승인
      </button>
      <button
        type="button"
        onClick={() => setPending("rejected")}
        className="text-xs px-2 py-1 rounded-lg border border-red-800 text-red-400 hover:bg-red-950"
      >
        거절
      </button>
      <button
        type="button"
        onClick={() => setPending("test")}
        className="text-xs px-2 py-1 rounded-lg border border-neutral-700 text-neutral-400 hover:bg-neutral-800"
      >
        내부 테스트
      </button>
    </div>
  );
}
