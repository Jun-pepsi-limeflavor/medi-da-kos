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

const CAPABILITY_LABELS: Record<string, string> = {
  formulation: "처방 / 제형 개발 (formulation)",
  packaging: "용기 / 패키징 (packaging)",
  filling: "충진 / 포장 (filling)",
  testing: "품질 / 시험검사 (testing)",
  logistics: "수출 / 물류 (logistics)",
};

const PRODUCTION_MODEL_LABELS: Record<string, string> = {
  OEM: "OEM (위탁생산)",
  ODM: "ODM (개발생산)",
  private_label: "Private Label (자체 라벨)",
  tech_transfer: "Tech Transfer (기술 이전)",
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

  function removeContact(index: number) {
    if (form.contacts.length <= 1) return;
    setForm((f) => ({
      ...f,
      contacts: f.contacts.filter((_, i) => i !== index),
    }));
  }

  function addContact() {
    setForm((f) => ({
      ...f,
      contacts: [...f.contacts, { ...EMPTY_CONTACT }],
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
        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
      >
        {supplier ? "수정" : "제조사 등록"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-100">{supplier ? "제조사 수정" : "제조사 등록"}</h2>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="text-neutral-400 hover:text-neutral-200 text-xs p-1"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex-1 overflow-y-auto p-5 space-y-4 text-xs"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">
              회사명 <span className="text-rose-400">*</span>
            </span>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="예: (주)한국콜마"
              required
              className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </label>

          {/* 담당자 목록 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">
                담당자 정보 <span className="text-rose-400">*</span>
              </span>
            </div>

            {form.contacts.map((contact, index) => (
              <div key={index} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">담당자 {index + 1}</span>
                  {form.contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      삭제
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-neutral-400">
                      이름 <span className="text-rose-400">*</span>
                    </span>
                    <input
                      type="text"
                      placeholder="이름"
                      value={contact.name}
                      onChange={(e) => setContact(index, "name", e.target.value)}
                      required
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] text-neutral-400">직책 / 부서</span>
                    <input
                      type="text"
                      placeholder="예: 해외영업팀 팀장"
                      value={contact.title}
                      onChange={(e) => setContact(index, "title", e.target.value)}
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] text-neutral-400">
                      이메일 <span className="text-rose-400">*</span>
                    </span>
                    <input
                      type="email"
                      placeholder="contact@factory.com"
                      value={contact.email}
                      onChange={(e) => setContact(index, "email", e.target.value)}
                      required
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] text-neutral-400">연락처</span>
                    <input
                      type="tel"
                      placeholder="010-0000-0000"
                      value={contact.phone}
                      onChange={(e) => setContact(index, "phone", e.target.value)}
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                  </label>

                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[11px] text-neutral-400">소통 채널</span>
                    <select
                      value={contact.channel}
                      onChange={(e) => setContact(index, "channel", e.target.value)}
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="email">이메일 (Email)</option>
                      <option value="phone">전화 (Phone)</option>
                      <option value="kakao">카카오톡 (Kakao)</option>
                      <option value="other">기타 (Other)</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addContact}
              className="w-full py-2 rounded-lg border border-dashed border-neutral-700 hover:border-neutral-500 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/40 transition-colors flex items-center justify-center gap-1"
            >
              + 담당자 추가
            </button>
          </div>

          {/* 역량 */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">
              보유 역량 <span className="text-rose-400">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(["formulation", "packaging", "filling", "testing", "logistics"] as const).map((value) => {
                const checked = form.capabilities.includes(value);
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                      checked
                        ? "bg-indigo-950/60 border-indigo-500/60 text-indigo-200"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        set(
                          "capabilities",
                          e.target.checked
                            ? [...form.capabilities, value]
                            : form.capabilities.filter((v) => v !== value)
                        )
                      }
                      className="rounded border-neutral-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{CAPABILITY_LABELS[value] ?? value}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 생산 방식 */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">생산 방식</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(["OEM", "ODM", "private_label", "tech_transfer"] as const).map((value) => {
                const checked = form.productionModels.includes(value);
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                      checked
                        ? "bg-indigo-950/60 border-indigo-500/60 text-indigo-200"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        set(
                          "productionModels",
                          e.target.checked
                            ? [...form.productionModels, value]
                            : form.productionModels.filter((v) => v !== value)
                        )
                      }
                      className="rounded border-neutral-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{PRODUCTION_MODEL_LABELS[value] ?? value}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 대응 인증 */}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">대응 인증 (쉼표로 구분)</span>
            <input
              type="text"
              value={form.supportedCerts}
              onChange={(e) => set("supportedCerts", e.target.value)}
              placeholder="예: ISO 22716, CGMP, FDA, HALAL, EVE VEGAN"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </label>

          {error && (
            <div role="alert" className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="text-xs px-3.5 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="text-xs px-4 py-2 font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
