"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  AlertCircle,
  Package,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { type DealItemInput } from "@/lib/schemas/deal";

export interface QualifiedIntakeSummary {
  id: string; // intakeReviewId
  source: string;
  externalId: string;
  email?: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  country?: string;
  shippingInfo?: {
    recipientName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    taxId?: string;
  };
  certifications?: string[];
  timeline?: {
    targetSampleDate?: string;
    targetDeliveryDate?: string;
  };
  additionalRequests?: string;
  items?: DealItemInput[];
  rawSummary?: string;
  rawDetails?: Record<string, unknown>;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DealPrefillData {
  intakeReviewId?: string;
  reference?: string;
  buyerId?: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  country?: string;
  recipientName?: string;
  addressLine1?: string;
  city?: string;
  shippingCountry?: string;
  postalCode?: string;
  taxId?: string;
  targetSampleDate?: string;
  targetDeliveryDate?: string;
  certifications?: string;
  additionalRequests?: string;
  items?: DealItemInput[];
}

interface Props {
  qualifiedIntakes: QualifiedIntakeSummary[];
  prefillData?: DealPrefillData;
  autoOpen?: boolean;
}

const DEFAULT_ITEM: DealItemInput = {
  productType: "스킨케어 화장품",
  variantName: "",
  volume: "50ml",
  quantity: 1000,
  formulaSpec: {
    targetTexture: "",
    keyIngredients: "",
    scent: "",
    color: "",
    notes: "",
  },
  packagingSpec: {
    containerType: "",
    material: "",
    closure: "",
    notes: "",
  },
};

export default function CreateDealModal({
  qualifiedIntakes,
  prefillData,
  autoOpen = false,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const initialIntake =
    qualifiedIntakes.find((q) => q.id === prefillData?.intakeReviewId) ||
    qualifiedIntakes[0];

  // Form State
  const [intakeReviewId, setIntakeReviewId] = useState(
    prefillData?.intakeReviewId || qualifiedIntakes[0]?.id || ""
  );
  const [reference, setReference] = useState(() => {
    if (prefillData?.reference) return prefillData.reference;
    if (initialIntake) {
      const brand = initialIntake.companyName || initialIntake.contactName || "";
      const itemText = initialIntake.items?.[0]?.productType || "";
      const volText = initialIntake.items?.[0]?.volume ? ` ${initialIntake.items[0].volume}` : "";
      if (brand) return `${brand} ${itemText}${volText} PO`.trim();
    }
    return "";
  });

  const [buyerId, setBuyerId] = useState(
    prefillData?.buyerId || initialIntake?.email || ""
  );
  const [companyName, setCompanyName] = useState(
    prefillData?.companyName || initialIntake?.companyName || ""
  );
  const [contactName, setContactName] = useState(
    prefillData?.contactName || initialIntake?.contactName || ""
  );
  const [email, setEmail] = useState(
    prefillData?.email || initialIntake?.email || ""
  );
  const [phone, setPhone] = useState(
    prefillData?.phone || initialIntake?.phone || ""
  );
  const [country, setCountry] = useState(
    prefillData?.country || initialIntake?.country || "미국 (USA)"
  );

  const [recipientName, setRecipientName] = useState(
    prefillData?.recipientName || initialIntake?.shippingInfo?.recipientName || ""
  );
  const [addressLine1, setAddressLine1] = useState(
    prefillData?.addressLine1 || initialIntake?.shippingInfo?.addressLine1 || ""
  );
  const [city, setCity] = useState(
    prefillData?.city || initialIntake?.shippingInfo?.city || ""
  );
  const [shippingCountry, setShippingCountry] = useState(
    prefillData?.shippingCountry ||
      initialIntake?.shippingInfo?.country ||
      prefillData?.country ||
      initialIntake?.country ||
      "미국 (USA)"
  );
  const [postalCode, setPostalCode] = useState(
    prefillData?.postalCode || initialIntake?.shippingInfo?.postalCode || ""
  );
  const [taxId, setTaxId] = useState(
    prefillData?.taxId || initialIntake?.shippingInfo?.taxId || ""
  );

  const [targetSampleDate, setTargetSampleDate] = useState(
    prefillData?.targetSampleDate || initialIntake?.timeline?.targetSampleDate || ""
  );
  const [targetDeliveryDate, setTargetDeliveryDate] = useState(
    prefillData?.targetDeliveryDate || initialIntake?.timeline?.targetDeliveryDate || ""
  );
  const [certifications, setCertifications] = useState(
    prefillData?.certifications ||
      (initialIntake?.certifications && initialIntake.certifications.length > 0
        ? initialIntake.certifications.join(", ")
        : "CPNP, FDA")
  );
  const [additionalRequests, setAdditionalRequests] = useState(
    prefillData?.additionalRequests || initialIntake?.additionalRequests || ""
  );

  // Items State
  const [items, setItems] = useState<DealItemInput[]>(() => {
    if (prefillData?.items && prefillData.items.length > 0) {
      return prefillData.items;
    }
    if (initialIntake?.items && initialIntake.items.length > 0) {
      return initialIntake.items;
    }
    return [{ ...DEFAULT_ITEM }];
  });

  const selectedIntake = qualifiedIntakes.find((q) => q.id === intakeReviewId);

  const handleIntakeChange = (selectedId: string) => {
    setIntakeReviewId(selectedId);
    const selected = qualifiedIntakes.find((q) => q.id === selectedId);
    if (!selected) return;

    if (selected.email) {
      setEmail(selected.email);
      setBuyerId(selected.email);
    }
    if (selected.companyName) setCompanyName(selected.companyName);
    if (selected.contactName) setContactName(selected.contactName);
    if (selected.phone) setPhone(selected.phone);
    if (selected.country) {
      setCountry(selected.country);
      setShippingCountry(selected.shippingInfo?.country || selected.country);
    }

    if (selected.shippingInfo) {
      if (selected.shippingInfo.recipientName) setRecipientName(selected.shippingInfo.recipientName);
      if (selected.shippingInfo.addressLine1) setAddressLine1(selected.shippingInfo.addressLine1);
      if (selected.shippingInfo.city) setCity(selected.shippingInfo.city);
      if (selected.shippingInfo.postalCode) setPostalCode(selected.shippingInfo.postalCode);
      if (selected.shippingInfo.taxId) setTaxId(selected.shippingInfo.taxId);
    }

    if (selected.certifications && selected.certifications.length > 0) {
      setCertifications(selected.certifications.join(", "));
    }

    if (selected.timeline) {
      if (selected.timeline.targetSampleDate) setTargetSampleDate(selected.timeline.targetSampleDate);
      if (selected.timeline.targetDeliveryDate) setTargetDeliveryDate(selected.timeline.targetDeliveryDate);
    }

    if (selected.additionalRequests) {
      setAdditionalRequests(selected.additionalRequests);
    }

    if (selected.items && selected.items.length > 0) {
      setItems(selected.items);
      const brand = selected.companyName || selected.contactName || "Deal";
      const firstItem = selected.items[0];
      const itemText = firstItem?.productType || "";
      const volText = firstItem?.volume ? ` ${firstItem.volume}` : "";
      setReference(`${brand} ${itemText}${volText} PO`.trim());
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert("최소 1개 이상의 요청 제품이 필요합니다.");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof DealItemInput, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleFormulaChange = (index: number, field: string, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const currentFormula = next[index].formulaSpec || {};
      next[index] = {
        ...next[index],
        formulaSpec: {
          ...currentFormula,
          [field]: value || undefined,
        },
      };
      return next;
    });
  };

  const handlePackagingChange = (index: number, field: string, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const currentPackaging = next[index].packagingSpec || {};
      next[index] = {
        ...next[index],
        packagingSpec: {
          ...currentPackaging,
          [field]: value || undefined,
        },
      };
      return next;
    });
  };

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

