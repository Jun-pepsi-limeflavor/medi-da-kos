"use client";

import type { CosmeticTintPlacement } from "@/lib/logo-placement";

interface Props {
  logoDataUrl: string;
  placement: CosmeticTintPlacement;
}

/** Vertical logo on tilted lip-tint body (flat face, no cylinder warp). */
export function TintLogoOverlay({ logoDataUrl, placement }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.maxWidth,
        height: placement.maxHeight,
        transform: `rotate(${placement.rotateDeg}deg)`,
        transformOrigin: "center center",
      }}
      aria-hidden
    >
      <img
        src={logoDataUrl}
        alt=""
        className="max-h-full max-w-full object-contain object-center opacity-[0.92] mix-blend-multiply drop-shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
      />
    </div>
  );
}
