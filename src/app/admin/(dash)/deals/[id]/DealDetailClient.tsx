"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BRAND_STAGES,
  FACTORY_STAGES,
  findViolations,
  type Violation,
} from "@/lib/stages";
import type {
  DealDetails,
  DealItem,
  SupplierEngagement,
  SampleRound,
  Shipment,
  DealTask,
  DealEvent,
} from "@/lib/schemas/deal";
import type { Supplier } from "@/lib/schemas/supplier";
import FinanceSection from "./FinanceSection";
import {
  ArrowLeft,
  AlertTriangle,
  Package,
  Factory,
  FlaskConical,
  Truck,
  ListTodo,
  History,
  Plus,
  X,
  AlertCircle,
  Check,
  Building2,
  Send,
  FileText,
  Pencil,
} from "lucide-react";

interface Props {
  initialDeal: DealDetails;
  allSuppliers: Supplier[];
  conversation: React.ReactNode;
}

const WAITING_ON_BADGES: Record<string, { label: string; bg: string }> = {
  us: { label: "본사 (HQ)", bg: "bg-blue-950 text-blue-300 border-blue-800" },
  buyer: { label: "바이어 (Buyer)", bg: "bg-amber-950 text-amber-300 border-amber-800" },
  supplier: { label: "제조사 (Supplier)", bg: "bg-purple-950 text-purple-300 border-purple-800" },
  carrier: { label: "운송사 (Carrier)", bg: "bg-cyan-950 text-cyan-300 border-cyan-800" },
};

