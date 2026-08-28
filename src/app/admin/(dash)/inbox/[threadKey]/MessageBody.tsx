"use client";

import { useState } from "react";
import { splitEmailBody } from "@/lib/email-body";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";

interface MessageBodyProps {
  text: string;
  className?: string;
}

export default function MessageBody({ text, className = "" }: MessageBodyProps) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { cleanText, quotedText } = splitEmailBody(text);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. 순수 새 본문 */}
      <p className="whitespace-pre-wrap break-words">{cleanText || "(내용 없음)"}</p>

      {/* 2. 이전 답장 인용구 토글 (있는 경우에만 노출) */}
      {quotedText && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowQuoted(!showQuoted)}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-950/60 px-2 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200"
            title={showQuoted ? "인용된 이전 대화 숨기기" : "인용된 이전 대화 보기"}
          >
            <MoreHorizontal className="h-3 w-3 text-neutral-500" />
            <span>{showQuoted ? "이전 인용 대화 접기" : "이전 인용 대화 보기"}</span>
            {showQuoted ? (
              <ChevronUp className="h-3 w-3 text-neutral-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-neutral-500" />
            )}
          </button>

          {/* 펼쳐진 인용구 블록 */}
          {showQuoted && (
            <div className="mt-2.5 rounded-lg border-l-2 border-neutral-700/80 bg-neutral-950/40 p-3 text-xs leading-relaxed text-neutral-400 animate-in fade-in duration-150">
              <p className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {quotedText}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
