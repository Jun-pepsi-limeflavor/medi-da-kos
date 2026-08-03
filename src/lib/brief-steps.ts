export const CM_BRIEF_STEPS = [
  { step: 1, label: "Category" },
  { step: 2, label: "Packaging" },
  { step: 3, label: "Branding" },
  { step: 4, label: "Quantity & Specs" },
  { step: 5, label: "Formula" },
  { step: 6, label: "Compliance" },
] as const;

export type CMBriefStep = (typeof CM_BRIEF_STEPS)[number]["step"];

export function isCMBriefStep(step: number): step is CMBriefStep {
  return Number.isInteger(step) && step >= 1 && step <= 6;
}

export function getBriefStepLabel(step: number): string {
  return CM_BRIEF_STEPS.find((entry) => entry.step === step)?.label ?? `Step ${step}`;
}

export function briefStepPage(step: number): string {
  return `dashboard/brief-step-${step}`;
}
