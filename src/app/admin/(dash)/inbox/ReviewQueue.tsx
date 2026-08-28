"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  HelpCircle,
  Inbox,
  Keyboard,
  Mail,
  MessageSquare,
  Radio,
  Search,
  ShieldAlert,
  Tag,
  UserCheck,
} from "lucide-react";
import type { ReviewIdentityItem, ReviewIdentityDetail } from "@/lib/repo/conversations";
import type { Buyer } from "@/lib/schemas/buyer";
import type { Supplier } from "@/lib/schemas/supplier";
import type { ConversationRollup } from "@/lib/schemas/conversation";

interface ReviewQueueProps {
  queue: "unclassified" | "supplier" | "advertising";
  items: ReviewIdentityItem[];
  selectedDetail: ReviewIdentityDetail | null;
  selectedIdentityId?: string;
  buyers: Buyer[];
  suppliers: Supplier[];
  conversations: ConversationRollup[];
}

export default function ReviewQueue({
  queue,
  items,
  selectedDetail,
  selectedIdentityId,
  buyers,
  suppliers,
  conversations,
}: ReviewQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Classification Dialog / Inline Controls
  const [modalMode, setModalMode] = useState<"buyer" | "supplier" | "advertising" | "internal" | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState(buyers[0]?.id || "");
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || "");
  const [targetConversationId, setTargetConversationId] = useState(conversations[0]?.id || "");
  const [reason, setReason] = useState("");

  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      item.identity.value.toLowerCase().includes(term) ||
      item.latestMessageSnippet?.toLowerCase().includes(term) ||
      item.channels.join(" ").toLowerCase().includes(term)
    );
  });

  const activeIdentity = items.find((it) => it.identity.id === selectedIdentityId) || items[0];

  // Keyboard shortcut listener: 1 = Buyer, 2 = Supplier, 3 = Advertising, 4 = Internal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT" ||
        classifying ||
        !activeIdentity
      ) {
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        setModalMode("buyer");
        setReason("바이어 문의 확인");
      } else if (e.key === "2") {
        e.preventDefault();
        setModalMode("supplier");
        setReason("제조사 연락 확인");
      } else if (e.key === "3") {
        e.preventDefault();
        setModalMode("advertising");
        setReason("스팸 및 광고 분류");
      } else if (e.key === "4") {
        e.preventDefault();
        setModalMode("internal");
        setReason("내부 직원 소통 분류");
      } else if (e.key === "Escape") {
        setModalMode(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [classifying, activeIdentity]);

  async function handleClassifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeIdentity || !modalMode || !reason.trim() || classifying) return;

    setClassifying(true);
    setActionError(null);
    setActionSuccess(null);

    let payload: Record<string, unknown>;
    if (modalMode === "buyer") {
      payload = {
        classification: "buyer",
        buyerId: selectedBuyerId,
        conversationId: targetConversationId,
        reason: reason.trim(),
      };
    } else if (modalMode === "supplier") {
      payload = {
        classification: "supplier",
        supplierId: selectedSupplierId,
        conversationId: targetConversationId,
        reason: reason.trim(),
      };
    } else {
      payload = {
        classification: modalMode,
        reason: reason.trim(),
      };
    }

    try {
      const res = await fetch(
        `/api/admin/conversation-identities/${encodeURIComponent(activeIdentity.identity.id)}/classify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setActionError(err?.error || "분류 처리 중 오류가 발생했습니다.");
        return;
      }

      setActionSuccess("분류가 완료되었습니다.");
      setModalMode(null);
      setReason("");
      router.refresh();
    } catch {
      setActionError("네트워크 요청 실패");
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-12 overflow-hidden bg-neutral-950">
      {/* Column 1: Review Items List (Left) */}
      <div className="md:col-span-4 lg:col-span-4 flex h-full flex-col border-r border-neutral-800 bg-neutral-950">
        <div className="border-b border-neutral-800 p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="식별자, 내용 검색…"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-3 text-xs text-neutral-200 placeholder:text-neutral-500 outline-none focus-visible:border-indigo-500"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>대기 건수: <strong className="text-neutral-200">{filteredItems.length}</strong>건</span>
            <span className="text-[10px] text-neutral-500 flex items-center gap-1">
              <Keyboard className="h-3 w-3" /> [1~4] 키보드 단축키
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60" role="list">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-neutral-600" />
              검토 대기 항목이 없습니다
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.identity.id === (selectedIdentityId || activeIdentity?.identity.id);
              const params = new URLSearchParams(searchParams.toString());
              params.set("queue", queue);
              params.set("identityId", item.identity.id);

              return (
                <Link
                  key={item.identity.id}
                  href={`/admin/inbox?${params.toString()}`}
                  role="listitem"
                  aria-current={isSelected ? "true" : undefined}
                  className={`block p-3.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isSelected
                      ? "bg-neutral-900 border-l-2 border-indigo-500 pl-3 text-neutral-100"
                      : "hover:bg-neutral-900/60 text-neutral-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-neutral-100 truncate">
                      {item.identity.value}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase">
                      {item.identity.kind}
                    </span>
                  </div>

                  {item.latestMessageSnippet && (
                    <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed mb-2">
                      {item.latestMessageSnippet}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5">
                      스레드 {item.threadCount}개
                    </span>
                    <span>{item.channels.join(", ")}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Column 2: Selected Item Timeline and Classification Actions (Right) */}
      <div className="md:col-span-8 lg:col-span-8 flex h-full flex-col overflow-hidden bg-neutral-950">
        {activeIdentity ? (
          <>
            {/* Header & Quick Action Buttons */}
            <div className="border-b border-neutral-800 p-4 bg-neutral-900/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-100 font-mono">
                    {activeIdentity.identity.value}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    분류: <span className="font-semibold text-neutral-200">{activeIdentity.identity.classification}</span> · {activeIdentity.channels.join(", ")}
                  </p>
                </div>

                {/* Keyboard Shortcut Classification Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("buyer");
                      setReason("바이어 문의 확인");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-800 bg-sky-950/80 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900 min-h-[36px]"
                  >
                    <span className="rounded bg-sky-900 px-1 font-mono text-[10px]">1</span>
                    바이어 연결
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("supplier");
                      setReason("제조사 연락 확인");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800 bg-emerald-950/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 min-h-[36px]"
                  >
                    <span className="rounded bg-emerald-900 px-1 font-mono text-[10px]">2</span>
                    제조사 연결
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("advertising");
                      setReason("광고/스팸 처리");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 min-h-[36px]"
                  >
                    <span className="rounded bg-neutral-700 px-1 font-mono text-[10px]">3</span>
                    광고 분류
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("internal");
                      setReason("내부 직원 소통");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-800 bg-purple-950/80 px-2.5 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-900 min-h-[36px]"
                  >
                    <span className="rounded bg-purple-900 px-1 font-mono text-[10px]">4</span>
                    내부 메일
                  </button>
                </div>
              </div>

              {/* Status feedback */}
              {actionError && (
                <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/80 p-2.5 text-xs text-rose-300">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/80 p-2.5 text-xs text-emerald-300">
                  {actionSuccess}
                </div>
              )}
            </div>

            {/* Modal / Action Form Overlay */}
            {modalMode && (
              <div className="border-b border-neutral-700 bg-neutral-900 p-4 shadow-lg">
                <form onSubmit={handleClassifySubmit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-indigo-400" />
                      {modalMode === "buyer" && "바이어 엔티티 및 대화 연결"}
                      {modalMode === "supplier" && "제조사 엔티티 및 대화 연결"}
                      {modalMode === "advertising" && "광고/스팸으로 분류"}
                      {modalMode === "internal" && "내부 직원 메일로 분류"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      className="text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      취소 (Esc)
                    </button>
                  </div>

                  {modalMode === "buyer" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-300">연결할 바이어 선택</label>
                        <select
                          value={selectedBuyerId}
                          onChange={(e) => setSelectedBuyerId(e.target.value)}
                          required
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-200"
                        >
                          {buyers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.emails?.join(", ") || b.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-300">대상 대화 선택</label>
                        <select
                          value={targetConversationId}
                          onChange={(e) => setTargetConversationId(e.target.value)}
                          required
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-200"
                        >
                          {conversations.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.counterpartyLabel || c.id} ({c.lastSubject || "대화"})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {modalMode === "supplier" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-300">연결할 제조사 선택</label>
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          required
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-200"
                        >
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.companyName} ({s.contactEmails?.join(", ") || s.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-300">대상 대화 선택</label>
                        <select
                          value={targetConversationId}
                          onChange={(e) => setTargetConversationId(e.target.value)}
                          required
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-200"
                        >
                          {conversations.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.counterpartyLabel || c.id} ({c.lastSubject || "대화"})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-300">분류 사유 (감사 기록용)</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      placeholder="분류 판단 사유를 입력하세요…"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-200 outline-none focus-visible:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={classifying || !reason.trim()}
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 min-h-[36px]"
                    >
                      {classifying ? "처리 중…" : "분류 확정"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Timeline preview for review */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedDetail && selectedDetail.messages.length > 0 ? (
                selectedDetail.messages.map((m, idx) => (
                  <div key={m.id || idx} className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
                      <span className="font-semibold text-neutral-200">
                        {m.fromName ? `${m.fromName} (${m.from})` : m.from}
                      </span>
                      <span>{new Date(m.sentAt).toLocaleString("ko-KR")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <h5 className="text-xs font-semibold text-neutral-100">{m.subject || "(제목 없음)"}</h5>
                      <Link
                        href={`/admin/inbox/${encodeURIComponent(m.threadKey)}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium shrink-0"
                      >
                        원문 본문 확인 &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-neutral-500">
                  수신된 원문 메시지를 불러오는 중이거나 없습니다.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-xs text-neutral-500">
            검토할 항목을 선택해주세요.
          </div>
        )}
      </div>
    </div>
  );
}
