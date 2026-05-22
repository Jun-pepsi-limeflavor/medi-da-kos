import type { CMBrief } from "./types";

export function stepHasContent(brief: CMBrief, step: number): boolean {
  switch (step) {
    case 1:
      return Boolean(brief.step1?.category);
    case 2:
      return (brief.step2?.selections?.length ?? 0) > 0;
    case 3:
      return Boolean(
        brief.step3?.logoDataUrl ||
          brief.step3?.logoFileName ||
          brief.step3?.previewGroup,
      );
    case 4:
      return Boolean(
        brief.step4?.volume ||
          brief.step4?.moq ||
          brief.step4?.shippingCountry,
      );
    case 5:
      return Boolean(brief.step5?.viscosity || brief.step5?.fragrance);
    case 6:
      return Boolean(
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
