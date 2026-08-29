"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

interface MessageBodyCleanProps {
  bodyText: string;
  className?: string;
}

export function splitEmailQuotes(raw: string): { clean: string; quoted: string | null; quoteLineCount: number } {
  if (!raw) return { clean: "", quoted: null, quoteLineCount: 0 };

  const lines = raw.split("\n");
  const cleanLines: string[] = [];
  const quotedLines: string[] = [];
  let inQuote = false;

  const quoteStartRegex = /^(?:-{2,}\s*(?:전달된 메일|forwarded message|original message)\s*-{2,}|on\s+.+wrote:\s*$|20\d\d년\s+.+님이\s+작성:\s*$|-----original message-----|from:\s+.+@.+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inQuote) {
      if (trimmed.startsWith(">") || quoteStartRegex.test(trimmed)) {
        inQuote = true;
        quotedLines.push(line);
      } else {
        cleanLines.push(line);
      }
    } else {
      quotedLines.push(line);
    }
  }

  const clean = cleanLines.join("\n").trim();
  const quoted = quotedLines.join("\n").trim();

  // If the entire text was flagged as quote (e.g. buyer's reply was somehow formatted with >), display it in clean
  if (!clean && quoted) {
    return { clean: quoted, quoted: null, quoteLineCount: 0 };
  }

  return { clean, quoted: quoted.length > 0 ? quoted : null, quoteLineCount: quotedLines.length };
}

export default function MessageBodyClean({ bodyText, className = "" }: MessageBodyCleanProps) {
  const [showQuotes, setShowQuotes] = useState(false);

  const { clean, quoted, quoteLineCount } = useMemo(() => splitEmailQuotes(bodyText), [bodyText]);

  if (!bodyText) {
    return (
      <div className="text-xs italic text-neutral-500 py-1">
        (본문 내용이 비어있습니다)
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Clean Primary Message Text */}
      {clean ? (
        <div className="text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap font-sans break-words select-text">
          {clean}
        </div>
      ) : (
        <div className="text-xs italic text-neutral-500">
          (인용문 외 본문 없음)
        </div>
      )}

      {/* Foldable Quoted Content */}
      {quoted && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowQuotes(!showQuotes)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[10px] font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            <MessageSquare className="h-3 w-3 text-neutral-500" />
            <span>이전 인용 내용 {showQuotes ? "접기" : `보기 (${quoteLineCount}줄)`}</span>
            {showQuotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showQuotes && (
            <div className="mt-2 rounded-xl border-l-2 border-neutral-700 bg-neutral-950/60 p-3 text-[11px] leading-relaxed text-neutral-400 whitespace-pre-wrap font-mono break-words select-text max-h-[300px] overflow-y-auto animate-in fade-in duration-150">
              {quoted}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
