"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Forward,
  Inbox,
  Keyboard,
  Link2,
  Search,
  Sparkles,
  Tag,
  UserPlus,
} from "lucide-react";
import type { ReviewIdentityItem, ReviewIdentityDetail } from "@/lib/repo/conversations";
import type { Buyer } from "@/lib/schemas/buyer";
import { INFLOW_CHANNELS } from "@/lib/schemas/buyer";
import type { Supplier } from "@/lib/schemas/supplier";
import type { ConversationRollup } from "@/lib/schemas/conversation";
import {
  extractBuyerNameFromBody,
  extractBrandNameFromBody,
  extractCountryFromBody,
  extractBrandCandidates,
  type BrandCandidate,
} from "@/lib/name-extractor";
import ThreadReplyForm from "./[threadKey]/ThreadReplyForm";
import MessageBodyClean from "./MessageBodyClean";
import { getIdentityDisplay } from "@/lib/inbox-display";

const CHANNEL_NAMES: Record<string, string> = {
  gmail_thomas: "Thomas",
  gmail_hally: "Hally",
  gmail_support: "Support",
  gmail_rheekw: "Rheekw",
  gmail_songjh: "Songjh",
  gmail_kimhs: "Kimhs",
  gmail_parkjy: "Parkjy",
  outlook_support: "Support",
  channeltalk: "채널톡",
  web: "웹 문의",
};

function mapChannelToInflow(channel?: string): (typeof INFLOW_CHANNELS)[number] {
  if (!channel) return "manual";
  if (channel === "gmail_support" || channel === "outlook_support") return "support";
  if (channel.startsWith("gmail_hally")) return "gmail_hally";
  if (channel.startsWith("gmail_thomas")) return "gmail_thomas";
  if (channel.startsWith("gmail_")) return "gmail_hally";
  if (channel.startsWith("outlook")) return "outlook";
  if (channel.startsWith("channeltalk") || channel.startsWith("channel_talk")) return "channel_talk";
  if (channel === "web") return "website";
  return "manual";
}

