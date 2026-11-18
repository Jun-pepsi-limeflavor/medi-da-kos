"use client";

// <dialog> 기반 공통 모달 틀(Cookie Settings · SNS Post Modal · Promotion Popup이 사용).
// - showModal(): 최상위 레이어 + 배경 inert. 처음 포커스는 모달 자체(첫 버튼에 자동 포커스 링이 생기지 않게, Tab으로 X부터 이동 —
//   data-autofocus 요소가 있으면 그곳). 위에 열린 모달만 ESC를 받는다(여러 모달이 함께 닫히지 않음)
// - 배경(scrim, 차콜 80%) 클릭·ESC로 닫기 — 실제 닫기는 호출한 쪽 state로 결정(onClose)
// - 열려 있는 동안 배경 스크롤 잠금(겹쳐 열려도 마지막 모달이 닫힐 때 해제). 클래식 스크롤바 자리는 scrollbar-gutter(미지원 시
//   같은 폭 padding)로 유지해 배경 페이지·모달이 좌우로 움직이지 않음. 닫으면 열기 전 포커스 위치로 복귀(스크롤 이동 없음)
//   비워 둔 스크롤바 자리는 ::backdrop이 덮지 못해 페이지 배경(밝은색)이 세로 띠로 남으므로, 잠금 동안 <html> 배경을
//   scrim을 겹친 색(차콜 80% + 페이지 배경)으로 바꿔 그 자리도 같은 어둡기로 보이게 한다(2026-11-11)
// - 패널 크기·색상·닫기 버튼은 사용하는 쪽에서 지정. 화면 가장자리 여백 16px, 화면보다 크면 패널 안에서 처리
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Shared modal shell for the Figma overlays (SNS Post Modal, Promotion Popup, Cookie Settings Modal).
 * Figma: centered panel over a charcoal 80% scrim; closes on X, scrim click and ESC.
 * Panel size, radius, colors and the close button differ per overlay, so they are passed in by the caller.
 */
type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** id of the visible title element. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
};

/** Open modals currently holding the page scroll lock. */
let scrollLocks = 0;
let saved: { overflow: string; gutter: string; paddingRight: string; background: string } | null = null;

/** The scrim (charcoal 80%) over the page background — the reserved scrollbar space is painted with this. */
const SCRIM_OVER_PAGE = "color-mix(in srgb, var(--color-mdk-charcoal) 80%, var(--background))";

/**
 * Lock page scroll without moving the page sideways: hiding a classic (space-taking) scrollbar would widen the
 * viewport and shift centred content and the modal itself. Keep its space with scrollbar-gutter: stable, or pad the
 * same width where that is unsupported. Overlay scrollbars take no space, so nothing changes there.
 */
function lockScroll() {
  if (scrollLocks++ > 0) return;
  const root = document.documentElement;
  const scrollbar = window.innerWidth - root.clientWidth;
  saved = {
    overflow: root.style.overflow,
    gutter: root.style.scrollbarGutter,
    paddingRight: root.style.paddingRight,
    background: root.style.background,
  };
  if (scrollbar > 0) {
    // The body keeps painting its own background, so only the reserved strip shows this colour.
    root.style.background = SCRIM_OVER_PAGE;
    if (CSS.supports("scrollbar-gutter", "stable")) root.style.scrollbarGutter = "stable";
    else root.style.paddingRight = `${scrollbar}px`;
  }
  root.style.overflow = "hidden";
}

function unlockScroll() {
  if (--scrollLocks > 0 || !saved) return;
  const root = document.documentElement;
  root.style.overflow = saved.overflow;
  root.style.scrollbarGutter = saved.gutter;
  root.style.paddingRight = saved.paddingRight;
  root.style.background = saved.background;
  saved = null;
}

export function Modal({ open, onClose, labelledBy, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();
    if (!dialog.open) dialog.showModal();
    // Focus the dialog itself (announced by its title) rather than its first button: a programmatic focus on the X
    // shows a focus ring before the visitor has done anything. Tab then reaches the X with :focus-visible.
    // An explicit [data-autofocus] target still wins (React's autoFocus runs before the dialog is shown).
    (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog).focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      unlockScroll();
      // Back to the element that opened it (e.g. the post card), without scrolling the page.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        // ESC: keep React state as the source of truth.
        event.preventDefault();
        onCloseRef.current();
      }}
      onClick={(event) => {
        // A click whose target is the <dialog> itself landed on the scrim (::backdrop).
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      className={cx(
        "font-mdk m-auto max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] overflow-hidden bg-transparent p-0 outline-none",
        "backdrop:bg-mdk-charcoal/80",
        className,
      )}
    >
      {open ? children : null}
    </dialog>
  );
}
