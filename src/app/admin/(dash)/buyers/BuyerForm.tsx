"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INFLOW_CHANNELS, type Buyer } from "@/lib/schemas/buyer";

const EMPTY = {
  name: "", emails: "", inflowChannel: "manual",
  brandName: "", country: "", phone: "",
};

export default function BuyerForm({ buyer, prefillEmail }: { buyer?: Buyer; prefillEmail?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!prefillEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(
    buyer
      ? { ...buyer, emails: buyer.emails.join("\n") }
      : prefillEmail
        ? { ...EMPTY, emails: prefillEmail }
        : EMPTY,
  );

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      name: form.name,
      emails: form.emails.split("\n").map((s) => s.trim()).filter(Boolean),
      inflowChannel: form.inflowChannel,
      brandName: form.brandName,
      country: form.country,
      phone: form.phone,
    };

    const res = await fetch(
      buyer ? `/api/admin/buyers/${buyer.id}` : "/api/admin/buyers",
      {
        method: buyer ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);

    if (res.status === 409) {
      const { email } = await res.json();
      return setError(`${email} 은 다른 바이어에 등록돼 있습니다.`);
    }
    if (res.status === 400) return setError("입력을 확인해주세요.");
    if (!res.ok) return setError("저장에 실패했습니다.");

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
      >
        {buyer ? "수정" : "바이어 등록"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold">{buyer ? "바이어 수정" : "바이어 등록"}</h2>

        <label className="block">
          <span className="text-xs text-neutral-400">이름</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-400">이메일 — 한 줄에 하나</span>
          <textarea
            value={form.emails}
            onChange={(e) => set("emails", e.target.value)}
            required
            rows={3}
            className="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm font-mono"
          />
        </label>

        {[["brandName", "브랜드"], ["country", "국가"], ["phone", "전화번호"]].map(
          ([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-neutral-400">{label}</span>
              <input
                value={form[key as keyof typeof form] as string}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm"
              />
            </label>
          ),
        )}

        <label className="block">
          <span className="text-xs text-neutral-400">유입 경로</span>
          <select
            value={form.inflowChannel}
            onChange={(e) => set("inflowChannel", e.target.value)}
            className="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm"
          >
            {INFLOW_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="text-xs px-3 py-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
