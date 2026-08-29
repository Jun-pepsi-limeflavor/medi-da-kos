"use client";

import { useState, useRef, useEffect } from "react";
import { Send, CornerDownLeft, X, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const MAX_REPLY_LENGTH = 100_000;

export default function ThreadReplyForm({ threadKey }: { threadKey: string }) {
  const router = useRouter();
  const [bodyText, setBodyText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  async function submitReply(event?: React.FormEvent) {
    if (event) event.preventDefault();
    const text = bodyText.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/threads/${encodeURIComponent(threadKey)}/reply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bodyText: text }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setError(payload?.error || "답장을 보낼 수 없습니다.");
        return;
      }
      setBodyText("");
      setIsExpanded(false);
      router.refresh();
    } catch {
      setError("요청 상태를 확인할 수 없습니다. 중복 발송을 막기 위해 다시 보내지 마세요.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitReply();
    }
    if (e.key === "Escape" && !bodyText.trim()) {
      setIsExpanded(false);
    }
  }

  if (!isExpanded && !bodyText.trim()) {
    return (
      <div className="border-t border-neutral-800/80 bg-neutral-950/90 p-3 backdrop-blur-md transition-all">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 px-4 py-2.5 text-xs text-neutral-400 hover:border-indigo-500/60 hover:bg-neutral-900 hover:text-neutral-200 transition-all shadow-sm group"
        >
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500 group-hover:scale-110 transition-transform" />
            <span>Gmail 답장 작성… (클릭하여 입력)</span>
          </span>
          <span className="flex items-center gap-1 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
            <CornerDownLeft className="h-3 w-3" /> 빠른 답장
          </span>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitReply}
      className="border-t border-neutral-800/80 bg-neutral-900/90 p-4 backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <label htmlFor="thread-reply" className="text-xs font-semibold text-neutral-100">
            Gmail 답장 발송
          </label>
        </div>
        <span className="text-[10px] text-neutral-500">
          In-Reply-To 유지 · 받는 사람·제목 원문 자동 연동
        </span>
      </div>

      <textarea
        ref={textareaRef}
        id="thread-reply"
        value={bodyText}
        onChange={(event) => setBodyText(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_REPLY_LENGTH}
        required
        rows={4}
        disabled={sending}
        placeholder="답장 내용을 입력하세요… (단축키: Cmd + Enter 로 즉시 발송)"
        className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-3 text-xs leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] text-neutral-500 hidden sm:inline">
          <kbd className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-neutral-300">Cmd + Enter</kbd> 발송 · <kbd className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[9px] text-neutral-300">Esc</kbd> 닫기
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => {
              if (!bodyText.trim() || confirm("작성 중인 답장 내용을 지우고 닫으시겠습니까?")) {
                setBodyText("");
                setIsExpanded(false);
              }
            }}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            접기
          </button>

          <button
            type="submit"
            disabled={sending || !bodyText.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-indigo-500 hover:shadow-[0_0_12px_rgba(99,102,241,0.4)] disabled:cursor-not-allowed disabled:opacity-50 min-h-[32px]"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "발송 중…" : "답장 보내기"}
          </button>
        </div>
      </div>
    </form>
  );
}
