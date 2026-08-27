import type { CMBrief } from "@/lib/types";

export function normalizeBriefForStorage(brief: CMBrief): CMBrief {
  const normalized = structuredClone(brief);
  if (normalized.step4?.orderQuantityTbd) {
    delete normalized.step4.orderQuantity;
    delete normalized.step4.moq;
  }
  return normalized;
}
