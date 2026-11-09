"use client";

// <dialog> 기반 공통 모달 틀.
// - 배경 클릭·ESC로 닫기, 열려 있는 동안 배경 스크롤 잠금
// - 패널 크기·색상·닫기 버튼은 사용하는 쪽에서 지정
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/utils/cx";

/**
 * Shared modal shell for the Figma overlays (SNS Post Modal, Promotion Popup, Cookie Settings Modal).
 * Figma: centered panel over a charcoal 80% scrim; closes on X, scrim click and ESC.
 * Built on <dialog>.showModal(): top layer, inert background, ESC, focus moved in and restored on close.
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

export function Modal({ open, onClose, labelledBy, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Background scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
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
        "font-mdk m-auto max-h-[calc(100dvh-48px)] max-w-[calc(100vw-48px)] overflow-hidden p-0",
        "backdrop:bg-mdk-charcoal/80",
        className,
      )}
    >
      {children}
    </dialog>
  );
}
