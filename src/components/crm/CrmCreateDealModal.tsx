"use client";

import React, { useState } from "react";
import { CrmDeal } from "@/lib/crm-types";
import { X, Plus } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreate: (newDeal: CrmDeal) => void;
}

export default function CrmCreateDealModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerCountry, setBuyerCountry] = useState("🇺🇸 USA");
  const [productType, setProductType] = useState("Serum");
  const [buyerTotalQty, setBuyerTotalQty] = useState<number>(3000);
  const [buyerUnitPrice, setBuyerUnitPrice] = useState<number>(3.5);
  const [supplierUnitPriceKrw, setSupplierUnitPriceKrw] = useState<number>(1800);
  const [supplierName, setSupplierName] = useState("그린코스");
  const [pmName, setPmName] = useState("이기욱 (Thomas)");
  const [priority, setPriority] = useState<"hot" | "warm" | "cold">("warm");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !buyerName.trim()) return;

    const buyerTotalValue = buyerTotalQty * buyerUnitPrice;
    const newDeal = {
      id: "deal-" + Date.now(),
      title,
      buyerId: "buyer-" + Date.now(),
      buyerName,
      buyerCountry,
      supplierId: "supp-" + Date.now(),
      supplierName,
      pmName,
      stageBrand: 1,
      priority,
      buyerUnitPrice,
      buyerTotalQty,
      buyerTotalValue,
      productSpec: {
        productType,
        volumeMl: 50,
        containerType: "Standard Container",
        keyIngredients: ["Main Active Component"],
        sampleStatus: "not_started",
      },
      inquiryDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).slice(0, 16),
    };

    onCreate(newDeal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            신규 딜 (Inquiry / Lead) 등록
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-neutral-400 font-medium mb-1">딜 제목 (Deal Title) *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Brand Name - Product Name 50ml"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 font-medium mb-1">바이어 / 브랜드명 *</label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="예: Cloud Skincare"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-neutral-400 font-medium mb-1">바이어 국가</label>
              <input
                type="text"
                value={buyerCountry}
                onChange={(e) => setBuyerCountry(e.target.value)}
                placeholder="🇺🇸 USA, 🇮🇳 India 등"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 font-medium mb-1">품목 종류 (Product Type)</label>
              <input
                type="text"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="Serum, Cream, Lip Gloss..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-neutral-400 font-medium mb-1">우선순위 (Priority)</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="hot">🔥 HOT (급건 / 핵심)</option>
                <option value="warm">⚡ WARM (일반)</option>
                <option value="cold">❄️ COLD (미정)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
            <div>
              <label className="block text-neutral-400 font-medium mb-1">바이어 제시 단가 ($ USD)</label>
              <input
                type="number"
                step="0.1"
                value={buyerUnitPrice}
                onChange={(e) => setBuyerUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-neutral-400 font-medium mb-1">요청 수량 (MOQ/Qty)</label>
              <input
                type="number"
                value={buyerTotalQty}
                onChange={(e) => setBuyerTotalQty(parseInt(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 font-medium mb-1">공장 공급단가 (₩ KRW)</label>
              <input
                type="number"
                value={supplierUnitPriceKrw}
                onChange={(e) => setSupplierUnitPriceKrw(parseInt(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-neutral-400 font-medium mb-1">배정 공장 (Supplier)</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="그린코스, 피에프네이처..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all cursor-pointer"
            >
              딜 생성하기
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
