"use client";

import type { CosmeticLogoSlotPlacement } from "@/lib/logo-placement";

interface Props {
  logoDataUrl: string;
  slot: CosmeticLogoSlotPlacement;
}

/**
 * Front-facing cylinder illusion: perspective + horizontal pinch + soft edge mask.
 */
export function CylindricalLogoOverlay({ logoDataUrl, slot }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{
        left: slot.left,
        top: slot.top,
        width: slot.maxWidth,
        height: slot.maxHeight,
        perspective: "520px",
        perspectiveOrigin: "50% 50%",
      }}
      aria-hidden
    >
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          transform: `rotateY(${slot.rotateYDeg}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="logo-cylinder-mask flex h-full w-full items-center justify-center"
          style={{
            transform: `scaleX(${slot.cylinderScaleX})`,
          }}
        >
          <img
            src={logoDataUrl}
            alt=""
            className="max-h-full max-w-full object-contain object-center opacity-[0.94] mix-blend-multiply drop-shadow-[0_1px_3px_rgba(0,0,0,0.14)]"
          />
        </div>
      </div>
    </div>
  );
}
