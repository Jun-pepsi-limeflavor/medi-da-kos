"use client";

import React, { useState, useEffect, useRef } from "react";
import { MOCK_DEALS, MOCK_MESSAGES } from "@/lib/mock-crm-data";
import { CrmMessage } from "@/lib/crm-types";
import { MessageSquare, Send, AlertTriangle, Clock } from "lucide-react";
import gsap from "gsap";

export default function CrmChatInbox() {
  const [selectedDealId, setSelectedDealId] = useState<string>("deal-bala-spf15");
  const [messagesMap, setMessagesMap] = useState(MOCK_MESSAGES);
  const [replyText, setReplyText] = useState("");
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const activeDeal = MOCK_DEALS.find((d) => d.id === selectedDealId) || MOCK_DEALS[0];
  const activeMessages = messagesMap[selectedDealId] || [];

  useEffect(() => {
    if (chatBodyRef.current) {
      gsap.fromTo(
        chatBodyRef.current.children,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: "power2.out" }
      );
    }
  }, [selectedDealId, activeMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const newMsg: CrmMessage = {
      id: "msg-" + Date.now(),
      dealId: selectedDealId,
      senderType: "pm",
      senderName: `${activeDeal.pmName} (PM)`,
      content: replyText,
      timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).slice(0, 16),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [selectedDealId]: [...(prev[selectedDealId] || []), newMsg],
    }));

    setReplyText("");
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl flex h-[650px]">
      
      {/* Left Column: Thread List */}
      <div className="w-80 border-r border-neutral-800 bg-neutral-950 flex flex-col">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            이메일 커뮤니케이션 (채널톡 UI)
          </h3>
          <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-mono">
            {MOCK_DEALS.length} 스레드
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60">
          {MOCK_DEALS.map((deal) => {
            const msgs = messagesMap[deal.id] || [];
            const lastMsg = msgs[msgs.length - 1];
            const isSelected = deal.id === selectedDealId;
            const hasActionRequired = msgs.some((m) => m.actionRequired);

            return (
              <div
                key={deal.id}
                onClick={() => setSelectedDealId(deal.id)}
                className={`p-3.5 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-neutral-900 border-l-4 border-indigo-500"
                    : "hover:bg-neutral-900/50"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-xs text-neutral-200 truncate max-w-[170px]">
                    {deal.buyerName}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {lastMsg ? lastMsg.timestamp.slice(5, 10) : deal.inquiryDate}
                  </span>
                </div>

                <div className="text-[11px] text-neutral-400 font-medium mb-1 truncate">
                  {deal.title}
                </div>

                <div className="text-[11px] text-neutral-500 truncate">
                  {lastMsg ? lastMsg.content : "문의 접수됨"}
                </div>

                {hasActionRequired && (
                  <div className="mt-2 inline-flex items-center gap-1 bg-red-950 text-red-400 border border-red-800/40 text-[10px] px-2 py-0.5 rounded font-medium">
                    <Clock className="w-3 h-3" /> 회신 필요
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Chat Window View */}
      <div className="flex-1 flex flex-col bg-neutral-900">
        
        {/* Chat Top Bar */}
        <div className="px-6 py-3.5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
              {activeDeal.title}
              <span className="text-xs font-normal text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                {activeDeal.buyerCountry}
              </span>
            </h4>
            <p className="text-xs text-neutral-400">
              바이어: <span className="text-neutral-200">{activeDeal.buyerName}</span> | 공장:{" "}
              <span className="text-neutral-200">{activeDeal.supplierName || "소싱 중"}</span> | PM:{" "}
              <span className="text-neutral-200">{activeDeal.pmName}</span>
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono text-blue-400 font-semibold block">
              판가: ${activeDeal.buyerTotalValue.toLocaleString()} USD
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              마진: {activeDeal.marginPct}% (${activeDeal.grossProfitUsd.toLocaleString()})
            </span>
          </div>
        </div>

        {/* Chat Messages Body with GSAP animation ref */}
        <div ref={chatBodyRef} className="flex-1 p-6 overflow-y-auto space-y-4">
          {activeMessages.map((msg) => {
            const isPm = msg.senderType === "pm";
            const isSupplier = msg.senderType === "supplier";
            const isSystem = msg.senderType === "system";

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-red-950/80 border border-red-800/60 text-red-300 text-xs px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
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
                  <span
                    className={`font-semibold ${
                      isPm
                        ? "text-indigo-400"
                        : isSupplier
                        ? "text-purple-400"
                        : "text-blue-400"
                    }`}
                  >
                    {isSupplier ? "🏭 " : isPm ? "🏢 " : "👤 "}
                    {msg.senderName} {msg.senderEmail ? `<${msg.senderEmail}>` : ""}
                  </span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    isPm
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : isSupplier
                      ? "bg-purple-950/80 border border-purple-800/60 text-purple-100 rounded-tl-none"
                      : "bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>

                {msg.aiSummary && (
                  <div className="mt-1 bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-[11px] px-3 py-1 rounded-md max-w-[75%]">
                    🤖 AI 메일 요약: {msg.aiSummary}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Chat Bottom Reply Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="이메일 회신 내용 작성 (채널톡 메시지 형태로 즉시 전송)..."
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 text-white placeholder-neutral-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            이메일 발송
          </button>
        </form>

      </div>
    </div>
  );
}
