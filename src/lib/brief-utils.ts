import type { CMBrief } from "./types";
import { getStep1Selection } from "./step1-utils";
import { getOrderQuantity } from "./quantity-utils";

export function stepHasContent(brief: CMBrief, step: number): boolean {
  switch (step) {
    case 1:
      return Boolean(getStep1Selection(brief.step1));
    case 2:
      return (brief.step2?.selections?.length ?? 0) > 0;
    case 3:
      return Boolean(brief.step3?.logoDataUrl || brief.step3?.logoFileName);
    case 4:
      return Boolean(
        brief.step4?.volume ||
          getOrderQuantity(brief.step4) ||
          brief.step4?.orderQuantityTbd ||
          brief.step4?.shippingCountry,
      );
    case 5:
      return Boolean(
        brief.step5?.viscosity?.trim() ||
          brief.step5?.fragranceNotes?.trim() ||
          brief.step5?.unscented ||
          brief.step5?.fragranceFree,
      );
    case 6:
      return Boolean(
        brief.step6?.productName ||
          brief.step6?.conceptIngredients ||
          brief.step6?.internationalCertifications?.length ||
          brief.step6?.vegan,
      );
    default:
      return false;
  }
}

export function getNavigableSteps(brief: CMBrief): number[] {
  return [1, 2, 3, 4, 5, 6].filter((s) => stepHasContent(brief, s));
}
