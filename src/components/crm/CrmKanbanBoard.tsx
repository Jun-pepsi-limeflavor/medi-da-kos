"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  BRAND_STAGES,
  FACTORY_STAGES,
  effectiveFactoryStage,
  findViolations,
} from "@/lib/stages";
import type {
  DealDetails,
  DealItem,
  SampleRound,
  DealTask,
} from "@/lib/schemas/deal";
import {
  Search,
  AlertTriangle,
  Clock,
  User,
  Package,
  Layers,
  CheckCircle2,
  ChevronRight,
  Filter,
} from "lucide-react";

interface Props {
  deals: DealDetails[];
}

const WAITING_ON_LABELS: Record<string, { label: string; color: string }> = {
  us: { label: "본사 (HQ)", color: "bg-blue-950 text-blue-300 border-blue-800" },
  buyer: { label: "바이어 대기", color: "bg-amber-950 text-amber-300 border-amber-800" },
  supplier: { label: "제조사 대기", color: "bg-purple-950 text-purple-300 border-purple-800" },
  carrier: { label: "운송사 대기", color: "bg-cyan-950 text-cyan-300 border-cyan-800" },
};

export default function CrmKanbanBoard({ deals }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterViolationOnly, setFilterViolationOnly] = useState(false);
  const [filterSampleAlertOnly, setFilterSampleAlertOnly] = useState(false);

  // Filtered deals
  const filteredDeals = useMemo(() => {
    return deals.filter((item) => {
      const { deal, supplierEngagements, sampleRounds, items } = item;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = deal.reference.toLowerCase().includes(q);
        const matchCompany = deal.buyerInfo.companyName.toLowerCase().includes(q);
        const matchCountry = (deal.buyerInfo.country || "").toLowerCase().includes(q);
        const matchItems = items.some(
          (it: DealItem) =>
            it.productType.toLowerCase().includes(q) ||
            it.variantName.toLowerCase().includes(q)
        );
        if (!matchRef && !matchCompany && !matchCountry && !matchItems) {
          return false;
        }
      }

      if (filterViolationOnly) {
        const violations = findViolations({
          stageBrand: deal.stageBrand,
          engagements: supplierEngagements,
        });
        if (violations.length === 0) return false;
      }

      if (filterSampleAlertOnly) {
        const hasHighRound = sampleRounds.some((r: SampleRound) => r.roundNo >= 4);
        if (!hasHighRound) return false;
      }

      return true;
    });
  }, [deals, searchQuery, filterViolationOnly, filterSampleAlertOnly]);

  // KPI Calculations
  const totalDealsCount = deals.length;
  const violationDealsCount = useMemo(() => {
    return deals.filter(
      (d: DealDetails) =>
        findViolations({
          stageBrand: d.deal.stageBrand,
          engagements: d.supplierEngagements,
        }).length > 0
    ).length;
  }, [deals]);

  const highSampleRoundCount = useMemo(() => {
    return deals.filter((d: DealDetails) => d.sampleRounds.some((r: SampleRound) => r.roundNo >= 4)).length;
  }, [deals]);

  const openTasksTotal = useMemo(() => {
    return deals.reduce(
      (sum: number, d: DealDetails) => sum + d.tasks.filter((t: DealTask) => t.status === "open").length,
      0
    );
  }, [deals]);

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-neutral-400 font-medium">총 진행 중 딜</span>
          <div className="text-2xl font-bold text-neutral-100 mt-1 font-mono">
            {totalDealsCount}
            <span className="text-xs text-neutral-500 font-normal ml-1">건</span>
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">8단계 브랜드 파이프라인</span>
        </div>

        <div
          onClick={() => setFilterViolationOnly(!filterViolationOnly)}
          className={`border rounded-xl p-4 shadow-sm cursor-pointer transition-colors ${
            filterViolationOnly
              ? "bg-rose-950/40 border-rose-600 ring-1 ring-rose-500"
              : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">디펜던시 위반</span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                violationDealsCount > 0 ? "text-rose-400" : "text-neutral-500"
              }`}
            />
          </div>
          <div
            className={`text-2xl font-bold mt-1 font-mono ${
              violationDealsCount > 0 ? "text-rose-400" : "text-neutral-300"
            }`}
          >
            {violationDealsCount}
            <span className="text-xs text-neutral-500 font-normal ml-1">건</span>
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            {filterViolationOnly ? "필터 해제하려면 클릭" : "클릭하여 위반 딜만 보기"}
          </span>
        </div>

        <div
          onClick={() => setFilterSampleAlertOnly(!filterSampleAlertOnly)}
          className={`border rounded-xl p-4 shadow-sm cursor-pointer transition-colors ${
            filterSampleAlertOnly
              ? "bg-amber-950/40 border-amber-600 ring-1 ring-amber-500"
              : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">샘플 4차 이상</span>
            <Layers
              className={`w-3.5 h-3.5 ${
                highSampleRoundCount > 0 ? "text-amber-400" : "text-neutral-500"
              }`}
            />
          </div>
          <div
            className={`text-2xl font-bold mt-1 font-mono ${
              highSampleRoundCount > 0 ? "text-amber-400" : "text-neutral-300"
            }`}
          >
            {highSampleRoundCount}
            <span className="text-xs text-neutral-500 font-normal ml-1">건</span>
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            {filterSampleAlertOnly ? "필터 해제하려면 클릭" : "클릭하여 장기 샘플 딜만 보기"}
          </span>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">남은 열린 작업</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1 font-mono">
            {openTasksTotal}
            <span className="text-xs text-neutral-500 font-normal ml-1">건</span>
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">운영 태스크 대응 요망</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="딜 레퍼런스, 바이어 회사명, 국가, 제품명으로 검색..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <button
            onClick={() => {
              setFilterViolationOnly(false);
              setFilterSampleAlertOnly(false);
              setSearchQuery("");
            }}
            className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 8-Column Brand Stage Kanban Board */}
      <div className="overflow-x-auto pb-4 pt-1">
        <div className="flex gap-3 min-w-[1600px]">
          {BRAND_STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter(
              (d) => d.deal.stageBrand === stage.id
            );

            return (
              <div
                key={stage.id}
                className="w-72 bg-neutral-950/70 border border-neutral-800/80 rounded-xl flex flex-col min-h-[600px]"
              >
                {/* Stage Header */}
                <div className="p-3 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/60 rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <div>
                      <span className="font-semibold text-xs text-neutral-200 block leading-tight">
                        {stage.id}. {stage.label}
                      </span>
                      <span className="text-[10px] text-neutral-500 block">
                        {stage.description}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-mono font-medium">
                    {stageDeals.length}
                  </span>
                </div>

                {/* Column Body Cards */}
                <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
                  {stageDeals.map((item) => {
                    const { deal, items, supplierEngagements, sampleRounds, tasks } =
                      item;

                    // 1. 공장 단계
                    const effStage = effectiveFactoryStage(supplierEngagements);
                    const factoryStageInfo = effStage
                      ? FACTORY_STAGES.find((s) => s.id === effStage)
                      : null;

                    // 2. 디펜던시 위반 여부 (그릴 때 계산)
                    const violations = findViolations({
                      stageBrand: deal.stageBrand,
                      engagements: supplierEngagements,
                    });
                    const hasViolation = violations.length > 0;

                    // 3. 샘플 회차
                    const latestRound =
                      sampleRounds.length > 0
                        ? sampleRounds.reduce((max: SampleRound, r: SampleRound) =>
                            r.roundNo > max.roundNo ? r : max
                          )
                        : null;

                    // 4. 다음 열린 작업 (status === 'open' 중 dueAt 최우선)
                    const openTasks = tasks.filter((t: DealTask) => t.status === "open");
                    openTasks.sort((a: DealTask, b: DealTask) => {
                      if (a.dueAt && b.dueAt) {
                        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
                      }
                      if (a.dueAt) return -1;
                      if (b.dueAt) return 1;
                      return 0;
                    });
                    const nextTask = openTasks[0];

                    // 5. 제품 요약
                    const totalQty = items.reduce((sum: number, it: DealItem) => sum + it.quantity, 0);

                    return (
                      <Link
                        key={deal.id}
                        href={`/admin/deals/${deal.id}`}
                        className="block bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-xl p-3.5 transition-all group shadow-sm space-y-3"
                      >
                        {/* Top: Country Badge & Reference */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300 font-medium bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700/50">
                            {deal.buyerInfo.country || "미정"}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {deal.reference}
                          </span>
                        </div>

                        {/* Buyer & Brand Title */}
                        <div>
                          <div className="text-xs font-semibold text-neutral-100 group-hover:text-indigo-300 transition-colors leading-snug">
                            {deal.buyerInfo.companyName}
                          </div>
                          {deal.buyerInfo.contactName && (
                            <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3 text-neutral-500" />
                              {deal.buyerInfo.contactName}
                            </div>
                          )}
                        </div>

                        {/* Product Summary */}
                        <div className="text-[11px] bg-neutral-950/70 p-2 rounded-lg border border-neutral-800/60 space-y-1">
                          <div className="flex items-center gap-1.5 text-neutral-300">
                            <Package className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate font-medium">
                              {items.length > 0
                                ? items
                                    .map(
                                      (it: DealItem) =>
                                        `${it.productType}${
                                          it.variantName ? ` (${it.variantName})` : ""
                                        }`
                                    )
                                    .join(" · ")
                                : "제품 등록 대기"}
                            </span>
                          </div>
                          {totalQty > 0 && (
                            <div className="text-[10px] text-neutral-400 pl-5 font-mono">
                              수량: {totalQty.toLocaleString()}개
                            </div>
                          )}
                        </div>

                        {/* Factory Stage (Colored if violation) */}
                        <div
                          className={`text-[11px] p-2 rounded-lg border flex items-center justify-between transition-colors ${
                            hasViolation
                              ? "bg-rose-950/40 border-rose-800/80 text-rose-300"
                              : "bg-neutral-950/40 border-neutral-800 text-neutral-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {hasViolation ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                            <span className="text-[10px] font-medium">
                              공장:{" "}
                              {factoryStageInfo
                                ? `${factoryStageInfo.id}단계 ${factoryStageInfo.label}`
                                : "미배정"}
                            </span>
                          </div>
                          {hasViolation && (
                            <span className="text-[9px] bg-rose-900/80 text-rose-200 px-1.5 py-0.5 rounded font-medium">
                              선결 미달
                            </span>
                          )}
                        </div>

                        {/* Sample Round Badge */}
                        {latestRound && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[10px] text-neutral-400">샘플 현황</span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                                latestRound.roundNo >= 4
                                  ? "bg-red-950 text-red-300 border-red-800"
                                  : "bg-neutral-800 text-neutral-300 border-neutral-700"
                              }`}
                            >
                              샘플 ({latestRound.roundNo}차) · {latestRound.qcStatus}
                            </span>
                          </div>
                        )}

                        {/* Next Open Task */}
                        {nextTask ? (
                          <div className="text-[10px] bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80 space-y-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                  WAITING_ON_LABELS[nextTask.waitingOn]?.color ||
                                  "bg-neutral-800 text-neutral-400"
                                }`}
                              >
                                {WAITING_ON_LABELS[nextTask.waitingOn]?.label ||
                                  nextTask.waitingOn}
                              </span>
                              {nextTask.dueAt && (
                                <span className="text-[9px] text-neutral-400 flex items-center gap-1 font-mono">
                                  <Clock className="w-2.5 h-2.5" />
                                  {nextTask.dueAt.slice(0, 10)}
                                </span>
                              )}
                            </div>
                            <div className="text-neutral-200 truncate font-medium">
                              {nextTask.summary}
                            </div>
                            {nextTask.ownerId && (
                              <div className="text-neutral-400 text-[9px]">
                                담당: {nextTask.ownerId}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-neutral-600 italic">
                            대기 중인 작업 없음
                          </div>
                        )}

                        {/* Footer Card link affordance */}
                        <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] text-neutral-500 group-hover:text-indigo-400 transition-colors">
                          <span>상세 관리 열기</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </Link>
                    );
                  })}

                  {stageDeals.length === 0 && (
                    <div className="h-28 border border-dashed border-neutral-800/80 rounded-xl flex items-center justify-center text-xs text-neutral-600">
                      딜 없음
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
