"use client";

import React, { useState } from "react";
import { Eye } from "lucide-react";
import IntakeActions from "./IntakeActions";
import IntakeDetailModal, { type IntakeRowDetail } from "./IntakeDetailModal";

type EffectiveStatus = "raw" | "qualified" | "rejected" | "test";

const STATUS_LABEL: Record<EffectiveStatus | "all", string> = {
  all: "전체",
  raw: "미판정 (raw)",
  qualified: "정상 리드 (qualified)",
  rejected: "거절 (rejected)",
  test: "내부 테스트 (test)",
};

const STATUS_BADGE: Record<EffectiveStatus, string> = {
  raw: "border-neutral-700 text-neutral-400 bg-neutral-800/40",
  qualified: "border-emerald-800 text-emerald-400 bg-emerald-950/30",
  rejected: "border-red-800 text-red-400 bg-red-950/30",
  test: "border-amber-800 text-amber-400 bg-amber-950/30",
};

const SOURCE_LABEL: Record<string, string> = {
  order: "주문/ODM",
  sampleRequest: "샘플요청",
  contact: "문의(Contact)",
  koreaLead: "콜드메일",
  landingRequest: "랜딩견적",
  message: "메시지",
};

export default function IntakeTableClient({
  rows,
  initialFilter = "raw",
}: {
  rows: IntakeRowDetail[];
  initialFilter?: EffectiveStatus | "all";
}) {
  const [filter, setFilter] = useState<EffectiveStatus | "all">(initialFilter);
  const [selectedIntake, setSelectedIntake] = useState<IntakeRowDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const effectiveStatus = (intake: IntakeRowDetail): EffectiveStatus => {
    if (!intake.review) return "raw";
    if (intake.review.isTest) return "test";
    return intake.review.status === "qualified"
      ? "qualified"
      : intake.review.status === "rejected"
      ? "rejected"
      : "raw";
  };

  const filteredRows = rows.filter((r) => {
    const status = effectiveStatus(r);
    if (filter !== "all" && status !== filter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchEmail = r.email?.toLowerCase().includes(term);
      const matchName = r.contactName?.toLowerCase().includes(term);
      const matchCompany = r.companyName?.toLowerCase().includes(term);
      const matchLabel = r.buyerLabel?.toLowerCase().includes(term);
      const matchSummary = r.summaryText?.toLowerCase().includes(term);
      const matchId = r.externalId?.toLowerCase().includes(term);
      if (!matchEmail && !matchName && !matchCompany && !matchLabel && !matchSummary && !matchId) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(["raw", "qualified", "rejected", "test", "all"] as const).map((s) => {
            const count = s === "all" ? rows.length : rows.filter((r) => effectiveStatus(r) === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  filter === s
                    ? "border-indigo-600 bg-indigo-950 text-indigo-300 font-medium"
                    : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                }`}
              >
                <span>{STATUS_LABEL[s]}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="바이어명, 이메일, 내용 검색..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center bg-neutral-950/40 rounded-xl border border-neutral-800/80">
          <p className="text-sm text-neutral-500">해당 조건의 인테이크가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800/80 bg-neutral-950/40">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] text-neutral-400 bg-neutral-900/80 border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3 font-medium">원천</th>
                <th className="py-2.5 px-3 font-medium">생성 시각</th>
                <th className="py-2.5 px-3 font-medium">바이어 / 문의자</th>
                <th className="py-2.5 px-3 font-medium">요청 요약</th>
                <th className="py-2.5 px-3 font-medium">판정</th>
                <th className="py-2.5 px-3 font-medium">사유</th>
                <th className="py-2.5 px-3 text-right font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredRows.map((row) => {
                const status = effectiveStatus(row);
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-neutral-900/60 transition group"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-neutral-900 text-neutral-300 border border-neutral-800 px-2 py-0.5 rounded text-[10px] font-mono">
                        {SOURCE_LABEL[row.source] || row.source}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-neutral-100">
                        {row.companyName || row.contactName || row.buyerLabel}
                      </div>
                      {row.email && (
                        <div className="text-[10px] text-neutral-500 font-mono">{row.email}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-neutral-300">
                      {row.summaryText || (row.sampleProductName ? `샘플: ${row.sampleProductName}` : row.message || "—")}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[status]}`}>
                        {status === "raw" ? "미판정" : status === "qualified" ? "승인" : status === "rejected" ? "거절" : "테스트"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 max-w-[140px] truncate">
                      {row.review?.reason || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedIntake(row)}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/40 text-indigo-300 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>상세보기</span>
                        </button>

                        <IntakeActions
                          source={row.source}
                          externalId={row.externalId}
                          sourceRef={row.sourceRef}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedIntake && (
        <IntakeDetailModal
          intake={selectedIntake}
          onClose={() => setSelectedIntake(null)}
        />
      )}
    </div>
  );
}
