"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  ExternalLink,
  History,
  Mail,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { ConversationDetail } from "@/lib/repo/conversations";
import ExtractionPanel from "./[threadKey]/ExtractionPanel";

interface ConversationInspectorProps {
  detail: ConversationDetail | null;
}

export default function ConversationInspector({
  detail,
}: ConversationInspectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"deal" | "settings">("deal");
  const [showMetaQuickEdit, setShowMetaQuickEdit] = useState(false);

  // Form states initialized from conversation
  const [workflowState, setWorkflowState] = useState<"active" | "waiting_customer" | "done">(
    detail?.conversation.workflowState || "active",
  );
  const [ownerEmail, setOwnerEmail] = useState(detail?.conversation.ownerEmail || "");
  const [nextAction, setNextAction] = useState(detail?.conversation.nextAction || "");
  const [dueAt, setDueAt] = useState(detail?.conversation.dueAt ? detail.conversation.dueAt.slice(0, 16) : "");
  const [defaultOutboundAccount, setDefaultOutboundAccount] = useState(
    detail?.conversation.defaultOutboundAccount || "",
  );
  const [collaborators, setCollaborators] = useState<string[]>(
    detail?.conversation.collaboratorEmails || [],
  );
  const [newCollab, setNewCollab] = useState("");

  if (!detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-neutral-950 p-6 text-center text-neutral-500">
        <Sparkles className="mb-2 h-8 w-8 text-neutral-700" />
        <h3 className="text-xs font-semibold text-neutral-400">대화 및 딜 인큐베이터</h3>
        <p className="text-[11px] text-neutral-500 mt-1">
          대화를 선택하면 AI 제안 검토, 딜 생성 및 대화 설정을 관리할 수 있습니다.
        </p>
      </div>
    );
  }

  const { conversation, identities, threads, events = [], anchorMessage, intakeReview, linkedDeal } = detail;
  const primaryThread = threads[0] || null;

  const timelineParams = new URLSearchParams(searchParams.toString());
  timelineParams.set("panel", "timeline");

  function handleAddCollaborator(e: React.FormEvent) {
    e.preventDefault();
    const email = newCollab.trim().toLowerCase();
    if (!email || !email.includes("@") || collaborators.includes(email)) return;
    setCollaborators([...collaborators, email]);
    setNewCollab("");
  }

  function handleRemoveCollaborator(email: string) {
    setCollaborators(collaborators.filter((c) => c !== email));
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const patch: Record<string, unknown> = {
      workflowState,
      ownerEmail: ownerEmail.trim() || null,
      nextAction: nextAction.trim() || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      defaultOutboundAccount: defaultOutboundAccount.trim() || null,
      collaboratorEmails: collaborators,
    };

    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(conversation.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        setError(err?.error || "설정 저장에 실패했습니다.");
        return;
      }

      setSuccess("대화 설정이 저장되었습니다.");
      setShowMetaQuickEdit(false);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950 overflow-hidden">
      {/* Header & Tabs */}
      <div className="shrink-0 border-b border-neutral-800/80 bg-neutral-900/70 p-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {/* Mobile Back Button */}
            <Link
              href={`/admin/inbox?${timelineParams.toString()}`}
              aria-label="타임라인으로 돌아가기"
              className="lg:hidden inline-flex items-center justify-center p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 min-h-[36px] min-w-[36px]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h3 className="text-xs font-bold text-neutral-100 font-mono truncate max-w-[180px]">
              {conversation.counterpartyLabel || "대화 인스펙터"}
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab("deal")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === "deal"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              딜 인큐베이터
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === "settings"
                  ? "bg-neutral-800 text-neutral-100 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Tag className="h-3 w-3" />
              설정 & 이력
            </button>
          </div>
        </div>

        {/* Smart Meta Quick Pill (Compact status & owner) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950/80 px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center gap-2 text-neutral-300">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                workflowState === "active"
                  ? "bg-sky-950 text-sky-300 border border-sky-800/60"
                  : workflowState === "waiting_customer"
                    ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                    : "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
              }`}
            >
              {workflowState === "active" ? "진행 중" : workflowState === "waiting_customer" ? "고객 대기" : "완료"}
            </span>
            <span className="text-neutral-400 truncate max-w-[130px]">
              {ownerEmail ? ownerEmail.split("@")[0] : "담당자 미지정"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowMetaQuickEdit(!showMetaQuickEdit)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium"
          >
            메타 수정 {showMetaQuickEdit ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Expandable Quick Meta Edit Form */}
        {showMetaQuickEdit && (
          <form onSubmit={handleSave} className="mt-2 space-y-2.5 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-xs animate-in fade-in duration-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">상태</label>
                <select
                  value={workflowState}
                  onChange={(e) => setWorkflowState(e.target.value as "active" | "waiting_customer" | "done")}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 text-xs text-neutral-200"
                >
                  <option value="active">진행 중</option>
                  <option value="waiting_customer">고객 대기</option>
                  <option value="done">완료</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">주담당자</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="담당자 이메일"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 text-xs text-neutral-200"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 block mb-1">다음 처리 행동 (Next Action)</label>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="예: MOQ 5,000개 견적 송부"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 text-xs text-neutral-200"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 block mb-1">기한 (Due Date)</label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 text-xs text-neutral-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowMetaQuickEdit(false)}
                className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
        {activeTab === "deal" ? (
          /* Tab 1: AI Deal Incubator */
          anchorMessage && primaryThread ? (
            <ExtractionPanel
              anchorMessage={anchorMessage}
              threadKey={primaryThread.threadKey}
              thread={primaryThread}
              intakeReview={intakeReview}
              linkedDeal={linkedDeal}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center text-xs text-neutral-500">
              <Sparkles className="mb-2 h-8 w-8 text-neutral-700" />
              <h4 className="font-semibold text-neutral-400">분석할 수신 메시지가 없습니다</h4>
              <p className="mt-1 text-[11px] text-neutral-500">
                수신된 인바운드 메시지가 대화에 등록되면 AI가 자동으로 제품 사양과 바이어 정보를 분석하여 딜 생성을 지원합니다.
              </p>
            </div>
          )
        ) : (
          /* Tab 2: Settings & Audit Logs */
          <div className="space-y-5">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/80 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/80 p-3 text-xs text-emerald-300">
                {success}
              </div>
            )}

            {/* Collaborators */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-neutral-400" />
                협업자
              </label>
              <div className="flex flex-wrap gap-1.5">
                {collaborators.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/90 px-2.5 py-1 text-[11px] text-neutral-300"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveCollaborator(email)}
                      className="text-neutral-500 hover:text-rose-400"
                      aria-label={`${email} 제거`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={newCollab}
                  onChange={(e) => setNewCollab(e.target.value)}
                  placeholder="협업자 이메일 추가…"
                  className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus-visible:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddCollaborator}
                  className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Linked Identities */}
            <div className="space-y-1.5 pt-3 border-t border-neutral-800">
              <span className="text-xs font-semibold text-neutral-400 block">
                연결된 고객 식별자 ({identities.length})
              </span>
              <div className="space-y-1">
                {identities.map((idDoc) => (
                  <div
                    key={idDoc.id}
                    className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-2.5 text-xs text-neutral-300 flex items-center justify-between"
                  >
                    <span className="font-mono text-[11px] text-neutral-200 truncate">{idDoc.value}</span>
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 uppercase font-mono">{idDoc.kind}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Events Trail */}
            {events.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-neutral-800">
                <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  감사 이력 ({events.length})
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 divide-y divide-neutral-900">
                  {events.map((ev) => (
                    <div key={ev.id} className="pt-2 text-[11px] text-neutral-400 space-y-0.5">
                      <div className="flex items-center justify-between text-neutral-300 font-medium">
                        <span>{ev.action}</span>
                        <span className="text-[10px] text-neutral-500">
                          {ev.at ? new Date(ev.at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      {ev.actorEmail && (
                        <div className="text-[10px] text-neutral-500">처리자: {ev.actorEmail}</div>
                      )}
                      {ev.reason && (
                        <div className="text-[10px] text-neutral-400 italic">사유: {ev.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
