"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Thread } from "@/lib/schemas/thread";

const EMPTY_CORRECTION: CorrectionForm = {
  side: "unknown",
  reason: "",
};

type CorrectionForm = {
  side: Thread["side"];
  reason: string;
};

type BuyerCandidate = { id: string; name: string };
type SupplierCandidate = { id: string; companyName: string };

export default function ThreadActions({
  thread,
  counterpartyEmail,
  buyerCandidate,
  supplierCandidate,
}: {
  thread: Thread;
  counterpartyEmail: string | null;
  buyerCandidate: BuyerCandidate | null;
  supplierCandidate: SupplierCandidate | null;
}) {
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

  async function handleLink(type: "buyer" | "supplier", id: string) {
    setBusy(true);
    setError(null);

    const payload = type === "buyer" ? { buyerId: id } : { supplierId: id };

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

        {buyerCandidate ? (
          <button
            type="button"
            onClick={() => handleLink("buyer", buyerCandidate.id)}
            disabled={busy || thread.buyerId === buyerCandidate.id}
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "연결 중…" : thread.buyerId === buyerCandidate.id ? `바이어 연결됨: ${buyerCandidate.name}` : `바이어 연결: ${buyerCandidate.name}`}
          </button>
        ) : counterpartyEmail ? (
          <Link
            href={`/admin/buyers?prefillEmail=${encodeURIComponent(counterpartyEmail)}`}
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            이 주소로 바이어 만들기
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-500 opacity-50 cursor-not-allowed"
          >
            바이어 연결
          </button>
        )}

        {supplierCandidate ? (
          <button
            type="button"
            onClick={() => handleLink("supplier", supplierCandidate.id)}
            disabled={busy || thread.supplierId === supplierCandidate.id}
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "연결 중…" : thread.supplierId === supplierCandidate.id ? `제조사 연결됨: ${supplierCandidate.companyName}` : `제조사 연결: ${supplierCandidate.companyName}`}
          </button>
        ) : counterpartyEmail ? (
          <Link
            href={`/admin/suppliers?prefillEmail=${encodeURIComponent(counterpartyEmail)}`}
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            이 주소로 제조사 만들기
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-500 opacity-50 cursor-not-allowed"
          >
            제조사 연결
          </button>
        )}

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
