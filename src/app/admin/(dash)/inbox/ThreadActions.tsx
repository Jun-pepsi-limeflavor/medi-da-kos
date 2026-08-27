"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Thread } from "@/lib/schemas/thread";

const EMPTY_CORRECTION: CorrectionForm = {
  side: "unknown",
  reason: "",
};

type CorrectionForm = {
  side: Thread["side"];
  reason: string;
};

export default function ThreadActions({ thread }: { thread: Thread }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState<CorrectionForm>(EMPTY_CORRECTION);

  async function handleAction(action: "archive" | "read") {
    setBusy(true);
    setError(null);

    const payload =
      action === "archive"
        ? { triageState: "archived" }
        : action === "read"
          ? { readState: "read" }
          : {};

    const res = await fetch(
      `/api/admin/threads/${encodeURIComponent(thread.threadKey)}/state`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setBusy(false);

    if (!res.ok) {
      setError("작업에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  async function handleLink(type: "buyer" | "supplier") {
    setBusy(true);
    setError(null);

    const payload =
      type === "buyer"
        ? { buyerId: "placeholder" }
        : { supplierId: "placeholder" };

    const res = await fetch(
      `/api/admin/threads/${encodeURIComponent(thread.threadKey)}/link`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setBusy(false);

    if (!res.ok) {
      setError("연결에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!correction.reason.trim()) {
      setError("사유를 입력해주세요.");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch(
      `/api/admin/threads/${encodeURIComponent(thread.threadKey)}/side`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          side: correction.side,
          reason: correction.reason.trim(),
        }),
      }
    );
    setBusy(false);

    if (!res.ok) {
      setError("정정에 실패했습니다.");
      return;
    }
    setShowCorrection(false);
    setCorrection(EMPTY_CORRECTION);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-xs text-red-400 bg-red-950/50 p-2 rounded">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleAction("read")}
          disabled={busy || thread.readState === "read"}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "처리 중…" : "읽음"}
        </button>

        <button
          type="button"
          onClick={() => handleAction("archive")}
          disabled={busy || thread.triageState === "archived"}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "처리 중…" : "보관"}
        </button>

        <button
          type="button"
          onClick={() => handleLink("buyer")}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "연결 중…" : "바이어 연결"}
        </button>

        <button
          type="button"
          onClick={() => handleLink("supplier")}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "연결 중…" : "제조사 연결"}
        </button>

        <button
          type="button"
          onClick={() => setShowCorrection(!showCorrection)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          Side 정정
        </button>
      </div>

      {showCorrection && (
        <form onSubmit={submitCorrection} className="bg-neutral-800 rounded p-3 space-y-2">
          <div>
            <label className="text-xs text-neutral-400">Side</label>
            <select
              value={correction.side}
              onChange={(e) =>
                setCorrection((f) => ({ ...f, side: e.target.value as Thread["side"] }))
              }
              className="w-full text-xs p-1.5 bg-neutral-700 border border-neutral-600 rounded text-neutral-100"
            >
              <option value="unknown">unknown</option>
              <option value="brand">brand</option>
              <option value="factory">factory</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400">사유</label>
            <textarea
              value={correction.reason}
              onChange={(e) =>
                setCorrection((f) => ({ ...f, reason: e.target.value }))
              }
              className="w-full text-xs p-1.5 bg-neutral-700 border border-neutral-600 rounded text-neutral-100 resize-none"
              rows={2}
              placeholder="정정 사유를 입력해주세요."
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCorrection(false);
                setCorrection(EMPTY_CORRECTION);
              }}
              className="text-xs px-2 py-1 rounded text-neutral-400 hover:bg-neutral-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="text-xs px-2 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
