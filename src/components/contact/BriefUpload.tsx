"use client";

// Contact 'Have a brief? (optional)' 첨부 영역 — 파일 선택 UI. 업로드는 InquiryForm이 문의 저장 후
// storage-service로 하고, 파일별 상태(status)를 내려 준다(2026-11-17, 이후 Functions가 Google Drive로 옮김)
// - 행 상태 표기: 선택만 함 'Selected' → 'Uploading NN%' → 'Uploaded' / 'Upload failed'
// - locked(제출 중): Remove 버튼과 추가 영역을 숨긴다
// - 드래그 앤 드롭 또는 클릭(키보드: 영역에 포커스 후 Enter·Space)으로 파일 선택, 파일별 Remove 텍스트 버튼(아이콘 없음)
// - 허용 형식·파일당 50 MB·최대 3개·중복 검증(inquiry-validation). 문제 있는 파일은 건너뛰고 첫 오류 문구를 영역 안에 표시
// - 상태: Empty → Drag over(차콜 점선) → 선택된 파일 목록 / Error(빨간 점선 + 오류 문구). 3개가 차면 영역을 숨긴다
import Image from "next/image";
import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import {
  BRIEF_FILE_ACCEPT,
  BRIEF_FILE_RULES,
  addBriefFiles,
  formatFileSize,
} from "@/components/contact/inquiry-validation";
import { cx } from "@/lib/utils/cx";

/** Upload state of one selected file (undefined = selected, not submitted yet). */
export type BriefFileStatus = { state: "uploading"; progress: number } | { state: "uploaded" } | { state: "failed" };

function statusText(status: BriefFileStatus | undefined): string {
  if (!status) return "Selected";
  if (status.state === "uploading") return `Uploading ${Math.round(status.progress * 100)}%`;
  return status.state === "uploaded" ? "Uploaded" : "Upload failed";
}

export function BriefUpload({
  files,
  onChange,
  status = [],
  locked = false,
}: {
  files: readonly File[];
  onChange: (files: File[]) => void;
  /** Per file, same order as `files`. */
  status?: readonly (BriefFileStatus | undefined)[];
  /** While submitting: no adding or removing. */
  locked?: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = locked || files.length >= BRIEF_FILE_RULES.maxFiles;

  const add = (incoming: File[]) => {
    const result = addBriefFiles(files, incoming);
    setError(result.error);
    onChange(result.files);
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    add(Array.from(event.target.files ?? []));
    event.target.value = ""; // allow picking the same file again after removing it
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    add(Array.from(event.dataTransfer.files));
  };

  const remove = (file: File) => {
    setError(null);
    onChange(files.filter((f) => f !== file));
  };

  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Selected files">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-3.5 rounded-mdk-md border border-mdk-light-gray bg-mdk-white p-4 sm:p-5"
            >
              <span className="shrink-0 rounded-mdk-sm bg-mdk-off-white p-2.5">
                <Image src="/icons/file.svg" alt="" width={20} height={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-mdk-label text-mdk-charcoal">{file.name}</span>
                <span
                  className={cx(
                    "text-mdk-caption",
                    status[i]?.state === "failed" ? "text-mdk-error" : "text-mdk-charcoal-muted",
                  )}
                >
                  {formatFileSize(file.size)} · {statusText(status[i])}
                </span>
              </span>
              {locked ? null : (
                <button
                  type="button"
                  onClick={() => remove(file)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 cursor-pointer rounded-mdk-sm p-2 text-mdk-caption text-mdk-charcoal-muted hover:text-mdk-charcoal hover:underline focus-visible:outline-2 focus-visible:outline-mdk-charcoal"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {full ? null : (
        <label
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
          }}
          onDrop={onDrop}
          className={cx(
            "flex cursor-pointer flex-col items-center gap-3 rounded-mdk-md border border-dashed px-5 py-9 text-center sm:px-8",
            "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-mdk-charcoal",
            dragOver
              ? "border-[1.5px] border-mdk-charcoal bg-mdk-white"
              : error
                ? "border-mdk-error bg-mdk-off-white"
                : "border-mdk-mid-gray bg-mdk-off-white",
          )}
        >
          <input
            id={inputId}
            type="file"
            multiple
            accept={BRIEF_FILE_ACCEPT}
            onChange={onInput}
            aria-describedby={hintId}
            className="sr-only"
          />
          <span className="rounded-full border border-mdk-light-gray bg-mdk-white p-3">
            <Image src="/icons/upload.svg" alt="" width={20} height={20} />
          </span>
          <span className="text-mdk-label text-mdk-charcoal">
            {dragOver ? "Drop your file to upload" : "Drag & drop or click to upload"}
          </span>
          <span
            id={hintId}
            role={error ? "alert" : undefined}
            className={cx("text-mdk-caption", error ? "text-mdk-error" : "text-mdk-charcoal-muted")}
          >
            {error ?? "PDF, DOCX, XLSX, PPTX, JPG, PNG · Max 3 files · 50 MB each"}
          </span>
        </label>
      )}
      {full && error ? (
        <p role="alert" className="text-mdk-caption text-mdk-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
