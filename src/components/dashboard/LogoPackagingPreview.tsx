"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ProductCategory } from "@/lib/types";
import { TintLogoOverlay } from "./TintLogoOverlay";
import {
  getCosmeticTintPlacement,
  getLogoPlacement,
  loadImageDimensions,
} from "@/lib/logo-placement";

const MOCKUPS: Record<ProductCategory, string> = {
  skincare: "/step3_skincare.png",
  cosmetic: "/step3_cosmetic2.png",
};

interface Props {
  category: ProductCategory;
  logoDataUrl?: string;
}

export function LogoPackagingPreview({ category, logoDataUrl }: Props) {
  const mockup = MOCKUPS[category];
  const [logoSize, setLogoSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!logoDataUrl) {
      setLogoSize(null);
      return;
    }
    let cancelled = false;
    loadImageDimensions(logoDataUrl)
      .then((dims) => {
        if (!cancelled) setLogoSize(dims);
      })
      .catch(() => {
        if (!cancelled) setLogoSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [logoDataUrl]);

  const isCosmetic = category === "cosmetic";
  const tintPlace = getCosmeticTintPlacement(
    logoSize?.width,
    logoSize?.height,
  );
  const place = getLogoPlacement(
    category,
    logoSize?.width,
    logoSize?.height,
  );

  return (
    <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl bg-[#f5f5f4] shadow-inner">
      <Image
        src={mockup}
        alt={`${category} packaging mockup`}
        fill
        unoptimized
        className="object-contain object-center"
        sizes="(max-width: 768px) 100vw, 400px"
        priority
      />
      {logoDataUrl && isCosmetic && (
        <TintLogoOverlay logoDataUrl={logoDataUrl} placement={tintPlace} />
      )}
      {logoDataUrl && !isCosmetic && (
        <div
          className="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-center"
          style={{
            top: place.top,
            width: place.maxWidth,
            height: place.maxHeight,
          }}
          aria-hidden
        >
          <img
            src={logoDataUrl}
            alt=""
            className="max-h-full max-w-full object-contain object-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
          />
        </div>
      )}
      {!logoDataUrl && (
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-slate-400">
          Upload a logo to preview on packaging
        </p>
      )}
    </div>
  );
}
