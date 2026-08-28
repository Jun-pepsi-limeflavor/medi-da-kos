"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Supplier } from "@/lib/schemas/supplier";

const EMPTY_CONTACT = { name: "", title: "", email: "", phone: "", channel: "email" };
const EMPTY: FormState = {
  companyName: "",
  contacts: [{ ...EMPTY_CONTACT }],
  capabilities: ["formulation"],
  productionModels: ["ODM"],
  supportedCerts: "",
};

type FormState = {
  companyName: string;
  contacts: Array<{ name: string; title: string; email: string; phone: string; channel: string }>;
  capabilities: string[];
  productionModels: string[];
  supportedCerts: string;
};

export default function SupplierForm({ supplier, prefillEmail }: { supplier?: Supplier; prefillEmail?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!prefillEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(
    supplier
      ? {
          companyName: supplier.companyName,
          contacts: supplier.contacts.map((c) => ({ name: c.name, title: c.title, email: c.email, phone: c.phone, channel: c.channel })),
          capabilities: supplier.capabilities,
          productionModels: supplier.productionModels,
          supportedCerts: supplier.supportedCerts.join(", "),
        }
      : prefillEmail
        ? { ...EMPTY, contacts: [{ ...EMPTY_CONTACT, email: prefillEmail }] }
        : EMPTY,
  );

  function set(key: string, value: string | string[]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setContact(index: number, key: keyof typeof EMPTY_CONTACT, value: string) {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => i === index ? { ...c, [key]: value } : c),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      companyName: form.companyName,
      contacts: form.contacts,
      capabilities: form.capabilities,
      productionModels: form.productionModels,
      supportedCerts: form.supportedCerts.split(",").map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch(
      supplier ? `/api/admin/suppliers/${supplier.id}` : "/api/admin/suppliers",
      {
        method: supplier ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);

    if (res.status === 409) return setError("같은 회사명이 이미 등록돼 있습니다.");
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
        {supplier ? "수정" : "제조사 등록"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold">{supplier ? "제조사 수정" : "제조사 등록"}</h2>

        <label className="block">
          <span className="text-xs text-neutral-400">회사명</span>
          <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required />
        </label>

        {form.contacts.map((contact, index) => (
          <fieldset key={index} className="rounded-lg border border-neutral-800 p-3">
            <legend className="text-xs text-neutral-400">담당자 {index + 1}</legend>
            {(["name", "title", "email", "phone"] as const).map((key) => (
              <input
                key={key}
                value={contact[key]}
                onChange={(e) => setContact(index, key, e.target.value)}
                required={key === "name" || key === "email"}
                aria-label={key}
              />
            ))}
            <select value={contact.channel} onChange={(e) => setContact(index, "channel", e.target.value)}>
              {(["email", "phone", "kakao", "other"] as const).map((v) => <option key={v}>{v}</option>)}
            </select>
          </fieldset>
        ))}
        <button type="button" onClick={() => setForm((f) => ({ ...f, contacts: [...f.contacts, { ...EMPTY_CONTACT }] }))}>
          담당자 추가
        </button>

        <fieldset>
          <legend className="text-xs text-neutral-400">역량</legend>
          {(["formulation", "packaging", "filling", "testing", "logistics"] as const).map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={form.capabilities.includes(value)}
                onChange={(e) => set("capabilities", e.target.checked
                  ? [...form.capabilities, value]
                  : form.capabilities.filter((v) => v !== value))}
              /> {value}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="text-xs text-neutral-400">생산 방식</legend>
          {(["OEM", "ODM", "private_label", "tech_transfer"] as const).map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={form.productionModels.includes(value)}
                onChange={(e) => set("productionModels", e.target.checked
                  ? [...form.productionModels, value]
                  : form.productionModels.filter((v) => v !== value))}
              /> {value}
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="text-xs text-neutral-400">대응 인증 (쉼표로 구분)</span>
          <input value={form.supportedCerts} onChange={(e) => set("supportedCerts", e.target.value)} />
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
