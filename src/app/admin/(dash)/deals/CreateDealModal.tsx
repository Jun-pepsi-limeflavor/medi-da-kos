"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";

export interface QualifiedIntakeSummary {
  id: string; // intakeReviewId
  source: string;
  externalId: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface Props {
  qualifiedIntakes: QualifiedIntakeSummary[];
}

export default function CreateDealModal({ qualifiedIntakes }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [intakeReviewId, setIntakeReviewId] = useState(
    qualifiedIntakes[0]?.id || ""
  );
  const [reference, setReference] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("미국 (USA)");

  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [shippingCountry, setShippingCountry] = useState("미국 (USA)");
  const [postalCode, setPostalCode] = useState("");
  const [taxId, setTaxId] = useState("");

  const [targetSampleDate, setTargetSampleDate] = useState("");
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("");
  const [certifications, setCertifications] = useState("CPNP, FDA");
  const [additionalRequests, setAdditionalRequests] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!intakeReviewId) {
      setError("승인된(qualified) 인테이크를 선택해주세요.");
      return;
    }
    if (!reference.trim()) {
      setError("딜 레퍼런스는 필수입니다.");
      return;
    }
    if (!companyName.trim() || !contactName.trim() || !email.trim()) {
      setError("바이어 회사명, 담당자명, 이메일은 필수입니다.");
      return;
    }

    setLoading(true);

    const payload = {
      intakeReviewId,
      reference: reference.trim(),
      buyerId: buyerId.trim() || email.trim().toLowerCase(),
      stageBrand: 1,
      buyerInfo: {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        country: country.trim(),
      },
      shippingInfo: {
        recipientName: (recipientName.trim() || contactName.trim()),
        addressLine1: addressLine1.trim() || "본사 확인 대기",
        city: city.trim(),
        country: shippingCountry.trim() || country.trim(),
        postalCode: postalCode.trim(),
        taxId: taxId.trim() || undefined,
      },
      certifications: certifications
        ? certifications.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
      timeline: {
        targetSampleDate: targetSampleDate || undefined,
        targetDeliveryDate: targetDeliveryDate || undefined,
      },
      additionalRequests: additionalRequests.trim(),
      payment: {
        samplePayment: { status: "unpaid" },
        mainPayment: { status: "unpaid", escrowStatus: "none" },
      },
    };

    try {
      const res = await fetch("/api/admin/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "딜 생성 실패");
      }

      setIsOpen(false);
      router.refresh();
      if (data.id) {
        router.push(`/admin/deals/${data.id}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4" />
        신규 딜 등록 (Add Deal)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-neutral-100">신규 딜 개설</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  승인된(Qualified) 인테이크를 기반으로 공식 딜 원장을 생성합니다.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {error && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. 인테이크 선택 */}
              <div className="space-y-1.5">
                <label className="block font-medium text-neutral-300">
                  승인 인테이크 (Qualified Intake) <span className="text-rose-400">*</span>
                </label>
                {qualifiedIntakes.length > 0 ? (
                  <select
                    value={intakeReviewId}
                    onChange={(e) => setIntakeReviewId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-indigo-500"
                    required
                  >
                    {qualifiedIntakes.map((intake) => (
                      <option key={intake.id} value={intake.id}>
                        [{intake.source}] ID: {intake.externalId} (인테이크 키: {intake.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300">
                    전환 가능한 승인(qualified) 상태의 인테이크가 없습니다.
                    <br />
                    수기 인테이크 ID를 직접 입력하세요:
                    <input
                      type="text"
                      value={intakeReviewId}
                      onChange={(e) => setIntakeReviewId(e.target.value)}
                      placeholder="예: order-12345 또는 intake-key"
                      className="mt-2 w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                      required
                    />
                  </div>
                )}
              </div>

              {/* 2. 기본 딜 정보 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-medium text-neutral-300">
                    딜 레퍼런스명 (Reference) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="예: Bala 10ml Lip SPF 15 PO"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-medium text-neutral-300">바이어 ID / 계정 식별자</label>
                  <input
                    type="text"
                    value={buyerId}
                    onChange={(e) => setBuyerId(e.target.value)}
                    placeholder="미입력 시 바이어 이메일로 지정"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 3. 바이어 정보 */}
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-3">
                <h4 className="font-semibold text-neutral-200">바이어 정보 (Buyer Info)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">회사명 / 브랜드 *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="House of Seoul"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">담당자 이름 *</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Bala Pinnamaneni"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">이메일 *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="bala@example.com"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">국가 *</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setShippingCountry(e.target.value);
                      }}
                      placeholder="미국 (USA), 인도 등"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">연락처</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1-555-0199"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                </div>
              </div>

              {/* 4. 배송 정보 */}
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-3">
                <h4 className="font-semibold text-neutral-200">배송 정보 (Shipping Info)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">수령인</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="미입력 시 바이어 담당자명 적용"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">배송지 국가</label>
                    <input
                      type="text"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-neutral-400 mb-1">배송 주소 (Line 1)</label>
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="123 Ocean Ave"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">도시</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="San Francisco"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">우편번호</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="94105"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      세금 번호 (Tax ID / CPF / CNPJ)
                    </label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="브라질 등 배송 시 필수"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                    />
                  </div>
                </div>
              </div>

              {/* 5. 일정 및 인증 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">목표 샘플 완료일</label>
                  <input
                    type="date"
                    value={targetSampleDate}
                    onChange={(e) => setTargetSampleDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">목표 본품 납기일</label>
                  <input
                    type="date"
                    value={targetDeliveryDate}
                    onChange={(e) => setTargetDeliveryDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">요구 인증 (쉼표 구분)</label>
                  <input
                    type="text"
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    placeholder="CPNP, FDA, ISO22716"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">추가 요청사항</label>
                <textarea
                  value={additionalRequests}
                  onChange={(e) => setAdditionalRequests(e.target.value)}
                  rows={2}
                  placeholder="특이사항, 바이어 요청 조건 등"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                />
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                >
                  {loading ? "생성 중..." : "딜 생성 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
