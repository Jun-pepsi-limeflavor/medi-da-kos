"use client";

import React, { useState } from "react";
import { Lock, Eye, RefreshCw, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import type { DealFinance, DealFinanceInput } from "@/lib/schemas/deal-finance";

interface Props {
  dealId: string;
}

export default function FinanceSection({ dealId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [finance, setFinance] = useState<DealFinance | null>(null);

  // Form edit states
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("KRW");
  const [fxRate, setFxRate] = useState<string>("");
  const [fxSource, setFxSource] = useState<string>("하나은행 고시환율");

  const [buyerUnitPrice, setBuyerUnitPrice] = useState<string>("");
  const [buyerTotalValue, setBuyerTotalValue] = useState<string>("");

  const [grossProfitAmount, setGrossProfitAmount] = useState<string>("");
  const [marginPct, setMarginPct] = useState<string>("");

  const handleFetchFinance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/finance`);
      if (!res.ok) {
        throw new Error("재무 정보를 불러오지 못했습니다.");
      }
      const data = await res.json();
      const f: DealFinance | null = data.finance;
      setFinance(f);
      setIsOpen(true);

      if (f) {
        if (f.fxSnapshot) {
          setFxRate(String(f.fxSnapshot.rate));
          setBaseCurrency(f.fxSnapshot.base);
          setQuoteCurrency(f.fxSnapshot.quote);
          setFxSource(f.fxSnapshot.source);
        }
        if (f.buyerQuote) {
          setBuyerUnitPrice(String(f.buyerQuote.unitPrice.amount));
          setBuyerTotalValue(String(f.buyerQuote.totalValue.amount));
        }
        if (f.grossProfit) {
          setGrossProfitAmount(String(f.grossProfit.amount));
        }
        if (f.margin !== undefined) {
          setMarginPct(String(f.margin));
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFinance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: DealFinanceInput = {
      supplierQuotes: finance?.supplierQuotes ?? [],
      internalCosts: finance?.internalCosts ?? [],
      fxSnapshot: fxRate
        ? {
            rate: parseFloat(fxRate),
            base: baseCurrency,
            quote: quoteCurrency,
            asOf: new Date().toISOString(),
            source: fxSource || "매뉴얼 입력",
          }
        : undefined,
      buyerQuote: buyerUnitPrice
        ? {
            unitPrice: { amount: parseFloat(buyerUnitPrice), currency: baseCurrency },
            totalValue: { amount: parseFloat(buyerTotalValue || "0"), currency: baseCurrency },
          }
        : undefined,
      grossProfit: grossProfitAmount
        ? { amount: parseFloat(grossProfitAmount), currency: baseCurrency }
        : undefined,
      margin: marginPct ? parseFloat(marginPct) : undefined,
    };

    try {
      const res = await fetch(`/api/admin/deals/${dealId}/finance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "재무 정보 저장 실패");
      }

      setSuccess("재무 정보가 안전하게 저장되었습니다.");
      await handleFetchFinance();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-neutral-800 text-amber-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
              원가 및 재무 원장
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded font-medium">
                보안 격리 (Private)
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              바이어에게 노출되지 않는 Medidakos 전용 내부 재무 원장입니다.
            </p>
          </div>
        </div>

        {!isOpen ? (
          <button
            onClick={handleFetchFinance}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            재무 정보 조회 (보안 격리 해제)
          </button>
        ) : (
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition shrink-0"
          >
            접기 / 잠금
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {isOpen && (
        <form onSubmit={handleSaveFinance} className="space-y-5 pt-2 text-xs">
          {/* FX Snapshot */}
          <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-3">
            <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-blue-400" />
              환율 스냅샷 (FX Snapshot)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">기준 환율</label>
                <input
                  type="number"
                  step="0.01"
                  value={fxRate}
                  onChange={(e) => setFxRate(e.target.value)}
                  placeholder="예: 1350.5"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">기본 통화</label>
                <input
                  type="text"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                  placeholder="USD"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">상대 통화</label>
                <input
                  type="text"
                  value={quoteCurrency}
                  onChange={(e) => setQuoteCurrency(e.target.value.toUpperCase())}
                  placeholder="KRW"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">환율 출처</label>
                <input
                  type="text"
                  value={fxSource}
                  onChange={(e) => setFxSource(e.target.value)}
                  placeholder="하나은행 매매기준율"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200"
                />
              </div>
            </div>
          </div>

          {/* Buyer Quote & Profit Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-3">
              <h4 className="font-semibold text-neutral-200">바이어 견적 (Buyer Quote)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">단가 ({baseCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={buyerUnitPrice}
                    onChange={(e) => setBuyerUnitPrice(e.target.value)}
                    placeholder="3.50"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">총액 ({baseCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={buyerTotalValue}
                    onChange={(e) => setBuyerTotalValue(e.target.value)}
                    placeholder="17500"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-3">
              <h4 className="font-semibold text-neutral-200">손익 요약</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">총 마진 ({baseCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={grossProfitAmount}
                    onChange={(e) => setGrossProfitAmount(e.target.value)}
                    placeholder="5200"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-emerald-400 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">마진율 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={marginPct}
                    onChange={(e) => setMarginPct(e.target.value)}
                    placeholder="45.5"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-emerald-400 font-mono font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Quotes List (if any) */}
          {finance?.supplierQuotes && finance.supplierQuotes.length > 0 && (
            <div className="p-3.5 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-2">
              <h4 className="font-semibold text-neutral-200">등록된 공급자 견적 이력</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-neutral-500 border-b border-neutral-800">
                    <tr>
                      <th className="py-2">버전</th>
                      <th className="py-2">수량구간</th>
                      <th className="py-2">단가</th>
                      <th className="py-2">Incoterm</th>
                      <th className="py-2">유효기간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {finance.supplierQuotes.map((q) => (
                      <tr key={q.id}>
                        <td className="py-2 font-mono">v{q.version}</td>
                        <td className="py-2 font-mono">{q.quantityTier.toLocaleString()}개</td>
                        <td className="py-2 font-mono text-neutral-200">
                          {q.unitCost.amount.toLocaleString()} {q.unitCost.currency}
                        </td>
                        <td className="py-2 text-neutral-400">{q.incoterm || "—"}</td>
                        <td className="py-2 text-neutral-400 font-mono">{q.validUntil ? q.validUntil.slice(0, 10) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
            >
              {saving ? "저장 중..." : "재무 원장 저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
