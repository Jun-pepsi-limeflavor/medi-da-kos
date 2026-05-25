import type { ProductCategory } from "./types";

/** Preview container aspect (width ÷ height) — matches LogoPackagingPreview */
export const PREVIEW_ASPECT_WH = 2 / 3;

export interface LogoPlacementCalibration {
  logoWidth: number;
  logoHeight: number;
  topPercent: number;
  maxWidthPercent: number;
  maxHeightPercent: number;
}

/** Test case 1 — baseline for Skin Care tube mockup */
export const SKINCARE_LOGO_CALIBRATION: LogoPlacementCalibration = {
  logoWidth: 1603,
  logoHeight: 381,
  topPercent: 36,
  maxWidthPercent: 20,
  maxHeightPercent: 7,
};

/**
 * Lip tint mockup — calibrated with 1603×381 reference logo on clear body.
 * Tune leftPercent / topPercent / rotateDeg against step3_cosmetic.png.
 */
export const COSMETIC_TINT_CALIBRATION: LogoPlacementCalibration & {
  leftPercent: number;
  rotateDeg: number;
  /** Minimum drawn width on mockup (%) — keeps 700×541 readable */
  minDrawnWidthPercent: number;
  /** Cap for near-square logos (e.g. 225×225) — avoids 22% overflow */
  maxSquareDrawnWidthPercent: number;
} = {
  logoWidth: 1603,
  logoHeight: 381,
  leftPercent: 50,
  topPercent: 56,
  maxWidthPercent: 14,
  maxHeightPercent: 42,
  rotateDeg: 80,
  minDrawnWidthPercent: 13,
  maxSquareDrawnWidthPercent: 15,
};

export const COSMETIC_LOGO_CALIBRATION: LogoPlacementCalibration =
  COSMETIC_TINT_CALIBRATION;

export interface CosmeticTintPlacement {
  left: string;
  top: string;
  maxWidth: string;
  maxHeight: string;
  rotateDeg: number;
}

/**
 * Tint slot: tall box + reference logo 1603×381.
 * Aspect + absolute pixels + footprint so small uploads (e.g. 200×200) stay readable.
 */
export function computeCosmeticTintPlacement(
  calibration: typeof COSMETIC_TINT_CALIBRATION,
  logoWidth: number,
  logoHeight: number,
): { top: string; maxWidth: string; maxHeight: string } {
  const {
    topPercent,
    maxWidthPercent,
    maxHeightPercent,
    minDrawnWidthPercent,
    maxSquareDrawnWidthPercent,
    logoWidth: refW,
    logoHeight: refH,
  } = calibration;

  const refAspect = refW / refH;
  const aspect = logoWidth / logoHeight;
  const isNearSquare = aspect >= 0.82 && aspect <= 1.28;

  if (!Number.isFinite(aspect) || aspect <= 0) {
    return calibrationToCss(calibration);
  }

  if (Math.abs(logoWidth - refW) < 2 && Math.abs(logoHeight - refH) < 2) {
    return calibrationToCss(calibration);
  }

  const refFootprint = renderedLogoExtents(
    maxWidthPercent,
    maxHeightPercent,
    refAspect,
  );

  let targetWidthPercent = Math.max(
    refFootprint.widthPercent,
    minDrawnWidthPercent,
    maxWidthPercent,
  );
  if (isNearSquare) {
    targetWidthPercent = Math.min(
      targetWidthPercent,
      maxSquareDrawnWidthPercent,
    );
  }

  const ratio = aspect / refAspect;
  const damp = Math.pow(ratio, 0.35);

  let maxW = maxWidthPercent * damp;
  let maxH = maxHeightPercent / damp;

  const boxAspect = (maxW / maxH) * PREVIEW_ASPECT_WH;

  if (aspect > boxAspect) {
    const minHeightPercent = (maxW * PREVIEW_ASPECT_WH) / aspect;
    maxH = Math.max(maxH, minHeightPercent * 1.08);
  } else {
    const minWidthPercent = (maxH / PREVIEW_ASPECT_WH) * aspect;
    maxW = Math.max(maxW, minWidthPercent * 1.05);
  }

  const aspectDelta = Math.abs(Math.log(aspect) - Math.log(refAspect));
  const aspectSimilar = aspectDelta < 0.18;
  const linearScale = Math.sqrt((logoWidth / refW) * (logoHeight / refH));

  if (!aspectSimilar && linearScale < 1) {
    const pixelCap = isNearSquare ? 2.2 : 3;
    const pixelBoost = clamp(1 / linearScale, 1, pixelCap);
    maxW *= pixelBoost;
    maxH *= pixelBoost;
  }

  if (!aspectSimilar && aspect < refAspect) {
    const aspectCap = isNearSquare ? 1.15 : 1.65;
    const aspectBoost = clamp(Math.pow(refAspect / aspect, 0.3), 1, aspectCap);
    maxW *= aspectBoost;
    maxH *= aspectBoost;
  }

  const cur = renderedLogoExtents(maxW, maxH, aspect);
  const scaleW = targetWidthPercent / cur.widthPercent;
  const footprintScale = Math.max(scaleW, 1);
  maxW *= footprintScale;
  maxH *= footprintScale;

  const after = renderedLogoExtents(maxW, maxH, aspect);
  if (after.widthPercent < targetWidthPercent * 0.98) {
    const fix = targetWidthPercent / after.widthPercent;
    maxW *= fix;
    maxH *= fix;
  }

  const maxWCap = isNearSquare ? maxSquareDrawnWidthPercent : 22;
  maxW = clamp(maxW, minDrawnWidthPercent * 0.9, maxWCap);
  const maxHCap = Math.max(maxHeightPercent * 1.3, 48);
  maxH = clamp(maxH, maxHeightPercent * 0.85, maxHCap);

  return {
    top: `${topPercent}%`,
    maxWidth: `${maxW}%`,
    maxHeight: `${maxH}%`,
  };
}

