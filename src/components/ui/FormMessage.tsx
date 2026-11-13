// 폼 전체 결과 메시지(오류·전송 완료).
// - error: 연한 빨간 배경 + 경고 아이콘 + 문구 (필드별 오류는 Input이 표시)
// - success: 체크 아이콘 + 제목·본문
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Figma: Phase 4 · Local components › Form Message (289:606), Type = Sent | Error.
 * error:   no stroke (so it doesn't read as an input), error color at 6% background, radius 8,
 *          padding 12/16, 18px CircleAlert + MDK/Body in error color. Revised after Figma; Figma not yet updated.
 * success: off-white, radius 16, padding 28, 32px charcoal check icon, MDK/Title + MDK/Body.
 */
type FormMessageProps =
  | { type: "error"; children: ReactNode; className?: string }
  | { type: "success"; title: ReactNode; children?: ReactNode; className?: string };

export function FormMessage(props: FormMessageProps) {
  if (props.type === "error") {
    return (
      <div
        role="alert"
        className={cx(
          "font-mdk flex items-start gap-2.5 rounded-mdk-sm bg-mdk-error/6 px-4 py-3 text-mdk-body text-mdk-error",
          props.className,
        )}
      >
        {/* 18px icon centered on the 25px MDK/Body first line */}
        <CircleAlert aria-hidden="true" className="mt-[3.5px] size-[18px] shrink-0" strokeWidth={2} />
        <div className="min-w-0 flex-1 break-words">{props.children}</div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cx("font-mdk flex items-start gap-5 rounded-mdk-lg bg-mdk-off-white p-7", props.className)}
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mdk-charcoal"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2 4.9 8.5 9.5 3.6"
            stroke="currentColor"
            className="text-mdk-white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-mdk-title text-mdk-charcoal">{props.title}</p>
        {props.children ? <div className="text-mdk-body text-mdk-charcoal-muted">{props.children}</div> : null}
      </div>
    </div>
  );
}