const QC_STATUS_BADGES: Record<string, { label: string; bg: string }> = {
  pending: { label: "QC 대기", bg: "bg-neutral-800 text-neutral-300 border-neutral-700" },
  passed: { label: "QC 통과", bg: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  failed: { label: "QC 불합격", bg: "bg-rose-950 text-rose-300 border-rose-800" },
  waived: { label: "직송 면제", bg: "bg-purple-950 text-purple-300 border-purple-800" },
};

export default function DealDetailClient({ initialDeal, allSuppliers, conversation }: Props) {
  const router = useRouter();
  const [dealData, setDealData] = useState<DealDetails>(initialDeal);
  const dealId = dealData.deal.id;

  // Active section tab
  const [activeTab, setActiveTab] = useState<
    "items" | "engagements" | "samples" | "shipments" | "tasks" | "events" | "finance"
  >("items");

  // Stage transition modal & states
  const [stageLoading, setStageLoading] = useState(false);
  const [gateBlockedError, setGateBlockedError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    violations: Violation[];
    pendingPayload: {
      track: "brand" | "factory";
      target: number;
      engagementId?: string;
      itemId?: string;
    };
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Modals for subcollections
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddEngagementModalOpen, setIsAddEngagementModalOpen] = useState(false);
  const [replacementEngagement, setReplacementEngagement] = useState<SupplierEngagement | null>(null);
  const [isAddSampleModalOpen, setIsAddSampleModalOpen] = useState(false);
  const [isAddShipmentModalOpen, setIsAddShipmentModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  // New Note
  const [newNote, setNewNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Quick reload function
  const reloadDeal = async () => {
    try {
      const res = await fetch(`/api/admin/deals/${dealId}`);
      if (res.ok) {
        const full = await res.json();
        setDealData(full);
      }
    } catch {
      router.refresh();
    }
  };

  // Stage transition handler
  const handleRequestStageChange = async (
    params: {
      track: "brand" | "factory";
      target: number;
      engagementId?: string;
      itemId?: string;
    },
    isOverride = false
  ) => {
    setStageLoading(true);
    setGateBlockedError(null);

    const payload = {
      ...params,
      override: isOverride,
      reason: isOverride ? overrideReason.trim() : undefined,
    };

    try {
      const res = await fetch(`/api/admin/deals/${dealId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409) {
        // Hard gate failure (cannot override)
        setGateBlockedError(
          data.error || "하드 게이트 요건 미충족으로 단계를 변경할 수 없습니다."
        );
        setConfirmModal(null);
        return;
      }

      if (res.status === 200 && data.needsConfirm) {
        // Dependency violation: needs confirmation & reason
        setConfirmModal({
          violations: data.violations || [],
          pendingPayload: params,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "단계 변경 실패");
      }

      // Success
      setConfirmModal(null);
      setOverrideReason("");
      await reloadDeal();
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || "오류가 발생했습니다.");
    } finally {
      setStageLoading(false);
    }
  };

  // Submit override
  const handleConfirmOverride = () => {
    if (!confirmModal) return;
    if (!overrideReason.trim()) {
      alert("오버라이드 사유를 입력해주세요.");
      return;
    }
    handleRequestStageChange(confirmModal.pendingPayload, true);
  };

  // Task completion
  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "complete" }),
      });
      if (res.ok) {
        await reloadDeal();
      }
    } catch {
      alert("태스크 완료 처리 실패");
    }
  };

  // Append Event Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newNote.trim() }),
      });
      if (res.ok) {
        setNewNote("");
        await reloadDeal();
      }
    } catch {
      alert("메모 추가 실패");
    } finally {
      setNoteLoading(false);
    }
  };

  // Violations computation
  const currentViolations = findViolations({
    stageBrand: dealData.deal.stageBrand,
    engagements: dealData.supplierEngagements,
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Navigation & Title */}
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/deals"
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            딜 파이프라인 보드로 돌아가기
          </Link>
          <span className="text-xs font-mono text-neutral-500">ID: {dealId}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-neutral-100">
                {dealData.deal.reference}
              </h1>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-neutral-900 border-neutral-700 text-neutral-300">
                {dealData.deal.buyerInfo.country || "국가 미정"}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
              <span>바이어: <strong className="text-neutral-200">{dealData.deal.buyerInfo.companyName}</strong></span>
              <span>·</span>
              <span>담당자: {dealData.deal.buyerInfo.contactName} ({dealData.deal.buyerInfo.email})</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-indigo-950/80 border border-indigo-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <div>
                <span className="text-[10px] text-indigo-300 block leading-tight font-medium">
                  현재 브랜드 단계
                </span>
                <span className="text-xs font-bold text-neutral-100 font-mono">
                  {dealData.deal.stageBrand}단계.{" "}
                  {BRAND_STAGES.find((s) => s.id === dealData.deal.stageBrand)?.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Violations Banner */}
        {currentViolations.length > 0 && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-rose-300">
                디펜던시 미충족 (Dependency Warning)
              </h4>
              <ul className="text-xs text-rose-200 list-disc list-inside space-y-0.5">
                {currentViolations.map((v, i) => (
                  <li key={i}>{v.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 2. Stage Transition Controller (Core Feature) */}
      {conversation}

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
              단계 전이 컨트롤러 (Stage Transitions)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              하드 게이트(결제/운송장) 차단은 오버라이드가 불가하며, 디펜던시 미충족 시 사유를 남겨 전환할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Hard Gate Error Alert */}
        {gateBlockedError && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">[하드 게이트 차단] 전환할 수 없습니다</span>
              <span>{gateBlockedError}</span>
              <p className="text-[11px] text-red-400 mt-1">
                ※ 하드 게이트 차단은 필수 선결 조건(운송장 번호 등록, 에스크로 입금 등)이 충족되기 전까지 오버라이드로도 진행할 수 없습니다.
              </p>
            </div>
          </div>
        )}

        {/* Brand Stage Controls */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-300">
            브랜드 단계 변경 (1~8단계)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
            {BRAND_STAGES.map((s) => {
              const isCurrent = dealData.deal.stageBrand === s.id;
              return (
                <button
                  key={s.id}
                  disabled={stageLoading || isCurrent}
                  onClick={() =>
                    handleRequestStageChange({ track: "brand", target: s.id })
                  }
                  className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                    isCurrent
                      ? "bg-indigo-950 border-indigo-600 ring-1 ring-indigo-500 cursor-default"
                      : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 cursor-pointer"
                  }`}
                >
                  <span className="text-[10px] text-neutral-500 font-mono">Stage {s.id}</span>
                  <span
                    className={`font-semibold mt-1 block truncate ${
                      isCurrent ? "text-indigo-300" : "text-neutral-200"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="text-[10px] text-neutral-500 block truncate">
                    {s.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Factory Stage Controls per Engagement */}
        {dealData.supplierEngagements.length > 0 && (
          <div className="pt-3 border-t border-neutral-800 space-y-3">
            <label className="block text-xs font-medium text-neutral-300">
              참여 제조사별 공장 단계 변경 (1~9단계)
            </label>
            <div className="space-y-3">
              {dealData.supplierEngagements.map((eng: SupplierEngagement) => {
                const supplierInfo = allSuppliers.find((s) => s.id === eng.supplierId);
                const supplierName = supplierInfo?.companyName || eng.supplierId;

                return (
                  <div
                    key={eng.id}
                    className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Factory className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="font-semibold text-xs text-neutral-200">
                          {supplierName}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            eng.contactStatus === "fix"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : eng.contactStatus === "drop"
                              ? "bg-neutral-800 text-neutral-400"
                              : "bg-blue-950 text-blue-400 border border-blue-800"
                          }`}
                        >
                          {eng.contactStatus === "fix" ? "확정(fix)" : eng.contactStatus === "drop" ? "기각(drop)" : "진행중(ing)"}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400 font-mono">
                        현재 공장: {eng.stageFactory}단계 (
                        {FACTORY_STAGES.find((s) => s.id === eng.stageFactory)?.label})
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                      {FACTORY_STAGES.map((fs) => {
                        const isCurrent = eng.stageFactory === fs.id;
                        return (
                          <button
                            key={fs.id}
                            disabled={stageLoading || isCurrent}
                            onClick={() =>
                              handleRequestStageChange({
                                track: "factory",
                                engagementId: eng.id,
                                target: fs.id,
                              })
                            }
                            className={`p-1.5 rounded-lg text-center border text-[11px] transition ${
                              isCurrent
                                ? "bg-purple-950 border-purple-600 text-purple-200 font-bold"
                                : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:bg-neutral-850"
                            }`}
                          >
                            <span className="block text-[9px] text-neutral-500">F{fs.id}</span>
                            <span className="truncate block">{fs.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Section Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-800 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab("items")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "items"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          제품 ({dealData.items.length})
        </button>

        <button
          onClick={() => setActiveTab("engagements")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "engagements"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Factory className="w-3.5 h-3.5" />
          공급사 관계 ({dealData.supplierEngagements.length})
        </button>

        <button
          onClick={() => setActiveTab("samples")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "samples"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          샘플 QC ({dealData.sampleRounds.length})
        </button>

        <button
          onClick={() => setActiveTab("shipments")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "shipments"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          배송 구간 ({dealData.shipments.length})
        </button>

        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "tasks"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          작업 태스크 ({dealData.tasks.length})
        </button>

        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "events"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          감사 타임라인 ({dealData.events.length})
        </button>

        <button
          onClick={() => setActiveTab("finance")}
          className={`px-4 py-2.5 font-medium border-b-2 transition shrink-0 flex items-center gap-1.5 ${
            activeTab === "finance"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          재무 정보 (격리)
        </button>
      </div>

      {/* 4. Tab Body Content */}
      <div className="pt-2">
        {/* TAB: ITEMS */}
        {activeTab === "items" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-neutral-200">
                제품 목록 (Items)
              </h3>
              <button
                onClick={() => setIsAddItemModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 제품 추가
              </button>
            </div>

            {dealData.items.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                등록된 제품이 없습니다. 새 제품을 추가하세요.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dealData.items.map((it: DealItem) => (
                  <div
                    key={it.id}
                    className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <div className="font-semibold text-sm text-neutral-100">
                        {it.productType}
                        {it.variantName ? ` · ${it.variantName}` : ""}
                      </div>
                      <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded">
                        수량: {it.quantity.toLocaleString()}개
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-neutral-300">
                      <div>
                        <span className="text-neutral-500 text-[11px] block">용량 (Volume)</span>
                        <span>{it.volume || "—"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">제형 사양</span>
                        <span>{it.formulaSpec?.targetTexture || "표준 제형"}</span>
                      </div>
                    </div>

                    {it.formulaSpec?.keyIngredients && (
                      <div className="text-xs bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80">
                        <span className="text-neutral-500 text-[10px] block mb-0.5">핵심 성분</span>
                        <span className="text-neutral-200">{it.formulaSpec.keyIngredients}</span>
                      </div>
                    )}

                    <div className="text-[11px] text-neutral-400">
                      용기: {it.packagingSpec?.containerType || "표준 용기"}{" "}
                      {it.packagingSpec?.material ? `(${it.packagingSpec.material})` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: ENGAGEMENTS */}
        {activeTab === "engagements" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-neutral-200">
                공급자 관계 목록 (Supplier Engagements)
              </h3>
              <button
                onClick={() => setIsAddEngagementModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 제조사 배정
              </button>
            </div>

            {dealData.supplierEngagements.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                배정된 제조사가 없습니다. 제조사를 연결해주세요.
              </div>
            ) : (
              <div className="space-y-3">
                {dealData.supplierEngagements.map((eng: SupplierEngagement) => {
                  const supp = allSuppliers.find((s) => s.id === eng.supplierId);
                  return (
                    <SupplierEngagementCard
                      key={eng.id}
                      dealId={dealId}
                      eng={eng}
                      supp={supp}
                      onReplace={(targetEng) => setReplacementEngagement(targetEng)}
                      onReload={reloadDeal}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: SAMPLES */}
        {activeTab === "samples" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-neutral-200">
                샘플 회차 및 QC 이력 (Sample Rounds)
              </h3>
              <button
                onClick={() => setIsAddSampleModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 샘플 회차 등록
              </button>
            </div>

            {dealData.sampleRounds.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                등록된 샘플 회차가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {dealData.sampleRounds.map((round: SampleRound) => (
                  <div
                    key={round.id}
                    className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                            round.roundNo >= 4
                              ? "bg-red-950 text-red-300 border-red-800"
                              : "bg-indigo-950 text-indigo-300 border-indigo-800"
                          }`}
                        >
                          샘플 {round.roundNo}차
                        </span>
                        <span className="text-xs text-neutral-300 font-mono">
                          제품 ID: {round.itemId}
                        </span>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded border font-medium ${
                          QC_STATUS_BADGES[round.qcStatus]?.bg || "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {QC_STATUS_BADGES[round.qcStatus]?.label || round.qcStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-neutral-500 text-[11px] block">생산 수량</span>
                        <span className="font-mono text-neutral-200">{round.producedQty ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">내부 보관 수량</span>
                        <span className="font-mono text-neutral-200">{round.retainedQty ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">HQ 입고일 (receivedAt)</span>
                        <span className="font-mono text-neutral-200">{round.receivedAt ? round.receivedAt.slice(0, 10) : "미입고"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">최종 판정</span>
                        <span className="font-mono text-neutral-200">{round.verdict || "진행 중"}</span>
                      </div>
                    </div>

                    {round.qcWaiverReason && (
                      <div className="p-2.5 bg-neutral-950 rounded-lg text-xs border border-purple-900/60 text-purple-200">
                        <span className="text-purple-400 font-semibold block text-[10px]">
                          직송 QC 면제 사유 (qcWaiverReason)
                        </span>
                        {round.qcWaiverReason}
                      </div>
                    )}

                    {round.feedbackNotes && (
                      <div className="p-2.5 bg-neutral-950 rounded-lg text-xs border border-neutral-800 text-neutral-300">
                        <span className="text-neutral-500 block text-[10px]">바이어 피드백</span>
                        {round.feedbackNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SHIPMENTS */}
        {activeTab === "shipments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-neutral-200">
                구간별 배송 목록 (Shipments)
              </h3>
              <button
                onClick={() => setIsAddShipmentModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 배송 구간 등록
              </button>
            </div>

            {dealData.shipments.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                등록된 배송 정보가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {dealData.shipments.map((s: Shipment) => (
                  <div
                    key={s.id}
                    className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-neutral-800 text-neutral-200 px-2 py-0.5 rounded">
                          {s.kind === "sample" ? "샘플 배송" : "본품 배송"}
                        </span>
                        <span className="text-xs font-mono text-indigo-300">
                          {s.route}
                        </span>
                      </div>

                      <span className="text-xs text-neutral-400 font-mono">
                        상태: {s.status || "접수"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-neutral-500 text-[11px] block">운송사 (Carrier)</span>
                        <span className="text-neutral-200">{s.carrier || "—"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">운송장 번호 (Tracking)</span>
                        <span className="text-neutral-200 font-mono font-medium">
                          {s.trackingNumber || "미등록 (게이트 차단 요인)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">연결 샘플 회차 ID</span>
                        <span className="text-neutral-400 font-mono">{s.sampleRoundId || "—"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: TASKS */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-neutral-200">
                작업 및 태스크 (Tasks)
              </h3>
              <button
                onClick={() => setIsAddTaskModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 새 작업 추가
              </button>
            </div>

            {dealData.tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                등록된 작업이 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5">
                {dealData.tasks.map((task: DealTask) => {
                  const isDone = task.status === "done";
                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 border rounded-xl flex items-center justify-between gap-4 transition ${
                        isDone
                          ? "bg-neutral-950/40 border-neutral-900 opacity-60"
                          : "bg-neutral-900 border-neutral-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          disabled={isDone}
                          onClick={() => handleCompleteTask(task.id!)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition ${
                            isDone
                              ? "bg-emerald-950 border-emerald-700 text-emerald-400"
                              : "border-neutral-700 hover:border-indigo-500 text-transparent hover:text-indigo-400"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <div
                            className={`text-xs font-medium ${
                              isDone
                                ? "line-through text-neutral-500"
                                : "text-neutral-200"
                            }`}
                          >
                            {task.summary}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5 font-mono">
                            <span>담당: {task.ownerId || "미지정"}</span>
                            {task.dueAt && (
                              <span>기한: {task.dueAt.slice(0, 10)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            WAITING_ON_BADGES[task.waitingOn]?.bg || "bg-neutral-800 text-neutral-300"
                          }`}
                        >
                          {WAITING_ON_BADGES[task.waitingOn]?.label || task.waitingOn}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: EVENTS */}
        {activeTab === "events" && (
          <div className="space-y-5">
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="딜 관련 내부 감사 메모를 남기세요..."
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={noteLoading || !newNote.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
              >
                <Send className="w-3.5 h-3.5" /> 메모 기록
              </button>
            </form>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-800">
              {dealData.events.map((ev: DealEvent, i: number) => (
                <div key={ev.id || i} className="relative space-y-1">
                  <div
                    className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-neutral-950 ${
                      ev.type === "override"
                        ? "bg-amber-400"
                        : ev.type === "stage"
                        ? "bg-indigo-400"
                        : "bg-neutral-600"
                    }`}
                  />
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="font-mono text-neutral-300">{ev.actor}</span>
                    <span>·</span>
                    <span className="font-mono">{new Date(ev.at).toLocaleString()}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        ev.type === "override"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : ev.type === "stage"
                          ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {ev.type.toUpperCase()}
                    </span>
                  </div>

                  {ev.body && (
                    <div className="text-xs text-neutral-200 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
                      {ev.body}
                    </div>
                  )}

                  {ev.type === "override" && ev.reason && (
                    <div className="text-xs bg-amber-950/40 border border-amber-800/80 p-2.5 rounded-lg text-amber-200">
                      <span className="font-semibold text-amber-400 block text-[10px] mb-0.5">
                        오버라이드 승인 사유:
                      </span>
                      {ev.reason}
                    </div>
                  )}

                  {ev.from !== undefined && ev.to !== undefined && (
                    <div className="text-[11px] text-neutral-400 font-mono">
                      단계 전이: {ev.from}단계 → {ev.to}단계
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: FINANCE (ISOLATED) */}
        {activeTab === "finance" && <FinanceSection dealId={dealId} />}
      </div>

      {/* MODAL: Confirm Override Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-amber-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-neutral-100">디펜던시 미충족 경고</h3>
            </div>

            <div className="text-xs text-neutral-300 space-y-2">
              <p className="font-semibold text-amber-300">
                선결 조건이 충족되지 않은 상태에서 단계 전이를 시도했습니다:
              </p>
              <ul className="list-disc list-inside space-y-1 bg-amber-950/30 p-3 rounded-xl border border-amber-900/60 text-amber-200">
                {confirmModal.violations.map((v, i) => (
                  <li key={i}>{v.message}</li>
                ))}
              </ul>
              <p className="text-neutral-400 text-[11px]">
                진행하시려면 오버라이드 사유를 필수로 입력해야 하며, 모든 오버라이드 내역은 감사 원장에 영구 보관됩니다.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-200">
                오버라이드 진행 사유 (필수) <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="예: 공장 구두 협의 완료 및 샘플 우선 긴급 투입 승인"
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(null);
                  setOverrideReason("");
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition"
              >
                취소
              </button>
              <button
                type="button"
                disabled={stageLoading || !overrideReason.trim()}
                onClick={handleConfirmOverride}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs transition"
              >
                {stageLoading ? "처리 중..." : "오버라이드 승인 및 진행"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Item Modal */}
      {isAddItemModalOpen && (
        <AddItemModal
          dealId={dealId}
          onClose={() => setIsAddItemModalOpen(false)}
          onSuccess={async () => {
            setIsAddItemModalOpen(false);
            await reloadDeal();
          }}
        />
      )}

      {/* MODAL: Add Engagement Modal */}
      {isAddEngagementModalOpen && (
        <AddEngagementModal
          dealId={dealId}
          allSuppliers={allSuppliers}
          onClose={() => setIsAddEngagementModalOpen(false)}
          onSuccess={async () => {
            setIsAddEngagementModalOpen(false);
            await reloadDeal();
          }}
        />
      )}

      {replacementEngagement && (
        <AddEngagementModal
          dealId={dealId}
          allSuppliers={allSuppliers}
          replacementEngagement={replacementEngagement}
          onClose={() => setReplacementEngagement(null)}
          onSuccess={async () => {
            setReplacementEngagement(null);
            await reloadDeal();
          }}
        />
      )}

      {/* MODAL: Add Sample Modal */}
      {isAddSampleModalOpen && (
        <AddSampleModal
          dealId={dealId}
          items={dealData.items}
          engagements={dealData.supplierEngagements}
          onClose={() => setIsAddSampleModalOpen(false)}
          onSuccess={async () => {
            setIsAddSampleModalOpen(false);
            await reloadDeal();
          }}
        />
      )}

      {/* MODAL: Add Shipment Modal */}
      {isAddShipmentModalOpen && (
        <AddShipmentModal
          dealId={dealId}
          sampleRounds={dealData.sampleRounds}
          engagements={dealData.supplierEngagements}
          onClose={() => setIsAddShipmentModalOpen(false)}
          onSuccess={async () => {
            setIsAddShipmentModalOpen(false);
            await reloadDeal();
          }}
        />
      )}

      {/* MODAL: Add Task Modal */}
      {isAddTaskModalOpen && (
        <AddTaskModal
          dealId={dealId}
          onClose={() => setIsAddTaskModalOpen(false)}
          onSuccess={async () => {
            setIsAddTaskModalOpen(false);
            await reloadDeal();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-modals
// ----------------------------------------------------------------------------

function AddItemModal({
  dealId,
  onClose,
  onSuccess,
}: {
  dealId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [productType, setProductType] = useState("Serum");
  const [variantName, setVariantName] = useState("");
  const [volume, setVolume] = useState("30ml");
  const [quantity, setQuantity] = useState("3000");
  const [keyIngredients, setKeyIngredients] = useState("");
  const [containerType, setContainerType] = useState("Glass Dropper Bottle");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          variantName,
          volume,
          quantity: parseInt(quantity, 10),
          formulaSpec: { keyIngredients },
          packagingSpec: { containerType },
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || "제품 등록 실패");
      }
    } catch {
      alert("오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl text-xs"
      >
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h3 className="font-bold text-sm text-neutral-100">새 제품 추가</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">제품 종류 (productType) *</label>
          <input
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">옵션/식별명 (variantName)</label>
            <input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="예: 01 로즈"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">용량 (volume)</label>
            <input
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            />
          </div>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">수량 (quantity) *</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            required
          />
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">주요 성분 (keyIngredients)</label>
          <input
            value={keyIngredients}
            onChange={(e) => setKeyIngredients(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">용기 사양 (containerType)</label>
          <input
            value={containerType}
            onChange={(e) => setContainerType(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300">취소</button>
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white font-medium">추가</button>
        </div>
      </form>
    </div>
  );
}

function SupplierEngagementCard({
  dealId,
  eng,
  supp,
  onReplace,
  onReload,
}: {
  dealId: string;
  eng: SupplierEngagement;
  supp?: Supplier;
  onReplace: (eng: SupplierEngagement) => void;
  onReload: () => Promise<void>;
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(eng.notes || "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleSaveNote = async () => {
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/engagements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId: eng.id,
          notes: noteText.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "메모 저장에 실패했습니다.");
      }
      setIsEditingNote(false);
      await onReload();
    } catch (err: unknown) {
      setNoteError(err instanceof Error ? err.message : "메모 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-sm text-neutral-100">
            {supp?.companyName || eng.supplierId}
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            (ID: {eng.supplierId})
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
              eng.contactStatus === "fix"
                ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                : eng.contactStatus === "drop"
                ? "bg-neutral-800 text-neutral-400 border-neutral-700"
                : "bg-blue-950 text-blue-400 border-blue-800"
            }`}
          >
            상태: {eng.contactStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {eng.contactStatus !== "drop" && (
            <button
              onClick={() => onReplace(eng)}
              className="rounded border border-amber-800/70 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-300 transition hover:bg-amber-950/60"
            >
              제조사 교체
            </button>
          )}
          <span className="text-xs text-neutral-400">
            공장 단계:{" "}
            <strong className="text-neutral-200">
              {eng.stageFactory}단계 (
              {FACTORY_STAGES.find((s) => s.id === eng.stageFactory)?.label})
            </strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-neutral-500 text-[11px] block">역할 (Roles)</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {eng.roles.map((r: string) => (
              <span
                key={r}
                className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px]"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-neutral-500 text-[11px] block">담당자 정보</span>
          <span className="text-neutral-300 block mt-1">
            {eng.contactPersonSnapshot.name}
            {eng.contactPersonSnapshot.title ? ` (${eng.contactPersonSnapshot.title})` : ""} —{" "}
            <span className="font-mono text-neutral-400">{eng.contactPersonSnapshot.email}</span>
            {eng.contactPersonSnapshot.phone ? ` (${eng.contactPersonSnapshot.phone})` : ""}
          </span>
        </div>
      </div>

      {/* 제조사별 딜 진행 메모 영역 */}
      <div className="pt-2.5 border-t border-neutral-800/80">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            제조사 딜 진행 메모
          </span>
          {!isEditingNote && (
            <button
              type="button"
              onClick={() => {
                setNoteText(eng.notes || "");
                setIsEditingNote(true);
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
            >
              <Pencil className="w-3 h-3" />
              {eng.notes ? "메모 수정" : "메모 추가"}
            </button>
          )}
        </div>

        {!isEditingNote ? (
          eng.notes ? (
            <div className="mt-2 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800 text-neutral-200 text-xs whitespace-pre-wrap leading-relaxed">
              {eng.notes}
            </div>
          ) : (
            <div
              onClick={() => {
                setNoteText("");
                setIsEditingNote(true);
              }}
              className="mt-1.5 p-2.5 rounded-lg bg-neutral-950/40 border border-dashed border-neutral-800 text-neutral-500 text-xs cursor-pointer hover:border-neutral-700 hover:text-neutral-400 transition"
            >
              작성된 딜 진행 메모가 없습니다. 클릭하여 메모를 작성하세요.
            </div>
          )
        ) : (
          <div className="mt-2 space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="해당 제조사와 이 딜에 대해 논의된 내용, 견적/샘플 관련 주의사항, 특이사항을 기록하세요..."
              rows={3}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-700 p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed"
            />
            {noteError && (
              <p className="text-[11px] text-rose-400">{noteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingNote(false);
                  setNoteText(eng.notes || "");
                  setNoteError(null);
                }}
                disabled={savingNote}
                className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200 rounded transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                {savingNote ? "저장 중…" : "메모 저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddEngagementModal({
  dealId,
  allSuppliers,
  replacementEngagement,
  onClose,
  onSuccess,
}: {
  dealId: string;
  allSuppliers: Supplier[];
  replacementEngagement?: SupplierEngagement | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const availableSuppliers = allSuppliers.filter((supplier) => supplier.id !== replacementEngagement?.supplierId);
  const initialSupplier = availableSuppliers[0];
  const initialContact = initialSupplier?.contacts?.[0];

  const [supplierId, setSupplierId] = useState(initialSupplier?.id || "");
  const [roles, setRoles] = useState<string[]>(["formulation"]);
  const [contactIndex, setContactIndex] = useState<string>(initialContact ? "0" : "custom");
  const [contactName, setContactName] = useState(initialContact?.name || "");
  const [contactEmail, setContactEmail] = useState(initialContact?.email || "");
  const [contactTitle, setContactTitle] = useState(initialContact?.title || "");
  const [contactPhone, setContactPhone] = useState(initialContact?.phone || "");
  const [replacementReason, setReplacementReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedSupplier = allSuppliers.find((s) => s.id === supplierId);
  const supplierContacts = selectedSupplier?.contacts || [];

  const handleSupplierChange = (newSupplierId: string) => {
    setSupplierId(newSupplierId);
    const found = allSuppliers.find((s) => s.id === newSupplierId);
    const first = found?.contacts?.[0];
    if (first) {
      setContactIndex("0");
      setContactName(first.name);
      setContactEmail(first.email);
      setContactTitle(first.title || "");
      setContactPhone(first.phone || "");
    } else {
      setContactIndex("custom");
      setContactName("");
      setContactEmail("");
      setContactTitle("");
      setContactPhone("");
    }
  };

  const handleContactSelect = (val: string) => {
    setContactIndex(val);
    if (val === "custom") return;
    const idx = parseInt(val, 10);
    const c = supplierContacts[idx];
    if (c) {
      setContactName(c.name);
      setContactEmail(c.email);
      setContactTitle(c.title || "");
      setContactPhone(c.phone || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const replacement = {
        supplierId,
        roles,
        contactStatus: "ing" as const,
        stageFactory: 1,
        contactPersonSnapshot: {
          name: contactName || "담당자",
          title: contactTitle || undefined,
          email: contactEmail || "supplier@example.com",
          phone: contactPhone || undefined,
        },
        notes: notes.trim() || undefined,
      };
      const res = await fetch(
        replacementEngagement
          ? `/api/admin/deals/${dealId}/engagements/replace`
          : `/api/admin/deals/${dealId}/engagements`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replacementEngagement
          ? { oldEngagementId: replacementEngagement.id, replacement, reason: replacementReason }
          : replacement),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || (replacementEngagement ? "제조사 교체 실패" : "제조사 배정 실패"));
      }
    } catch {
      alert("오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl text-xs"
      >
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h3 className="font-bold text-sm text-neutral-100">{replacementEngagement ? "제조사 교체" : "제조사 배정 (Engagement)"}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">제조사 선택 *</label>
          <select
            value={supplierId}
            onChange={(e) => handleSupplierChange(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            required
          >
            {availableSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.companyName} ({s.capabilities.join(", ")})
              </option>
            ))}
          </select>
        </div>
        {replacementEngagement && (
          <div>
            <label className="block text-neutral-400 mb-1">교체 사유 *</label>
            <input
              value={replacementReason}
              onChange={(e) => setReplacementReason(e.target.value)}
              className="w-full bg-neutral-950 border border-amber-900 rounded-lg p-2 text-neutral-200"
              required
            />
          </div>
        )}
        <div>
          <label className="block text-neutral-400 mb-1">역할 (Roles) *</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {["formulation", "packaging", "filling", "testing", "logistics"].map((role) => (
              <label key={role} className="flex items-center gap-1 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(e) => {
                    if (e.target.checked) setRoles([...roles, role]);
                    else setRoles(roles.filter((r) => r !== role));
                  }}
                />
                <span>{role}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 담당자 선택 및 자동입력 */}
        <div className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-200">담당자 정보</span>
            {supplierContacts.length > 0 && (
              <span className="text-[11px] text-neutral-500">
                등록된 담당자 {supplierContacts.length}명
              </span>
            )}
          </div>

          {supplierContacts.length > 0 && (
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">등록된 담당자 선택</label>
              <select
                value={contactIndex}
                onChange={(e) => handleContactSelect(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-neutral-200"
              >
                {supplierContacts.map((c, idx) => (
                  <option key={idx} value={String(idx)}>
                    {c.name} {c.title ? `(${c.title})` : ""} — {c.email} {c.phone ? `/ ${c.phone}` : ""}
                  </option>
                ))}
                <option value="custom">직접 입력 / 기타</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">이름 *</label>
              <input
                value={contactName}
                onChange={(e) => {
                  setContactName(e.target.value);
                  setContactIndex("custom");
                }}
                placeholder="예: 홍길동 팀장"
                required
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">이메일 *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  setContactIndex("custom");
                }}
                placeholder="supplier@example.com"
                required
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">직책 / 부서</label>
              <input
                value={contactTitle}
                onChange={(e) => {
                  setContactTitle(e.target.value);
                  setContactIndex("custom");
                }}
                placeholder="예: 해외영업팀"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">연락처</label>
              <input
                value={contactPhone}
                onChange={(e) => {
                  setContactPhone(e.target.value);
                  setContactIndex("custom");
                }}
                placeholder="예: 010-0000-0000"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-neutral-200"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-neutral-400 mb-1">제조사 딜 진행 메모 (선택사항)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="해당 제조사와 이 딜에 대해 논의된 내용, 주의사항 등을 기록하세요..."
            rows={2}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300">취소</button>
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white font-medium">{replacementEngagement ? "교체" : "배정"}</button>
        </div>
      </form>
    </div>
  );
}

function AddSampleModal({
  dealId,
  items,
  engagements,
  onClose,
  onSuccess,
}: {
  dealId: string;
  items: DealItem[];
  engagements: SupplierEngagement[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id || "");
  const activeEngagements = engagements.filter((engagement) => engagement.contactStatus !== "drop");
  const [engagementId, setEngagementId] = useState(activeEngagements[0]?.id || "");
  const [roundNo, setRoundNo] = useState("1");
  const [producedQty, setProducedQty] = useState("5");
  const [retainedQty, setRetainedQty] = useState("2");
  const requestNotes = "";
  const [qcStatus, setQcStatus] = useState<"pending" | "passed" | "failed" | "waived">("pending");
  const [qcWaiverReason, setQcWaiverReason] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          engagementId,
          supplierId: activeEngagements.find((engagement) => engagement.id === engagementId)?.supplierId,
          roundNo: parseInt(roundNo, 10),
          producedQty: parseInt(producedQty, 10),
          retainedQty: parseInt(retainedQty, 10),
          requestNotes,
          qcStatus,
          qcWaiverReason: qcStatus === "waived" ? qcWaiverReason : undefined,
          receivedAt: receivedAt || undefined,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || "샘플 회차 등록 실패");
      }
    } catch {
      alert("오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl text-xs"
      >
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h3 className="font-bold text-sm text-neutral-100">샘플 회차 등록</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">대상 제품 *</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
              required
            >
              {items.map((it: DealItem) => (
                <option key={it.id} value={it.id}>
                  {it.productType} ({it.variantName || "기본"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">제조사 *</label>
            <select
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
              required
            >
              {activeEngagements.map((eng: SupplierEngagement) => (
                <option key={eng.id} value={eng.id}>
                  {eng.supplierId} (관계 {eng.id})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">회차 (roundNo) *</label>
            <input
              type="number"
              value={roundNo}
              onChange={(e) => setRoundNo(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">생산수량</label>
            <input
              type="number"
              value={producedQty}
              onChange={(e) => setProducedQty(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">보관수량</label>
            <input
              type="number"
              value={retainedQty}
              onChange={(e) => setRetainedQty(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">QC 상태</label>
            <select
              value={qcStatus}
              onChange={(e) => setQcStatus(e.target.value as "pending" | "passed" | "failed" | "waived")}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            >
              <option value="pending">pending (대기)</option>
              <option value="passed">passed (통과)</option>
              <option value="failed">failed (불합격)</option>
              <option value="waived">waived (직송 면제)</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">HQ 입고일</label>
            <input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            />
          </div>
        </div>
        {qcStatus === "waived" && (
          <div>
            <label className="block text-neutral-400 mb-1">직송 면제 사유 (필수) *</label>
            <input
              value={qcWaiverReason}
              onChange={(e) => setQcWaiverReason(e.target.value)}
              placeholder="예: 바이어 긴급 요청 및 공장 자체 성적서 확인"
              className="w-full bg-neutral-950 border border-purple-900 rounded-lg p-2 text-neutral-200"
              required
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300">취소</button>
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white font-medium">등록</button>
        </div>
      </form>
    </div>
  );
}

function AddShipmentModal({
  dealId,
  sampleRounds,
  engagements,
  onClose,
  onSuccess,
}: {
  dealId: string;
  sampleRounds: SampleRound[];
  engagements: SupplierEngagement[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kind, setKind] = useState<"sample" | "main">("sample");
  const [route, setRoute] = useState<"supplier_to_hq" | "hq_to_buyer" | "supplier_to_buyer">("hq_to_buyer");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("DHL Express");
  const [sampleRoundId, setSampleRoundId] = useState(sampleRounds[0]?.id || "");
  const activeEngagements = engagements.filter((engagement) => engagement.contactStatus !== "drop");
  const [engagementId, setEngagementId] = useState(activeEngagements[0]?.id || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedRound = sampleRounds.find((round) => round.id === sampleRoundId);
      const isSupplierOrigin = route !== "hq_to_buyer";
      const res = await fetch(`/api/admin/deals/${dealId}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          route,
          carrier,
          trackingNumber: trackingNumber.trim() || undefined,
          sampleRoundId: kind === "sample" ? sampleRoundId || undefined : undefined,
          engagementId: isSupplierOrigin
            ? kind === "sample"
              ? selectedRound?.engagementId
              : engagementId || undefined
            : undefined,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || "배송 등록 실패");
      }
    } catch {
      alert("오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl text-xs"
      >
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h3 className="font-bold text-sm text-neutral-100">배송 구간 등록 (Shipment)</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">구분 (Kind) *</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "sample" | "main")}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            >
              <option value="sample">sample (샘플)</option>
              <option value="main">main (본품)</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">운송 경로 (Route) *</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value as "supplier_to_hq" | "hq_to_buyer" | "supplier_to_buyer")}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono text-[11px]"
            >
              <option value="hq_to_buyer">hq_to_buyer (HQ → 바이어)</option>
              <option value="supplier_to_hq">supplier_to_hq (공장 → HQ)</option>
              <option value="supplier_to_buyer">supplier_to_buyer (공장 직송)</option>
            </select>
          </div>
        </div>
        {kind === "sample" && (
          <div>
            <label className="block text-neutral-400 mb-1">연결 샘플 회차 *</label>
            <select
              value={sampleRoundId}
              onChange={(e) => setSampleRoundId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            >
              {sampleRounds.map((r: SampleRound) => (
                <option key={r.id} value={r.id}>
                  {r.roundNo}차 샘플 (ID: {r.id})
                </option>
              ))}
            </select>
          </div>
        )}
        {route !== "hq_to_buyer" && kind === "main" && (
          <div>
            <label className="block text-neutral-400 mb-1">제조사 관계 *</label>
            <select
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
              required
            >
              {activeEngagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {engagement.supplierId} (관계 {engagement.id})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">운송사 (Carrier)</label>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">운송장 번호 (Tracking) *</label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="예: 1234567890"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300">취소</button>
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white font-medium">등록</button>
        </div>
      </form>
    </div>
  );
}

function AddTaskModal({
  dealId,
  onClose,
  onSuccess,
}: {
  dealId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [waitingOn, setWaitingOn] = useState<"us" | "buyer" | "supplier" | "carrier">("us");
  const [ownerId, setOwnerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          summary,
          waitingOn,
          ownerId: ownerId.trim() || undefined,
          dueAt: dueAt || undefined,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || "태스크 등록 실패");
      }
    } catch {
      alert("오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl text-xs"
      >
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h3 className="font-bold text-sm text-neutral-100">새 태스크 추가</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">작업 내용 (Summary) *</label>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="예: 2차 처방 변경 성분표 바이어 확인 요청"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 mb-1">대기 주체 (waitingOn) *</label>
            <select
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value as "us" | "buyer" | "supplier" | "carrier")}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            >
              <option value="us">us (본사)</option>
              <option value="buyer">buyer (바이어)</option>
              <option value="supplier">supplier (제조사)</option>
              <option value="carrier">carrier (운송사)</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">담당자 (ownerId)</label>
            <input
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="예: thomas"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
            />
          </div>
        </div>
        <div>
          <label className="block text-neutral-400 mb-1">완료 목표일 (dueAt)</label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <button type="button" onClick={onClose} className="px-3 py-1.5 bg-neutral-800 rounded-lg text-neutral-300">취소</button>
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white font-medium">추가</button>
        </div>
      </form>
    </div>
  );
}
