"use client";

import React, { useState, useEffect, useRef } from "react";
import { CrmDeal, CRM_STAGES, CrmStage } from "@/lib/crm-types";
import { MOCK_DEALS } from "@/lib/mock-crm-data";
import Crm3WayDealModal from "./Crm3WayDealModal";
import CrmCreateDealModal from "./CrmCreateDealModal";
import CountUpNumber from "./CountUpNumber";
import { Plus, Search, Filter } from "lucide-react";
import gsap from "gsap";

export default function CrmKanbanBoard() {
  const [deals, setDeals] = useState<CrmDeal[]>(MOCK_DEALS);
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boardRef.current) {
      gsap.fromTo(
        boardRef.current.querySelectorAll(".kanban-card"),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" }
      );
    }
  }, [filterPriority, searchQuery]);

  const handleUpdateStage = (dealId: string, newStage: CrmStage) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    );
  };

  const handleCreateDeal = (newDeal: CrmDeal) => {
    setDeals((prev) => [newDeal, ...prev]);
  };

  const filteredDeals = deals.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.supplierName && d.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesPriority = filterPriority === "all" || d.priority === filterPriority;

    return matchesSearch && matchesPriority;
  });

  const totalRevenue = filteredDeals.reduce((acc, d) => acc + d.buyerTotalValue, 0);
  const totalMargin = filteredDeals.reduce((acc, d) => acc + d.grossProfitUsd, 0);

  return (
    <div className="space-y-6">
      
      {/* KPI Overview Summary Bar with GSAP CountUp */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 w-full">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium">총 활성 딜</span>
            <div className="text-xl font-bold text-neutral-100 mt-0.5 font-mono">
              <CountUpNumber value={filteredDeals.length} suffix="건" />
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">8월 KPI 진행 중</span>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium">파이프라인 총 판가</span>
            <div className="text-xl font-bold text-blue-400 mt-0.5 font-mono">
              <CountUpNumber value={totalRevenue} prefix="$" suffix=" USD" />
            </div>
            <span className="text-[10px] text-neutral-500">Revenue 합계</span>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium">예상 총 마진</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5 font-mono">
              <CountUpNumber value={totalMargin} prefix="$" suffix=" USD" />
            </div>
            <span className="text-[10px] text-emerald-500 font-medium">평균 마진율 58.1%</span>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium">행동 필요 이메일</span>
            <div className="text-xl font-bold text-amber-400 mt-0.5 font-mono">
              <CountUpNumber value={2} suffix="건" />
            </div>
            <span className="text-[10px] text-red-400 font-medium">Division 20 4일 무응답</span>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          신규 딜 등록 (Add Deal)
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="딜 제목, 바이어명, 공장명으로 검색..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          >
            <option value="all">전체 우선순위</option>
            <option value="hot">🔥 HOT 만 보기</option>
            <option value="warm">⚡ WARM 만 보기</option>
            <option value="cold">❄️ COLD 만 보기</option>
          </select>
        </div>
      </div>

      {/* Kanban Board Container (Horizontal Scroll) */}
      <div ref={boardRef} className="overflow-x-auto pb-4 pt-1">
        <div className="flex gap-3 min-w-[1400px]">
          {CRM_STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.stage === stage.id);

            return (
              <div
                key={stage.id}
                className="w-72 bg-neutral-950/80 border border-neutral-800/80 rounded-xl flex flex-col min-h-[500px]"
              >
                {/* Stage Header */}
                <div className="p-3 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/60 rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                    <span className="font-semibold text-xs text-neutral-200">{stage.label}</span>
                    <span className="text-[11px] text-neutral-500 font-mono">({stageDeals.length})</span>
                  </div>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">
                    {stage.pct}%
                  </span>
                </div>

                {/* Cards Column Body */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      className="kanban-card bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-lg p-3 cursor-pointer transition-all group shadow-xs space-y-2.5"
                    >
                      {/* Top Tag & Priority */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 font-medium bg-neutral-800 px-2 py-0.5 rounded">
                          {deal.buyerCountry}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            deal.priority === "hot"
                              ? "bg-red-950 text-red-400 border border-red-800/40"
                              : "bg-amber-950 text-amber-400 border border-amber-800/40"
                          }`}
                        >
                          {deal.priority.toUpperCase()}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-semibold text-xs text-neutral-100 group-hover:text-indigo-300 transition-colors leading-tight">
                        {deal.title}
                      </h4>

                      {/* Revenue & Supplier */}
                      <div className="text-[11px] space-y-1 text-neutral-400 bg-neutral-950/60 p-2 rounded border border-neutral-800/50">
                        <div className="flex justify-between">
                          <span>판가 (Revenue):</span>
                          <span className="font-mono text-neutral-200 font-medium">
                            ${deal.buyerTotalValue ? deal.buyerTotalValue.toLocaleString() : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>공장 (Supplier):</span>
                          <span className="text-neutral-300">{deal.supplierName || "미정"}</span>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-800/60">
                        <span>PM: {deal.pmName.split(" ")[0]}</span>
                        <span className="font-mono">{deal.updatedAt.slice(5, 10)}</span>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="h-24 border border-dashed border-neutral-800/80 rounded-lg flex items-center justify-center text-xs text-neutral-600">
                      딜 없음
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3-Way Deal Modal */}
      {selectedDeal && (
        <Crm3WayDealModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdateStage={handleUpdateStage}
        />
      )}

      {/* Create Deal Modal */}
      {isCreateModalOpen && (
        <CrmCreateDealModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateDeal}
        />
      )}
    </div>
  );
}