export function isForwardedMessage(m: { subject?: string; direction?: string; to?: string[]; bodyText?: string }): boolean {
  const subj = (m.subject || "").toLowerCase().trim();
  if (subj.startsWith("fwd:") || subj.startsWith("fwd :") || subj.startsWith("전달:") || subj.startsWith("[fwd]")) {
    return true;
  }
  const internalDomains = ["@techasset.co.kr", "@medidakoslabs.com", "@medidakos.com"];
  if (m.direction === "out" && m.to && m.to.length > 0) {
    const allInternal = m.to.every((recipient) =>
      internalDomains.some((d) => recipient.toLowerCase().endsWith(d))
    );
    if (allInternal) return true;
  }
  return false;
}

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
  const [expandedForwards, setExpandedForwards] = useState<Record<string, boolean>>({});

  function toggleForward(id: string) {
    setExpandedForwards((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Classification Dialog / Inline Controls
  const [modalMode, setModalMode] = useState<"buyer" | "supplier" | "advertising" | "internal" | null>(null);
  const [buyerModeTab, setBuyerModeTab] = useState<"new" | "existing">("new");
  const [selectedBuyerId, setSelectedBuyerId] = useState(buyers[0]?.id || "");
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || "");
  const [targetConversationId, setTargetConversationId] = useState(conversations[0]?.id || "");
  const [reason, setReason] = useState("");

  // New Buyer Form States
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newInflowChannel, setNewInflowChannel] = useState<(typeof INFLOW_CHANNELS)[number]>("gmail_hally");
  const [newBrandName, setNewBrandName] = useState("");
  const [brandCandidates, setBrandCandidates] = useState<BrandCandidate[]>([]);
  const [newCountry, setNewCountry] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [autoExtractBrief, setAutoExtractBrief] = useState(true);

  // Success Confirmation Modal State
  const [successModalData, setSuccessModalData] = useState<{
    buyerName: string;
    conversationId: string;
  } | null>(null);

  // Inbound / Outbound-only (Cold Email) Filter State
  const [inboundFilter, setInboundFilter] = useState<"all" | "inbound" | "outbound_only">("all");

  const inboundCount = items.filter((item) => item.hasInbound).length;
  const outboundOnlyCount = items.filter((item) => !item.hasInbound).length;

  const filteredItems = items.filter((item) => {
    if (inboundFilter === "inbound" && !item.hasInbound) return false;
    if (inboundFilter === "outbound_only" && item.hasInbound) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    const display = getIdentityDisplay(item.identity);
    return (
      item.identity.value.toLowerCase().includes(term) ||
      display.primary.toLowerCase().includes(term) ||
      display.secondary?.toLowerCase().includes(term) ||
      item.latestMessageSnippet?.toLowerCase().includes(term) ||
      item.channels.join(" ").toLowerCase().includes(term)
    );
  });

  const activeIdentity = items.find((it) => it.identity.id === selectedIdentityId) || items[0];
  const activeDisplay = activeIdentity ? getIdentityDisplay(activeIdentity.identity) : null;
  const anchorMessage = selectedDetail?.anchorMessage || selectedDetail?.messages?.[0] || null;

  const openBuyerModal = useCallback(() => {
    setModalMode("buyer");
    setBuyerModeTab("new");
    setReason("정상 바이어 문의 확인");
    setAutoExtractBrief(true);

    const email = activeIdentity ? getIdentityDisplay(activeIdentity.identity).email || "" : "";
    const extractedName = extractBuyerNameFromBody(anchorMessage?.bodyText, anchorMessage?.fromName);
    const candidates = extractBrandCandidates({
      bodyText: anchorMessage?.bodyText,
      fromName: anchorMessage?.fromName,
      email,
      messages: selectedDetail?.messages || [],
    });
    setBrandCandidates(candidates);
    const extractedBrand = candidates[0]?.value || extractBrandNameFromBody(anchorMessage?.bodyText, email);
    const extractedCountry = extractCountryFromBody(anchorMessage?.bodyText);

    setNewName(extractedName);
    setNewEmail(email);
    setNewInflowChannel(mapChannelToInflow(activeIdentity?.channels?.[0]));
    setNewBrandName(extractedBrand);
    setNewCountry(extractedCountry);
    setNewPhone("");
  }, [activeIdentity, anchorMessage, selectedDetail]);

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
        openBuyerModal();
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
  }, [classifying, activeIdentity, openBuyerModal]);

  async function handleClassifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeIdentity || !modalMode || !reason.trim() || classifying) return;

    setClassifying(true);
    setActionError(null);
    setActionSuccess(null);

    let payload: Record<string, unknown>;
    if (modalMode === "buyer") {
      if (buyerModeTab === "new") {
        const emailVal = newEmail.trim().toLowerCase();
        payload = {
          classification: "buyer",
          buyerMode: "new",
          buyer: {
            name: newName.trim() || newBrandName.trim() || emailVal.split("@")[0] || "신규 바이어",
            emails: [emailVal],
            inflowChannel: newInflowChannel,
            brandName: newBrandName.trim(),
            country: newCountry.trim(),
            phone: newPhone.trim(),
          },
          reason: reason.trim(),
          autoExtractBrief,
        };
      } else {
        payload = {
          classification: "buyer",
          buyerMode: "existing",
          buyerId: selectedBuyerId,
          conversationId: targetConversationId || undefined,
          reason: reason.trim(),
          autoExtractBrief,
        };
      }
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

      const resData = await res.json().catch(() => null) as { ok?: boolean; error?: string; conversationId?: string; buyerId?: string } | null;

      if (!res.ok || !resData?.ok) {
        setActionError(resData?.error || "분류 처리 중 오류가 발생했습니다.");
        return;
      }

      if (modalMode === "buyer" && resData.conversationId) {
        const displayName = buyerModeTab === "new"
          ? (newName.trim() || newBrandName.trim() || getIdentityDisplay(activeIdentity.identity).primary)
          : (buyers.find((b) => b.id === selectedBuyerId)?.name || "바이어");
        setSuccessModalData({
          buyerName: displayName,
          conversationId: resData.conversationId,
        });
      } else {
        setActionSuccess("분류가 완료되었습니다.");
        setModalMode(null);
        setReason("");
        router.refresh();
      }
    } catch {
      setActionError("네트워크 요청 실패");
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-12 overflow-hidden bg-neutral-950">
      {/* Column 1: Inbound Triage List (Left - 4 Cols) */}
      <div className="lg:col-span-4 flex h-full min-h-0 flex-col border-r border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md overflow-hidden">
        <div className="shrink-0 border-b border-neutral-800/80 p-3.5 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="식별자, 이메일, 내용 검색…"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/90 py-2 pl-9 pr-3 text-xs text-neutral-200 placeholder:text-neutral-500 outline-none transition-colors focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>
          {/* 대기 건수 및 단축키 안내 */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5 text-indigo-400" />
              대기 건수: <strong className="text-neutral-100 font-semibold">{filteredItems.length}</strong>
              {items.length !== filteredItems.length && (
                <span className="text-[10px] text-neutral-500 font-normal">/ 전체 {items.length}</span>
              )}
              건
            </span>
            <span className="text-[10px] text-neutral-500 flex items-center gap-1">
              <Keyboard className="h-3 w-3 text-neutral-400" /> 단축키 <kbd className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-neutral-300">1~4</kbd>
            </span>
          </div>

          {/* 수신 이력 / 발신 전용(콜드메일) 필터 세그먼트 버튼 */}
          <div className="flex items-center gap-1 p-1 bg-neutral-900/90 rounded-xl border border-neutral-800 text-[11px] select-none">
            <button
              type="button"
              onClick={() => setInboundFilter("all")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center font-medium transition-all ${
                inboundFilter === "all"
                  ? "bg-neutral-800 text-white shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
              }`}
            >
              전체 ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setInboundFilter("inbound")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center font-medium transition-all flex items-center justify-center gap-1 ${
                inboundFilter === "inbound"
                  ? "bg-indigo-950 text-indigo-200 border border-indigo-800/80 font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
              }`}
              title="바이어의 회신/수신 이력이 있는 검토 건"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              수신 있음 ({inboundCount})
            </button>
            <button
              type="button"
              onClick={() => setInboundFilter("outbound_only")}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center font-medium transition-all flex items-center justify-center gap-1 ${
                inboundFilter === "outbound_only"
                  ? "bg-amber-950 text-amber-200 border border-amber-800/80 font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
              }`}
              title="발신만 하고 한 번도 수신한 적 없는 콜드메일 전용 목록"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              발신 전용 ({outboundOnlyCount})
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-neutral-800/40" role="list">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-neutral-500">
              <Inbox className="mb-2 h-8 w-8 text-neutral-700" />
              <p className="font-medium text-neutral-400">조건에 맞는 검토 항목이 없습니다</p>
              <p className="mt-1 text-[11px] text-neutral-600">
                {inboundFilter === "outbound_only"
                  ? "발신만 발생한 미분류 콜드메일 건이 없습니다."
                  : inboundFilter === "inbound"
                    ? "수신 이력이 있는 미분류 건이 없습니다."
                    : "모든 인바운드 문의가 분류 완료되었습니다."}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const display = getIdentityDisplay(item.identity);
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
                  className={`group relative block p-3.5 transition-all outline-none ${
                    isSelected
                      ? "bg-neutral-900/90 text-neutral-100 shadow-inner"
                      : "hover:bg-neutral-900/50 text-neutral-300"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  )}

                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <span className="block font-mono text-xs font-semibold text-neutral-100 truncate group-hover:text-indigo-300 transition-colors">
                        {display.primary}
                      </span>
                      {display.secondary && (
                        <span className="block mt-0.5 text-[10px] text-neutral-500 truncate">{display.secondary}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.hasInbound ? (
                        <span className="rounded bg-emerald-950/90 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-0.5">
                          <ArrowDownLeft className="h-2.5 w-2.5" /> 수신됨
                        </span>
                      ) : (
                        <span className="rounded bg-amber-950/90 text-amber-400 border border-amber-800/60 px-1.5 py-0.5 text-[9px] font-medium flex items-center gap-0.5">
                          <ArrowUpRight className="h-2.5 w-2.5" /> 발신전용
                        </span>
                      )}
                      {item.channels && item.channels.length > 0 ? (
                        item.channels.map((ch) => (
                          <span
                            key={ch}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-medium border font-mono ${
                              ch === "channeltalk"
                                ? "bg-purple-950/80 text-purple-300 border-purple-800/60"
                                : ch.startsWith("gmail")
                                  ? "bg-rose-950/80 text-rose-300 border-rose-800/60"
                                  : ch.startsWith("outlook")
                                    ? "bg-sky-950/80 text-sky-300 border-sky-800/60"
                                    : "bg-neutral-800/80 text-neutral-400 border-neutral-700/50"
                            }`}
                          >
                            {CHANNEL_NAMES[ch] || ch}
                          </span>
                        ))
                      ) : (
                        <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-[9px] font-mono uppercase text-neutral-400 border border-neutral-700/50">
                          {item.identity.kind}
                        </span>
                      )}
                    </div>
                  </div>

                  {item.latestMessageSnippet && (
                    <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed mb-2">
                      {item.latestMessageSnippet}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-neutral-800/90 px-1.5 py-0.5 font-medium text-neutral-300 border border-neutral-700/40">
                        스레드 {item.threadCount}개
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Column 2: Full Conversation Stream, Action Bar & Reply (Right - 8 Cols) */}
      <div className="lg:col-span-8 flex h-full min-h-0 flex-col overflow-hidden bg-neutral-950">
        {activeIdentity ? (
          <>
            {/* Header & Quick Action Buttons */}
            <div className="shrink-0 border-b border-neutral-800/80 p-4 bg-neutral-900/60 backdrop-blur-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-100 font-mono flex items-center gap-2">
                    {activeDisplay?.primary}
                    {selectedDetail && (
                      <span className="rounded-full bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                        총 {selectedDetail.messages.length}개 메시지
                      </span>
                    )}
                  </h3>
                  {activeDisplay?.secondary && (
                    <p className="text-[10px] text-neutral-500 mt-0.5">{activeDisplay.secondary}</p>
                  )}
                  <p className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-2">
                    <span>분류: <strong className="font-semibold text-neutral-200">{activeIdentity.identity.classification}</strong></span>
                    <span>•</span>
                    <span>{activeIdentity.channels.map((ch) => CHANNEL_NAMES[ch] || ch).join(", ")}</span>
                  </p>
                </div>

                {/* Keyboard Shortcut Classification Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openBuyerModal}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600/60 bg-sky-950/80 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-900 hover:border-sky-500 transition-all shadow-[0_0_12px_rgba(14,165,233,0.15)] min-h-[36px]"
                  >
                    <span className="rounded bg-sky-900 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">1</span>
                    정상 바이어 승인
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("supplier");
                      setReason("제조사 연락 확인");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700/60 bg-emerald-950/80 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 hover:border-emerald-500 transition-all min-h-[36px]"
                  >
                    <span className="rounded bg-emerald-900 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">2</span>
                    제조사 연결
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("advertising");
                      setReason("스팸/광고 처리");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800/90 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition-all min-h-[36px]"
                  >
                    <span className="rounded bg-neutral-700 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">3</span>
                    광고 분류
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode("internal");
                      setReason("사내 직원 소통");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-purple-800/60 bg-purple-950/80 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-900 hover:border-purple-500 transition-all min-h-[36px]"
                  >
                    <span className="rounded bg-purple-900 px-1.5 py-0.5 font-mono text-[10px] text-purple-200">4</span>
                    내부 메일
                  </button>
                </div>
              </div>

              {/* Status feedback */}
              {actionError && (
                <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/80 p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/80 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  {actionSuccess}
                </div>
              )}
            </div>

            {/* Modal / Action Form Overlay */}
            {modalMode && (
              <div className="shrink-0 border-b border-neutral-700 bg-neutral-900/95 backdrop-blur-md p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                <form onSubmit={handleClassifySubmit} className="space-y-4 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-indigo-400" />
                      {modalMode === "buyer" && "정상 바이어 승인 및 고객 업무 승격"}
                      {modalMode === "supplier" && "제조사 엔티티 및 대화 연결"}
                      {modalMode === "advertising" && "광고/스팸으로 분류"}
                      {modalMode === "internal" && "사내 직원 메일로 분류"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      취소 (Esc)
                    </button>
                  </div>

                  {modalMode === "buyer" && (
                    <div className="space-y-3.5">
                      {/* Sub-tab: New Buyer vs Existing Buyer */}
                      <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 w-fit">
                        <button
                          type="button"
                          onClick={() => setBuyerModeTab("new")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            buyerModeTab === "new"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                          }`}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          신규 바이어 등록 (기본)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBuyerModeTab("existing")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            buyerModeTab === "existing"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                          }`}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          기존 바이어 연결 ({buyers.length}명)
                        </button>
                      </div>

                      {buyerModeTab === "new" ? (
                        <div className="space-y-3 rounded-xl border border-neutral-800/90 bg-neutral-950/60 p-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                                <span>바이어 담당자 이름 <span className="text-rose-400">*</span></span>
                                {newName && <span className="text-[10px] text-emerald-400 font-normal">본문 추출됨</span>}
                              </label>
                              <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="이름 (예: John Doe)"
                                required
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-neutral-300">
                                대표 이메일 <span className="text-rose-400">*</span>
                              </label>
                              <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="이메일 (예: buyer@domain.com)"
                                required
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-neutral-300">
                                유입 채널 <span className="text-rose-400">*</span>
                              </label>
                              <select
                                value={newInflowChannel}
                                onChange={(e) => setNewInflowChannel(e.target.value as (typeof INFLOW_CHANNELS)[number])}
                                required
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-200 outline-none focus:border-indigo-500"
                              >
                                {INFLOW_CHANNELS.map((ch) => (
                                  <option key={ch} value={ch}>
                                    {CHANNEL_NAMES[ch] || ch}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-neutral-300">
                                  브랜드명 / 회사명
                                </label>
                                {newBrandName && (
                                  <span className="text-[10px] text-neutral-500 font-mono">
                                    {brandCandidates.find((c) => c.value.toLowerCase() === newBrandName.toLowerCase())?.label || "직접 입력"}
                                  </span>
                                )}
                              </div>
                              <input
                                type="text"
                                value={newBrandName}
                                onChange={(e) => setNewBrandName(e.target.value)}
                                placeholder="브랜드명 또는 회사명"
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-indigo-500"
                              />
                              {brandCandidates.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="text-[10px] text-neutral-500 font-medium">추천 후보:</span>
                                  {brandCandidates.map((c) => {
                                    const isSelected = newBrandName.toLowerCase() === c.value.toLowerCase();
                                    return (
                                      <button
                                        key={`${c.source}-${c.value}`}
                                        type="button"
                                        onClick={() => setNewBrandName(c.value)}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                                          isSelected
                                            ? "bg-indigo-950 border-indigo-600 text-indigo-200 shadow-sm"
                                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                                        }`}
                                      >
                                        <span>{c.value}</span>
                                        <span className="text-[9px] opacity-70">({c.label})</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-neutral-300">
                                소재 국가
                              </label>
                              <input
                                type="text"
                                value={newCountry}
                                onChange={(e) => setNewCountry(e.target.value)}
                                placeholder="예: 미국 (USA), 일본"
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-neutral-300">
                                전화번호 / 연락처
                              </label>
                              <input
                                type="text"
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                placeholder="전화번호 (선택)"
                                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          {/* AI Brief Extract Checkbox */}
                          <label className="flex items-center gap-2 text-xs text-indigo-300 font-medium cursor-pointer pt-1.5">
                            <input
                              type="checkbox"
                              checked={autoExtractBrief}
                              onChange={(e) => setAutoExtractBrief(e.target.checked)}
                              className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                            <span>승인 즉시 인바운드 본문 AI 브리프/추출 자동 실행</span>
                          </label>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-neutral-800/90 bg-neutral-950/60 p-3.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-neutral-300">연결할 바이어 선택</label>
                            <select
                              value={selectedBuyerId}
                              onChange={(e) => setSelectedBuyerId(e.target.value)}
                              required
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-200 outline-none focus:border-indigo-500"
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
                              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-neutral-200 outline-none focus:border-indigo-500"
                            >
                              {conversations.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.counterpartyLabel || c.id} ({c.lastSubject || "대화"})
                                </option>
                              ))}
                            </select>
                          </div>

                          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-indigo-300 font-medium cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={autoExtractBrief}
                              onChange={(e) => setAutoExtractBrief(e.target.checked)}
                              className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                            <span>연결과 동시에 AI 브리프/추출 자동 실행</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {modalMode === "supplier" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-neutral-300">연결할 제조사 선택</label>
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          required
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2.5 text-xs text-neutral-200 outline-none focus:border-indigo-500"
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
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2.5 text-xs text-neutral-200 outline-none focus:border-indigo-500"
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
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-2.5 text-xs text-neutral-200 outline-none focus-visible:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalMode(null)}
                      className="rounded-xl border border-neutral-700 px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={classifying || !reason.trim()}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)] min-h-[36px]"
                    >
                      {classifying ? "승인 처리 중…" : "분류 확정"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Chronological Messages Timeline */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              {selectedDetail && selectedDetail.messages.length > 0 ? (
                (() => {
                  const returnUrlParam = encodeURIComponent(
                    `/admin/inbox?queue=${encodeURIComponent(queue)}&identityId=${encodeURIComponent(selectedIdentityId || "")}&panel=timeline`
                  );

                  return selectedDetail.messages.map((m, idx) => {
                    const isInbound = m.direction === "in";
                    const sentDate = new Date(m.sentAt);
                    const isFwd = isForwardedMessage(m);
                    const isFwdExpanded = expandedForwards[m.id || String(idx)];

                    if (isFwd && !isFwdExpanded) {
                      return (
                        <div key={m.id || idx} className="flex justify-center my-2">
                          <button
                            type="button"
                            onClick={() => toggleForward(m.id || String(idx))}
                            className="inline-flex items-center gap-2 rounded-full border border-purple-900/50 bg-purple-950/30 px-3.5 py-1.5 text-[11px] text-purple-300 hover:bg-purple-950/60 hover:text-purple-200 hover:border-purple-700/60 transition-all shadow-sm group"
                          >
                            <Forward className="h-3.5 w-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                            <span>
                              사내 전달: {m.fromName ? `${m.fromName} (${m.from.split("@")[0]})` : m.from} ➔ {m.to?.map(e => e.split("@")[0]).join(", ") || "내부"}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {sentDate.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="text-[10px] text-purple-400 font-semibold ml-1">펼치기 ▾</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id || idx}
                        className={`flex w-full ${
                          isInbound
                            ? "justify-start pr-6 sm:pr-16"
                            : "justify-end pl-6 sm:pl-16"
                        }`}
                      >
                        <div
                          className={`w-full max-w-[90%] sm:max-w-[84%] rounded-2xl border p-4.5 transition-all space-y-3.5 shadow-md ${
                            isFwd
                              ? "border-purple-900/60 bg-purple-950/20 text-neutral-100 rounded-tr-sm"
                              : isInbound
                                ? "border-neutral-800 bg-neutral-900/90 text-neutral-200 rounded-tl-sm"
                                : "border-indigo-900/50 bg-indigo-950/25 text-neutral-100 rounded-tr-sm"
                          }`}
                        >
                          {/* Forward Header if expanded */}
                          {isFwd && (
                            <div className="flex items-center justify-between border-b border-purple-900/50 pb-2 text-[10px] text-purple-300 font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Forward className="h-3 w-3 text-purple-400" />
                                사내 포워딩 메시지
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleForward(m.id || String(idx))}
                                className="text-purple-400 hover:text-purple-200 underline font-medium"
                              >
                                접기 ▴
                              </button>
                            </div>
                          )}

                          {/* Message Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/60 pb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                  isInbound
                                    ? "border-sky-800/80 bg-sky-950/80 text-sky-300"
                                    : "border-indigo-700/80 bg-indigo-950/90 text-indigo-200"
                                }`}
                              >
                                {isInbound ? (
                                  <ArrowDownLeft className="h-3 w-3" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3" />
                                )}
                                {isInbound ? "수신 (Inbound)" : "발신 (Outbound)"}
                              </span>

                              <span className="text-xs font-semibold text-neutral-100 truncate max-w-[200px]">
                                {m.authorRole === "automation" ? "자동 안내" : m.fromName ? `${m.fromName} (${m.from})` : m.from}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                              <time dateTime={m.sentAt} title={sentDate.toLocaleString("ko-KR")}>
                                {sentDate.toLocaleString("ko-KR", {
                                  year: "numeric",
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                          </div>

                          {/* Subject & Single View Link */}
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-neutral-100 truncate">
                              {m.subject ? m.subject : m.channel === "channeltalk" ? "채널톡 메시지" : "(제목 없음)"}
                            </h4>
                            <Link
                              href={`/admin/inbox/${encodeURIComponent(m.threadKey)}?returnUrl=${returnUrlParam}`}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 shrink-0"
                            >
                              단독 뷰 &rarr;
                            </Link>
                          </div>

                          {/* Message Body & Media Content */}
                          <div className="rounded-xl bg-neutral-950/80 p-4 text-xs leading-relaxed text-neutral-200 font-sans break-words border border-neutral-800/60 select-text">
                            <MessageBodyClean
                              bodyText={m.bodyText || ""}
                              attachments={m.attachments}
                              messageId={m.id}
                              isGmail={m.channel.startsWith("gmail_")}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-neutral-500">
                  <Inbox className="mb-2 h-8 w-8 text-neutral-700" />
                  <p className="font-medium text-neutral-400">메시지 내역이 없습니다</p>
                </div>
              )}
            </div>

            {/* Bottom Quick Reply Box */}
            {selectedDetail && selectedDetail.threads.length > 0 && (
              <div className="shrink-0 border-t border-neutral-800/80">
                <ThreadReplyForm threadKey={selectedDetail.threads[0].threadKey} />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-12 text-center text-xs text-neutral-500">
            검토할 항목을 선택해주세요.
          </div>
        )}
      </div>
      {/* Completion & Decision Modal */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl space-y-4 text-neutral-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100">
                  바이어 등록 및 대화 개설 완료
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  <strong className="text-neutral-200 font-semibold">{successModalData.buyerName}</strong>의 고객 대화가 생성되었습니다.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5 text-xs text-neutral-400 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Sparkles className="h-4 w-4" />
                <span>AI 브리프 자동 분석 완료</span>
              </div>
              <p>
                인바운드 메시지 본문에서 제품 사양, 수량, 희망 일정이 추출되어 딜 인큐베이터에 준비되었습니다.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  setModalMode(null);
                  setReason("");
                  router.refresh();
                }}
                className="w-full sm:w-auto rounded-xl border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                검토함에 남아 계속 분류
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/admin/inbox?queue=customer-work&conversationId=${encodeURIComponent(successModalData.conversationId)}`);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)]"
              >
                <span>고객 업무(대화)로 바로 이동</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