export function getCosmeticTintPlacement(
  logoWidth?: number,
  logoHeight?: number,
): CosmeticTintPlacement {
  const zone = COSMETIC_TINT_CALIBRATION;
  const box =
    logoWidth && logoHeight && logoWidth > 0 && logoHeight > 0
      ? computeCosmeticTintPlacement(zone, logoWidth, logoHeight)
      : calibrationToCss(zone);

  return {
    left: `${zone.leftPercent}%`,
    top: box.top,
    maxWidth: box.maxWidth,
    maxHeight: box.maxHeight,
    rotateDeg: zone.rotateDeg,
  };
}

const CALIBRATION_BY_CATEGORY: Record<
  ProductCategory,
  LogoPlacementCalibration
> = {
  skincare: SKINCARE_LOGO_CALIBRATION,
  cosmetic: COSMETIC_LOGO_CALIBRATION,
};

function calibrationToCss(cal: LogoPlacementCalibration) {
  return {
    top: `${cal.topPercent}%`,
    maxWidth: `${cal.maxWidthPercent}%`,
    maxHeight: `${cal.maxHeightPercent}%`,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** How large the logo draws on the mockup (object-contain inside the placement box). */
export function renderedLogoExtents(
  maxWPercent: number,
  maxHPercent: number,
  logoAspect: number,
): { widthPercent: number; heightPercent: number } {
  if (!Number.isFinite(logoAspect) || logoAspect <= 0) {
    return { widthPercent: maxWPercent, heightPercent: maxHPercent };
  }

  const boxAspect = (maxWPercent / maxHPercent) * PREVIEW_ASPECT_WH;

  if (logoAspect >= boxAspect) {
    return {
      widthPercent: maxWPercent,
      heightPercent: (maxWPercent * PREVIEW_ASPECT_WH) / logoAspect,
    };
  }

  return {
    widthPercent: (maxHPercent / PREVIEW_ASPECT_WH) * logoAspect,
    heightPercent: maxHPercent,
  };
}

/** Match reference on-mockup footprint; only upscales when the logo would render smaller. */
function applyFootprintNormalization(
  maxW: number,
  maxH: number,
  logoAspect: number,
  refMaxW: number,
  refMaxH: number,
  refAspect: number,
): { maxW: number; maxH: number } {
  const ref = renderedLogoExtents(refMaxW, refMaxH, refAspect);
  const cur = renderedLogoExtents(maxW, maxH, logoAspect);

  const scaleW = ref.widthPercent / cur.widthPercent;
  const scaleH = ref.heightPercent / cur.heightPercent;
  const scale = Math.max(scaleW, scaleH, 1);

  if (scale <= 1.001) {
    return { maxW, maxH };
  }

  return { maxW: maxW * scale, maxH: maxH * scale };
}

/**
 * Scale placement box from absolute pixel dimensions vs calibration asset.
 * Uses the geometric mean of width/height ratios so a 200×200 file is not
 * treated only by aspect (which shrinks the box) — it still targets the
 * reference on-mockup size when the canvas is smaller than the calibration file.
 */
function applyAbsolutePixelScale(
  maxW: number,
  maxH: number,
  logoWidth: number,
  logoHeight: number,
  refW: number,
  refH: number,
  refAspect: number,
  logoAspect: number,
): { maxW: number; maxH: number } {
  if (refW <= 0 || refH <= 0) {
    return { maxW, maxH };
  }

  const widthRatio = logoWidth / refW;
  const heightRatio = logoHeight / refH;
  const linearScale = Math.sqrt(widthRatio * heightRatio);

  const aspectDelta = Math.abs(Math.log(logoAspect) - Math.log(refAspect));
  const aspectSimilar = aspectDelta < 0.18;

  // Same aspect as calibration: placement box already matches visual size
  if (aspectSimilar || linearScale >= 1) {
    return { maxW, maxH };
  }

  // Different aspect + smaller pixel canvas (e.g. 200×200 vs 1603×381)
  const boost = clamp(1 / linearScale, 1, 1.85);
  return { maxW: maxW * boost, maxH: maxH * boost };
}

/**
 * Scale maxWidth / maxHeight from a calibrated reference logo size.
 * 1) Aspect — box shape vs reference aspect
 * 2) Absolute pixels — canvas size vs calibration asset (sqrt of w×h ratios)
 * 3) Footprint — match reference drawn size on mockup (object-contain)
 */
export function computeLogoPlacementFromCalibration(
  calibration: LogoPlacementCalibration,
  logoWidth: number,
  logoHeight: number,
): { top: string; maxWidth: string; maxHeight: string } {
  const {
    topPercent,
    maxWidthPercent,
    maxHeightPercent,
    logoWidth: refW,
    logoHeight: refH,
  } = calibration;

  const refAspect = refW / refH;
  const aspect = logoWidth / logoHeight;

  if (!Number.isFinite(aspect) || aspect <= 0) {
    return {
      top: `${topPercent}%`,
      maxWidth: `${maxWidthPercent}%`,
      maxHeight: `${maxHeightPercent}%`,
    };
  }

  // Near-exact reference dimensions → use calibration values as-is
  if (
    Math.abs(logoWidth - refW) < 2 &&
    Math.abs(logoHeight - refH) < 2
  ) {
    return {
      top: `${topPercent}%`,
      maxWidth: `${maxWidthPercent}%`,
      maxHeight: `${maxHeightPercent}%`,
    };
  }

  const ratio = aspect / refAspect;
  const damp = Math.sqrt(ratio);

  let maxW = maxWidthPercent * damp;
  let maxH = maxHeightPercent / damp;

  const boxAspect = (maxW / maxH) * PREVIEW_ASPECT_WH;

  if (aspect > boxAspect) {
    // Wide logo: width-limited — min height (%) so object-contain has room
    const minHeightPercent = (maxW * PREVIEW_ASPECT_WH) / aspect;
    maxH = Math.max(maxH, minHeightPercent * 1.08);
  } else {
    // Tall logo: height-limited — widen box
    const minWidthPercent = (maxH / PREVIEW_ASPECT_WH) * aspect;
    maxW = Math.max(maxW, minWidthPercent * 1.05);
  }

  ({ maxW, maxH } = applyAbsolutePixelScale(
    maxW,
    maxH,
    logoWidth,
    logoHeight,
    refW,
    refH,
    refAspect,
    aspect,
  ));

  ({ maxW, maxH } = applyFootprintNormalization(
    maxW,
    maxH,
    aspect,
    maxWidthPercent,
    maxHeightPercent,
    refAspect,
  ));

  maxW = clamp(maxW, 6, 42);
  const maxHCap = Math.max(16, maxHeightPercent * 1.2);
  maxH = clamp(maxH, 4, maxHCap);

  return {
    top: `${topPercent}%`,
    maxWidth: `${maxW}%`,
    maxHeight: `${maxH}%`,
  };
}

export function getLogoPlacement(
  category: ProductCategory,
  logoWidth?: number,
  logoHeight?: number,
): { top: string; maxWidth: string; maxHeight: string } {
  const calibration = CALIBRATION_BY_CATEGORY[category];

  if (
    logoWidth &&
    logoHeight &&
    logoWidth > 0 &&
    logoHeight > 0
  ) {
    return computeLogoPlacementFromCalibration(
      calibration,
      logoWidth,
      logoHeight,
    );
  }

  return calibrationToCss(calibration);
}

export function loadImageDimensions(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
