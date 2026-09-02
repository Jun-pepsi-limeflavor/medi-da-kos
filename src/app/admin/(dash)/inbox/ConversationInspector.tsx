"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  History,
  Mail,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  Settings,
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function ConversationInspector({
  detail,
  isCollapsed = false,
  onToggleCollapse,
}: ConversationInspectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"deal" | "settings">("deal");

  // Collapsible section toggles in the Settings & History tab
  const [openSections, setOpenSections] = useState({
    workflow: true,
    collaborators: true,
    identities: false,
    events: false,
  });

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
    if (isCollapsed) {
      return (
        <div className="flex h-full w-12 flex-col items-center justify-between border-l border-neutral-800 bg-neutral-950 py-3 text-neutral-500">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white transition shadow-sm"
            title="인스펙터 펼치기"
            aria-label="인스펙터 펼치기"
          >
            <PanelRightOpen className="h-4 w-4 text-indigo-400" />
          </button>
        </div>
      );
    }
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

      setSuccess("대화 설정이 성공적으로 저장되었습니다.");
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // Collapsed Sidebar Rail View
  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center justify-between border-l border-neutral-800 bg-neutral-950 py-3 text-neutral-400">
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Expand Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white transition shadow-sm"
            title="인스펙터 펼치기"
            aria-label="인스펙터 펼치기"
          >
            <PanelRightOpen className="h-4 w-4 text-indigo-400" />
          </button>

          <div className="w-6 border-t border-neutral-800 my-0.5" />

          {/* Tab 1 Icon Trigger */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("deal");
              onToggleCollapse?.();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
              activeTab === "deal"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
            title="딜 인큐베이터 열기"
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Tab 2 Icon Trigger */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("settings");
              onToggleCollapse?.();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
              activeTab === "settings"
                ? "bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
            title="설정 & 이력 열기"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom Workflow Status Indicator Dot */}
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              workflowState === "active"
                ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                : workflowState === "waiting_customer"
                  ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                  : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            }`}
            title={`상태: ${workflowState === "active" ? "진행 중" : workflowState === "waiting_customer" ? "고객 대기" : "완료"}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950 overflow-hidden">
      {/* Header & Tabs */}
      <div className="shrink-0 border-b border-neutral-800/80 bg-neutral-900/70 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Mobile Back Button */}
            <Link
              href={`/admin/inbox?${timelineParams.toString()}`}
              aria-label="타임라인으로 돌아가기"
              className="lg:hidden inline-flex items-center justify-center p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 min-h-[36px] min-w-[36px]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-neutral-100 font-mono truncate max-w-[180px]">
                {conversation.counterpartyLabel || "대화 인스펙터"}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-semibold border ${
                    workflowState === "active"
                      ? "bg-sky-950 text-sky-300 border-sky-800/60"
                      : workflowState === "waiting_customer"
                        ? "bg-amber-950 text-amber-300 border-amber-800/60"
                        : "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                  }`}
                >
                  {workflowState === "active" ? "진행 중" : workflowState === "waiting_customer" ? "고객 대기" : "완료"}
                </span>
                {ownerEmail && (
                  <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
                    {ownerEmail.split("@")[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Segmented Tab Switcher & Collapse Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab("deal")}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "deal"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>딜 인큐베이터</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "settings"
                    ? "bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>설정 & 이력</span>
              </button>
            </div>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                title="인스펙터 접어서 대화창 넓히기"
                aria-label="인스펙터 접기"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
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
            <div className="flex flex-col items-center justify-center p-10 text-center text-xs text-neutral-500 rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
              <Sparkles className="mb-2 h-8 w-8 text-neutral-700" />
              <h4 className="font-semibold text-neutral-400">분석할 수신 메시지가 없습니다</h4>
              <p className="mt-1 text-[11px] text-neutral-500 max-w-sm">
                수신된 인바운드 메시지가 대화에 등록되면 AI가 자동으로 제품 사양과 바이어 정보를 분석하여 딜 생성을 지원합니다.
              </p>
            </div>
          )
        ) : (
          /* Tab 2: Settings & Audit Logs (Collapsible Sections) */
          <div className="space-y-3.5">
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

            {/* Collapsible Section 1: Workflow & Assignment Settings */}
            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/80 shadow-sm backdrop-blur-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("workflow")}
                className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                    <Clock className="h-3 w-3" />
                  </span>
                  <span>워크플로우 및 담당자 설정</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                      workflowState === "active"
                        ? "bg-sky-950 text-sky-300 border-sky-800/60"
                        : workflowState === "waiting_customer"
                          ? "bg-amber-950 text-amber-300 border-amber-800/60"
                          : "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                    }`}
                  >
                    {workflowState === "active" ? "진행 중" : workflowState === "waiting_customer" ? "고객 대기" : "완료"}
                  </span>
                  {openSections.workflow ? (
                    <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                </div>
              </button>

              {openSections.workflow && (
                <form onSubmit={handleSave} className="border-t border-neutral-800/70 p-3.5 space-y-3.5 bg-neutral-950/40 text-xs animate-in fade-in duration-100">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">상태</label>
                      <select
                        value={workflowState}
                        onChange={(e) => setWorkflowState(e.target.value as "active" | "waiting_customer" | "done")}
                        className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="active">진행 중 (Active)</option>
                        <option value="waiting_customer">고객 대기 (Waiting)</option>
                        <option value="done">완료 (Done)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">주담당자 이메일</label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                        <input
                          type="email"
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          placeholder="담당자 이메일"
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-8 pr-2.5 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">다음 처리 행동 (Next Action)</label>
                    <input
                      type="text"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      placeholder="예: MOQ 5,000개 견적 송부 및 카탈로그 전달"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">처리 기한 (Due Date)</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                        <input
                          type="datetime-local"
                          value={dueAt}
                          onChange={(e) => setDueAt(e.target.value)}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-8 pr-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">기본 발신 계정</label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                        <input
                          type="text"
                          value={defaultOutboundAccount}
                          onChange={(e) => setDefaultOutboundAccount(e.target.value)}
                          placeholder="예: thomas, hally"
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-8 pr-2.5 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{saving ? "설정 저장 중…" : "설정 저장"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Collapsible Section 2: Collaborators */}
            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/80 shadow-sm backdrop-blur-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("collaborators")}
                className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-950 text-purple-400 border border-purple-800/60">
                    <Users className="h-3 w-3" />
                  </span>
                  <span>협업자 관리</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                    {collaborators.length}명
                  </span>
                  {openSections.collaborators ? (
                    <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                </div>
              </button>

              {openSections.collaborators && (
                <div className="border-t border-neutral-800/70 p-3.5 space-y-3 bg-neutral-950/40 text-xs animate-in fade-in duration-100">
                  <div className="flex flex-wrap gap-1.5">
                    {collaborators.length > 0 ? (
                      collaborators.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700/80 bg-neutral-800/90 px-2.5 py-1 text-[11px] text-neutral-300 shadow-sm"
                        >
                          <User className="h-3 w-3 text-neutral-500" />
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCollaborator(email)}
                            className="text-neutral-500 hover:text-rose-400 transition"
                            aria-label={`${email} 제거`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-neutral-500 italic">등록된 협업자가 없습니다.</span>
                    )}
                  </div>

                  <form onSubmit={handleAddCollaborator} className="flex gap-2">
                    <input
                      type="email"
                      value={newCollab}
                      onChange={(e) => setNewCollab(e.target.value)}
                      placeholder="협업자 이메일 추가 (Enter)…"
                      className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>추가</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Collapsible Section 3: Linked Identities */}
            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/80 shadow-sm backdrop-blur-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection("identities")}
                className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-950 text-sky-400 border border-sky-800/60">
                    <Tag className="h-3 w-3" />
                  </span>
                  <span>연결된 고객 식별자</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                    {identities.length}개
                  </span>
                  {openSections.identities ? (
                    <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                </div>
              </button>

              {openSections.identities && (
                <div className="border-t border-neutral-800/70 p-3.5 space-y-2 bg-neutral-950/40 text-xs animate-in fade-in duration-100">
                  {identities.map((idDoc) => (
                    <div
                      key={idDoc.id}
                      className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-2.5 text-xs text-neutral-300 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-[11px] text-neutral-200 truncate">{idDoc.value}</span>
                        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 uppercase font-mono">{idDoc.kind}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`'${idDoc.value}' 식별자를 '광고·내부'로 이동하시겠습니까? (고객 업무 큐에서 제외됩니다)`)) return;
                          try {
                            setSaving(true);
                            const res = await fetch(`/api/admin/conversation-identities/${encodeURIComponent(idDoc.id)}/classify`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ classification: "internal" }),
                            });
                            if (!res.ok) {
                              const errJson = await res.json().catch(() => ({}));
                              throw new Error(errJson.error || "분류 변경 실패");
                            }
                            setSuccess("광고·내부로 이동되었습니다.");
                            router.refresh();
                          } catch (err: unknown) {
                            setError(err instanceof Error ? err.message : "분류 변경 중 오류가 발생했습니다.");
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="text-[10px] text-neutral-400 hover:text-amber-300 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded-lg transition shrink-0"
                      >
                        광고·내부로 이동
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Collapsible Section 4: Audit History */}
            {events.length > 0 && (
              <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/80 shadow-sm backdrop-blur-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("events")}
                  className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800/50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                      <History className="h-3 w-3" />
                    </span>
                    <span>감사 이력 (Audit Trail)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                      {events.length}건
                    </span>
                    {openSections.events ? (
                      <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                    )}
                  </div>
                </button>

                {openSections.events && (
                  <div className="border-t border-neutral-800/70 p-3.5 space-y-2.5 max-h-64 overflow-y-auto bg-neutral-950/40 text-xs animate-in fade-in duration-100 divide-y divide-neutral-900">
                    {events.map((ev) => (
                      <div key={ev.id} className="pt-2 text-[11px] text-neutral-400 space-y-0.5 first:pt-0">
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
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
