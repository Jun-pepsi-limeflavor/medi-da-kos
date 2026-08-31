"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Paperclip,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Attachment } from "@/lib/schemas/message";
import type { ExtractedMediaItem } from "@/lib/email-body";

export type { ExtractedMediaItem };

interface MessageMediaGalleryProps {
  extractedMedia?: ExtractedMediaItem[];
  attachments?: Attachment[];
  messageId?: string;
  isGmail?: boolean;
  className?: string;
}

export default function MessageMediaGallery({
  extractedMedia = [],
  attachments = [],
  messageId,
  isGmail = false,
  className = "",
}: MessageMediaGalleryProps) {
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // 1. Collect all visual images from both extracted text media & direct MIME attachments
  const allImages: ExtractedMediaItem[] = [...extractedMedia];

  const imageExtRegex = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
  const nonImageAttachments: Attachment[] = [];

  for (const att of attachments) {
    const isImg = att.mimeType.startsWith("image/") || imageExtRegex.test(att.filename);
    if (isImg && messageId && isGmail) {
      const endpoint = `/api/admin/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(att.attachmentId)}`;
      allImages.push({
        type: "attachment",
        id: att.attachmentId,
        name: att.filename,
        url: endpoint,
        thumbnailUrl: endpoint,
        previewUrl: endpoint,
        size: att.size,
      });
    } else {
      nonImageAttachments.push(att);
    }
  }

  if (allImages.length === 0 && nonImageAttachments.length === 0) {
    return null;
  }

  const activeLightboxItem = activeLightboxIndex !== null ? allImages[activeLightboxIndex] : null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Visual Images Gallery Grid */}
      {allImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-300">
            <ImageIcon className="h-3.5 w-3.5 text-indigo-400" />
            <span>첨부 및 공유 이미지 ({allImages.length}개)</span>
          </div>

          <div
            className={`grid gap-2.5 ${
              allImages.length === 1
                ? "grid-cols-1 max-w-md"
                : allImages.length === 2
                  ? "grid-cols-2 max-w-lg"
                  : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {allImages.map((img, idx) => {
              const hasFailed = failedImages[img.id];

              return (
                <div
                  key={`${img.type}-${img.id}-${idx}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/80 transition-all hover:border-neutral-700 hover:shadow-lg"
                >
                  {/* Image Display Area */}
                  <div
                    onClick={() => setActiveLightboxIndex(idx)}
                    className="relative flex h-36 w-full cursor-pointer items-center justify-center bg-neutral-900/90 overflow-hidden"
                  >
                    {!hasFailed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.thumbnailUrl}
                        alt={img.name}
                        loading="lazy"
                        onError={() => setFailedImages((prev) => ({ ...prev, [img.id]: true }))}
                        className="h-full w-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-3 text-center text-neutral-500">
                        <FileText className="mb-1.5 h-7 w-7 text-neutral-600" />
                        <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[140px]">
                          {img.name}
                        </span>
                        <span className="text-[9px] text-neutral-500 mt-0.5">
                          {img.type === "gdrive" ? "Google Drive 미리보기" : "미리보기 불가"}
                        </span>
                      </div>
                    )}

                    {/* Hover Zoom Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-900/90 px-2.5 py-1 text-[10px] font-medium text-white shadow">
                        <Maximize2 className="h-3 w-3" /> 크게 보기
                      </span>
                    </div>
                  </div>

                  {/* Caption & Actions */}
                  <div className="flex items-center justify-between gap-1.5 border-t border-neutral-800/80 bg-neutral-900/80 px-2.5 py-1.5 text-[10px]">
                    <span className="truncate font-mono text-neutral-300 font-medium" title={img.name}>
                      {img.name}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {img.type === "gdrive" ? (
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-indigo-400 hover:bg-indigo-950 hover:text-indigo-300 transition-colors"
                          title="Google Drive에서 열기"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span>드라이브</span>
                        </a>
                      ) : (
                        <a
                          href={img.url}
                          download={img.name}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-indigo-400 hover:bg-indigo-950 hover:text-indigo-300 transition-colors"
                          title="다운로드"
                        >
                          <Download className="h-2.5 w-2.5" />
                          <span>다운로드</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-Image Attachments List */}
      {nonImageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {nonImageAttachments.map((att, attIdx) => {
            const label = (
              <>
                <Paperclip className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <span className="max-w-[200px] truncate font-medium">{att.filename}</span>
                <span className="text-neutral-500 text-[10px] shrink-0 font-mono">
                  ({Math.max(1, Math.round(att.size / 1024))} KB)
                </span>
              </>
            );

            return messageId && isGmail ? (
              <a
                key={att.attachmentId || attIdx}
                href={`/api/admin/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(att.attachmentId)}`}
                download={att.filename}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800/90 px-3 py-1.5 text-[11px] text-neutral-200 border border-neutral-700/60 hover:bg-neutral-700 hover:text-white transition-colors"
              >
                {label}
              </a>
            ) : (
              <span
                key={att.attachmentId || attIdx}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800/90 px-3 py-1.5 text-[11px] text-neutral-200 border border-neutral-700/60"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-150"
        >
          {/* Lightbox Header */}
          <div className="flex w-full max-w-5xl items-center justify-between border-b border-neutral-800 pb-3 text-neutral-200">
            <div className="flex items-center gap-2 truncate">
              <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-400">
                {(activeLightboxIndex ?? 0) + 1} / {allImages.length}
              </span>
              <h3 className="font-mono text-sm font-semibold truncate text-white">
                {activeLightboxItem.name}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {activeLightboxItem.type === "gdrive" ? (
                <a
                  href={activeLightboxItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Google Drive 원본 열기
                </a>
              ) : (
                <a
                  href={activeLightboxItem.url}
                  download={activeLightboxItem.name}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  다운로드
                </a>
              )}

              <button
                type="button"
                onClick={() => setActiveLightboxIndex(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image View */}
          <div className="relative flex h-full max-h-[78vh] w-full max-w-5xl items-center justify-center p-2">
            {allImages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActiveLightboxIndex(
                    (activeLightboxIndex! - 1 + allImages.length) % allImages.length
                  )
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-neutral-900/80 p-2 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all shadow-lg"
                aria-label="이전 이미지"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightboxItem.previewUrl || activeLightboxItem.thumbnailUrl}
              alt={activeLightboxItem.name}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />

            {allImages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActiveLightboxIndex((activeLightboxIndex! + 1) % allImages.length)
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-neutral-900/80 p-2 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all shadow-lg"
                aria-label="다음 이미지"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Lightbox Footer */}
          <div className="text-center text-xs text-neutral-500 pb-2">
            단축키: <kbd className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[10px] text-neutral-300">Esc</kbd> 로 닫기
          </div>
        </div>
      )}
    </div>
  );
}
