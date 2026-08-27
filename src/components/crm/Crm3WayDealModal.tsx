"use client";

import React, { useState, useEffect, useRef } from "react";
import { CrmDeal, CrmMessage } from "@/lib/crm-types";
import { MOCK_MESSAGES } from "@/lib/mock-crm-data";
import { X, MessageSquare, AlertTriangle, Send } from "lucide-react";
import gsap from "gsap";

interface Props {
  deal: CrmDeal;
  onClose: () => void;
  onUpdateStage: (dealId: string, newStage: any) => void;
}

export default function Crm3WayDealModal({ deal, onClose, onUpdateStage }: Props) {
  const [activeTab, setActiveTab] = useState<"3way" | "chat">("3way");
  const modalRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { scale: 0.95, opacity: 0, y: 10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.2)" }
      );
    }
  }, []);

  useEffect(() => {
    if (tabContentRef.current) {
      gsap.fromTo(
        tabContentRef.current,
        { opacity: 0, x: activeTab === "chat" ? 10 : -10 },
        { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }
      );
    }
  }, [activeTab]);

  const [messages, setMessages] = useState<CrmMessage[]>(
    MOCK_MESSAGES[deal.id] || [
      {
        id: "init-msg",
        dealId: deal.id,
        senderType: "buyer",
        senderName: deal.buyerName,
        content: `${deal.title} 에 대한 최초 문의가 접수되었습니다.`,
        timestamp: deal.inquiryDate,
      },
    ]
  );
  const [replyInput, setReplyInput] = useState("");

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim()) return;
    const newMsg: CrmMessage = {
      id: "msg-" + Date.now(),
      dealId: deal.id,
      senderType: "pm",
      senderName: `${deal.pmName} (Me)`,
      content: replyInput,
      timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).slice(0, 16),
    };
    setMessages((prev) => [...prev, newMsg]);
    setReplyInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div ref={modalRef} className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/90">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${deal.priority === 'hot' ? 'bg-red-500' : deal.priority === 'warm' ? 'bg-amber-500' : 'bg-blue-500'}`} />
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                {deal.title}
                <span className="text-xs font-normal text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                  {deal.buyerCountry}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                담당 PM: <span className="text-neutral-200">{deal.pmName}</span> | 마지막 업데이트: {deal.updatedAt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Navigation */}
            <div className="bg-neutral-800 p-1 rounded-lg flex gap-1 mr-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab("3way")}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === "3way" ? "bg-indigo-600 text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                3-Way 매칭 뷰
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "chat" ? "bg-indigo-600 text-white font-semibold" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                대화 내역 (채널톡 UI)
                {messages.some((m) => m.actionRequired) && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div ref={tabContentRef} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: 3-WAY MATCHING VIEW */}
          {activeTab === "3way" && (
            <div className="space-y-6">
              
              {/* 3-Column Ledger Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Buyer Side */}
                <div className="bg-neutral-950/60 border border-blue-900/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                        👤 Buyer (Demand)
                      </span>
                      <span className="text-xs bg-blue-950 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded">
                        Revenue Side
                      </span>
                    </div>

                    <h3 className="font-semibold text-base text-neutral-100">{deal.buyerName}</h3>
                    <p className="text-xs text-neutral-400 mb-4">{deal.buyerCountry}</p>

                    <div className="space-y-2 text-xs text-neutral-300 border-t border-neutral-800/80 pt-3">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">제시 단가 (Unit Price):</span>
                        <span className="font-mono font-medium">${deal.buyerUnitPrice.toFixed(2)} / ea</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">요청 수량 (Quantity):</span>
                        <span className="font-mono">{deal.buyerTotalQty.toLocaleString()} 개</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-neutral-800 font-medium">
                        <span className="text-blue-300">총 판매 금액 (Revenue):</span>
                        <span className="font-mono text-blue-400 text-sm font-bold">
                          ${deal.buyerTotalValue.toLocaleString()} USD
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Medidakos Margin (Internal) */}
                <div className="bg-neutral-950 border border-indigo-900/60 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/10 rounded-full blur-xl pointer-events-none" />
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        🏢 Medidakos (Margin)
                      </span>
                      <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded font-semibold">
                        🔒 Internal Only
                      </span>
                    </div>

                    <h3 className="font-semibold text-base text-neutral-100">마진 & 수익성 분석</h3>
                    <p className="text-xs text-neutral-400 mb-4">담당 PM: {deal.pmName}</p>

                    <div className="space-y-2 text-xs text-neutral-300 border-t border-neutral-800/80 pt-3">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">예상 물류비 (Shipping):</span>
                        <span className="font-mono text-neutral-300">${deal.shippingCostUsd.toLocaleString()} USD</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">공장 매입원가 (Cost):</span>
                        <span className="font-mono text-neutral-300">₩{deal.supplierTotalCost.toLocaleString()} KRW</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-neutral-800">
                        <span className="text-indigo-300 font-semibold">예상 총 마진 (Gross Profit):</span>
                        <span className="font-mono text-emerald-400 text-sm font-bold">
                          ${deal.grossProfitUsd.toLocaleString()} USD
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-300 font-semibold">마진율 (Margin Rate):</span>
                        <span className="font-mono text-emerald-400 text-sm font-extrabold">
                          {deal.marginPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Supplier Side */}
                <div className="bg-neutral-950/60 border border-purple-900/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                        🏭 Supplier (Supply)
                      </span>
                      <span className="text-xs bg-purple-950 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded">
                        Cost Side
                      </span>
                    </div>

                    <h3 className="font-semibold text-base text-neutral-100">{deal.supplierName || "소싱 공장 미정"}</h3>
                    <p className="text-xs text-neutral-400 mb-4">제조/충진 파트너</p>

                    <div className="space-y-2 text-xs text-neutral-300 border-t border-neutral-800/80 pt-3">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">공장 공급단가:</span>
                        <span className="font-mono">
                          {deal.supplierUnitPrice ? `₩${deal.supplierUnitPrice.toLocaleString()} / ea` : "협상 중"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">생산 리드타임:</span>
                        <span className="font-mono">약 30일</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-neutral-800 font-medium">
                        <span className="text-purple-300">총 제조 원가:</span>
                        <span className="font-mono text-purple-400 text-sm font-bold">
                          {deal.supplierTotalCost ? `₩${deal.supplierTotalCost.toLocaleString()} KRW` : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Product Spec Details & Regulatory Alert */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  📦 제품 사양 (Product Specification)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-400 block">품목 종류:</span>
                    <span className="font-medium text-neutral-200">{deal.productSpec.productType}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">용량 및 용기:</span>
                    <span className="font-medium text-neutral-200">
                      {deal.productSpec.volumeMl}ml | {deal.productSpec.containerType}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">핵심 성분:</span>
                    <span className="font-medium text-neutral-200">
                      {deal.productSpec.keyIngredients.join(", ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">샘플 상태:</span>
                    <span className="inline-block bg-amber-950 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded font-mono text-[11px]">
                      {deal.productSpec.sampleStatus}
                    </span>
                  </div>
                </div>

                {deal.productSpec.regulatoryNotes && (
                  <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold text-amber-300">규제 & 체크사항: </strong>
                      {deal.productSpec.regulatoryNotes}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: CHAT STYLE EMAIL INBOX (채널톡 UI) */}
          {activeTab === "chat" && (
            <div className="space-y-4">
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 min-h-[350px] flex flex-col justify-between">
                
                {/* Chat Messages List */}
                <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                  {messages.map((msg) => {
                    const isPm = msg.senderType === "pm";
                    const isSystem = msg.senderType === "system";

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="bg-red-950/60 border border-red-800/50 text-red-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isPm ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px] text-neutral-400">
                          <span className="font-semibold text-neutral-300">
                            {msg.senderName} {msg.senderEmail ? `<${msg.senderEmail}>` : ""}
                          </span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                            isPm
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-tl-none"
                          }`}
                        >
                          {msg.content}
                        </div>

                        {msg.aiSummary && (
                          <div className="mt-1 bg-indigo-950/50 border border-indigo-800/40 text-indigo-300 text-[11px] px-2.5 py-1 rounded-md">
                            🤖 AI 요약: {msg.aiSummary}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="mt-4 pt-3 border-t border-neutral-800 flex gap-2">
                  <input
                    type="text"
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    placeholder="이메일 회신 내용 작성 (채널톡 형태로 발송)..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white placeholder-neutral-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    전송
                  </button>
                </form>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