    if (items.length === 0) {
      setError("최소 1개 이상의 제품이 필요합니다.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productType.trim()) {
        setError(`제품 #${i + 1}의 제품 종류/명칭을 입력해주세요.`);
        return;
      }
      if (!items[i].quantity || items[i].quantity <= 0) {
        setError(`제품 #${i + 1}의 수량은 1 이상의 정수여야 합니다.`);
        return;
      }
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
        recipientName: recipientName.trim() || contactName.trim(),
        addressLine1: addressLine1.trim() || "본사 확인 대기",
        city: city.trim(),
        country: shippingCountry.trim() || country.trim(),
        postalCode: postalCode.trim(),
        taxId: taxId.trim() || undefined,
      },
      items: items.map((it) => ({
        productType: it.productType.trim(),
        variantName: it.variantName?.trim() || "",
        volume: it.volume?.trim() || "",
        quantity: Math.floor(it.quantity),
        formulaSpec: {
          targetTexture: it.formulaSpec?.targetTexture?.trim() || undefined,
          keyIngredients: it.formulaSpec?.keyIngredients?.trim() || undefined,
          scent: it.formulaSpec?.scent?.trim() || undefined,
          color: it.formulaSpec?.color?.trim() || undefined,
          notes: it.formulaSpec?.notes?.trim() || undefined,
        },
        packagingSpec: {
          containerType: it.packagingSpec?.containerType?.trim() || undefined,
          material: it.packagingSpec?.material?.trim() || undefined,
          closure: it.packagingSpec?.closure?.trim() || undefined,
          notes: it.packagingSpec?.notes?.trim() || undefined,
        },
      })),
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-neutral-100 flex items-center gap-2">
                  <span>신규 딜 개설</span>
                  <span className="text-[11px] bg-indigo-950 text-indigo-400 border border-indigo-800/80 px-2 py-0.5 rounded-full font-normal">
                    공식 원장 & 제품 등록
                  </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  승인된(Qualified) 인테이크의 고객 요청 내역을 바탕으로 딜과 제품을 일괄 생성합니다.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition"
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
                    onChange={(e) => handleIntakeChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-indigo-500"
                    required
                  >
                    {prefillData?.intakeReviewId &&
                      !qualifiedIntakes.some((q) => q.id === prefillData.intakeReviewId) && (
                        <option value={prefillData.intakeReviewId}>
                          [사전입력] {prefillData.email || prefillData.intakeReviewId}
                        </option>
                      )}
                    {qualifiedIntakes.map((intake) => (
                      <option key={intake.id} value={intake.id}>
                        [{intake.source}] {intake.email || `ID: ${intake.externalId}`}
                        {intake.companyName ? ` (${intake.companyName})` : ""}
                        {intake.items && intake.items[0]?.productType ? ` — ${intake.items[0].productType}` : ""}
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

              {/* 1-1. 인테이크 원천 미리보기 카드 */}
              {selectedIntake && (
                <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full px-3.5 py-2.5 bg-neutral-950 flex items-center justify-between text-neutral-300 hover:text-neutral-100 transition text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>인테이크 원천 내용 미리보기</span>
                      <span className="text-[11px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                        {selectedIntake.source}
                      </span>
                    </span>
                    {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showPreview && (
                    <div className="p-3.5 pt-1 space-y-2 border-t border-neutral-800/60 text-[11px] text-neutral-300">
                      {selectedIntake.rawSummary && (
                        <div className="p-2 bg-neutral-900/90 rounded-lg border border-neutral-800/80 text-neutral-200">
                          <span className="font-semibold text-neutral-400 block mb-0.5">요약/메시지:</span>
                          <p className="whitespace-pre-wrap leading-relaxed">{selectedIntake.rawSummary}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-neutral-400">
                        <div>
                          <span className="text-neutral-500 block">바이어/문의자:</span>
                          <span className="text-neutral-200 font-medium">{selectedIntake.contactName || selectedIntake.companyName || "—"}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">이메일:</span>
                          <span className="text-neutral-200 font-mono">{selectedIntake.email || "—"}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">국가:</span>
                          <span className="text-neutral-200">{selectedIntake.country || selectedIntake.shippingInfo?.country || "—"}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">요청 제품 수:</span>
                          <span className="text-neutral-200 font-semibold">{selectedIntake.items?.length || 1}개 품목</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

              {/* 3. 요청 제품 목록 (Deal Items Editor) */}
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800/70 pb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-semibold text-neutral-200">요청 제품 목록 (Deal Items)</h4>
                    <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full font-mono">
                      {items.length}개 품목
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-600/50 text-indigo-300 rounded-lg text-xs flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>제품 추가</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-2.5 relative"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/50">
                        <span className="font-semibold text-neutral-300 text-xs flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-300 text-[10px] flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span>품목 정보 #{idx + 1}</span>
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-neutral-500 hover:text-rose-400 p-1 transition"
                            title="품목 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* 1st Row: Basic specs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-neutral-400 mb-1">제품 종류 / 명칭 *</label>
                          <input
                            type="text"
                            value={item.productType}
                            onChange={(e) => handleItemChange(idx, "productType", e.target.value)}
                            placeholder="예: 수분 진정 크림, Lip Balm"
                            required
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">용량 / 규격</label>
                          <input
                            type="text"
                            value={item.volume || ""}
                            onChange={(e) => handleItemChange(idx, "volume", e.target.value)}
                            placeholder="예: 50ml, 100g"
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">수량 (개) *</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                            min={1}
                            required
                            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-200 font-mono"
                          />
                        </div>
                      </div>

                      {/* 2nd Row: Formula & Packaging Specs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">제형 특성 / 핵심 성분</label>
                          <input
                            type="text"
                            value={item.formulaSpec?.keyIngredients || item.formulaSpec?.targetTexture || ""}
                            onChange={(e) => handleFormulaChange(idx, "keyIngredients", e.target.value)}
                            placeholder="예: 병풀추출물, 촉촉한 젤 텍스처, 무향"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-neutral-200 text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">용기 / 패키징 사양</label>
                          <input
                            type="text"
                            value={item.packagingSpec?.containerType || item.packagingSpec?.notes || ""}
                            onChange={(e) => handlePackagingChange(idx, "containerType", e.target.value)}
                            placeholder="예: 유리 에어로졸 펌프 용기, 단상자 포함"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-neutral-200 text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. 바이어 정보 */}
              <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-3">
                <h4 className="font-semibold text-neutral-200">바이어 정보 (Buyer Info)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">회사명 / 브랜드 *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="예: House of Seoul"
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
                      placeholder="예: Deem Alsaif"
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
                      placeholder="buyer@example.com"
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
                      placeholder="예: 미국 (USA)"
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

              {/* 5. 배송 정보 */}
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
                    <label className="block text-[11px] text-neutral-400 mb-1">세금 번호 (Tax ID)</label>
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

              {/* 6. 일정 및 인증 */}
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
