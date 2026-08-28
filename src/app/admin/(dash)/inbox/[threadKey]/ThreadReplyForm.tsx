"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";

const MAX_REPLY_LENGTH = 100_000;

export default function ThreadReplyForm({ threadKey }: { threadKey: string }) {
  const router = useRouter();
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      router.refresh();
    } catch {
      setError("요청 상태를 확인할 수 없습니다. 중복 발송을 막기 위해 다시 보내지 마세요.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submitReply} className="border-t border-neutral-800 bg-neutral-900/75 p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="thread-reply" className="text-xs font-semibold text-neutral-200">Gmail 답장</label>
        <span className="text-[10px] text-neutral-500">받는 사람·제목은 대화 원문에서 결정됩니다</span>
      </div>
      <textarea
        id="thread-reply"
        value={bodyText}
        onChange={(event) => setBodyText(event.target.value)}
        maxLength={MAX_REPLY_LENGTH}
        required
        rows={4}
        disabled={sending}
        placeholder="답장 내용을 입력하세요"
        className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-3 text-sm leading-6 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={sending || !bodyText.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? "발송 확인 중…" : "답장 보내기"}
        </button>
      </div>
    </form>
  );
}
