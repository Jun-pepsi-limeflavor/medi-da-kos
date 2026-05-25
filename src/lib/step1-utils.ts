import type { CMBriefStep1, ProductCategory, Step1Selection } from "./types";

export function normalizeStep1(
  step1?: CMBriefStep1 | { category?: ProductCategory },
): CMBriefStep1 | undefined {
  if (!step1) return undefined;
  if ("selection" in step1 && step1.selection) return step1 as CMBriefStep1;
  const legacy = step1 as { category?: ProductCategory };
  if (legacy.category) {
    return { selection: legacy.category };
  }
  return undefined;
}

export function getStep1Selection(step1?: CMBriefStep1): Step1Selection | undefined {
  return normalizeStep1(step1)?.selection;
}

export function isOdmSelection(
  s: Step1Selection | undefined,
): s is ProductCategory {
  return s === "skincare" || s === "cosmetic";
}

export function odmCategory(
  step1?: CMBriefStep1,
): ProductCategory | undefined {
  const s = getStep1Selection(step1);
  return isOdmSelection(s) ? s : undefined;
}
