"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import type { Attachment } from "@/lib/schemas/message";
import MessageMediaGallery from "./MessageMediaGallery";
import {
  splitEmailQuotes,
  extractMediaFromText,
  isAttributionLine,
  type ExtractedMediaItem,
} from "@/lib/email-body";

export { splitEmailQuotes, extractMediaFromText, isAttributionLine };

interface MessageBodyCleanProps {
  bodyText: string;
  attachments?: Attachment[];
  messageId?: string;
  isGmail?: boolean;
  className?: string;
}

export default function MessageBodyClean({
  bodyText,
  attachments = [],
  messageId,
  isGmail = false,
  className = "",
}: MessageBodyCleanProps) {
  const [showQuotes, setShowQuotes] = useState(false);

  // 1. Separate quote boilerplate first
  const { clean: rawClean, quoted, quoteLineCount } = useMemo(
    () => splitEmailQuotes(bodyText),
    [bodyText],
  );

  // 2. Extract Google Drive & embedded image links from clean text
  const { cleanText, media } = useMemo(() => extractMediaFromText(rawClean), [rawClean]);

  // 3. Parse clean text lines to render inline blockquotes beautifully if any exist
  const textBlocks = useMemo(() => {
    if (!cleanText) return [];
    const paragraphs = cleanText.split("\n\n");
    return paragraphs.map((para) => {
      const trimmed = para.trim();
      const isQuoteBlock = trimmed.startsWith("> ") || trimmed.startsWith(">");
      return {
        isQuoteBlock,
        content: isQuoteBlock ? trimmed.replace(/^>\s?/gm, "") : para,
      };
    });
  }, [cleanText]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Clean Primary Message Text with Rich Inline Blockquote Styling */}
      {textBlocks.length > 0 ? (
        <div className="space-y-2 select-text">
          {textBlocks.map((block, bIdx) =>
            block.isQuoteBlock ? (
              <blockquote
                key={bIdx}
                className="rounded-r-lg border-l-2 border-neutral-600 bg-neutral-900/60 px-3 py-1.5 font-sans text-xs italic text-neutral-400 whitespace-pre-wrap break-words"
              >
                {block.content}
              </blockquote>
            ) : (
              <div
                key={bIdx}
                className="text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap font-sans break-words"
              >
                {block.content}
              </div>
            )
          )}
        </div>
      ) : !media.length && !attachments.length ? (
        <div className="text-xs italic text-neutral-500 py-1">
          {bodyText ? "(인용문 외 본문 없음)" : "(본문 내용이 비어있습니다)"}
        </div>
      ) : null}

      {/* Embedded Visual Image Gallery (Google Drive + Email Attachments) */}
      {(media.length > 0 || attachments.length > 0) && (
        <div className="pt-1">
          <MessageMediaGallery
            extractedMedia={media}
            attachments={attachments}
            messageId={messageId}
            isGmail={isGmail}
          />
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
