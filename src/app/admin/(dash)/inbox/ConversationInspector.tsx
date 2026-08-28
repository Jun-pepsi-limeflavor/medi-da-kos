"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  History,
  Mail,
  Plus,
  Save,
  Tag,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { ConversationDetail } from "@/lib/repo/conversations";

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
        <h3 className="text-xs font-semibold text-neutral-400">대화 상세 정보</h3>
        <p className="text-[11px] text-neutral-500 mt-1">
          대화를 선택하면 담당자, 진행 상태, 기한 등을 설정할 수 있습니다.
        </p>
      </div>
    );
  }

  const { conversation, identities, events = [] } = detail;

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-neutral-800 bg-neutral-950 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 p-3.5 bg-neutral-900/60">
        <div className="flex items-center gap-2">
          {/* Mobile Back Button to Timeline */}
          <Link
            href={`/admin/inbox?${timelineParams.toString()}`}
            aria-label="타임라인으로 돌아가기"
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h3 className="text-xs font-bold text-neutral-100">대화 인스펙터</h3>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 min-h-[36px]"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Status Alerts */}
        {error && (
          <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/80 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/80 p-2.5 text-xs text-emerald-300">
            {success}
          </div>
        )}

        {/* Workflow State */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" />
            진행 상태
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { key: "active", label: "진행 중" },
                { key: "waiting_customer", label: "고객 대기" },
                { key: "done", label: "완료" },
              ] as const
            ).map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setWorkflowState(st.key)}
                className={`rounded-lg py-2 text-xs font-medium transition-all ${
                  workflowState === st.key
                    ? "border border-indigo-500 bg-indigo-950/60 text-indigo-200 font-semibold"
                    : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Assigned Owner */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-neutral-400" />
            주담당자 이메일
          </label>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="담당자 이메일 (미배정 시 공란)"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

        {/* Next Action */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-neutral-400" />
            다음 처리 행동
          </label>
          <input
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="예: 공장 견적 회신 대기, 샘플 발송 안내"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

        {/* Due Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            처리 기한 (Due Date)
          </label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

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
                className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300"
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
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus-visible:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddCollaborator}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
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
                className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-2 text-xs text-neutral-300 flex items-center justify-between"
              >
                <span className="font-mono text-[11px] text-neutral-200 truncate">{idDoc.value}</span>
                <span className="text-[10px] text-neutral-500 capitalize">{idDoc.kind}</span>
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
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 divide-y divide-neutral-900">
              {events.map((ev) => (
                <div key={ev.id} className="pt-1.5 text-[11px] text-neutral-400">
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
    </div>
  );
}
