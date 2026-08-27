import type { CMBrief } from "@/lib/types";

export const LANDING_DASHBOARD_DRAFT_KEY = "medidakos:landing-dashboard-brief:v1";

export function createLandingDashboardBrief(): CMBrief {
  const now = new Date().toISOString();
  return { uid: "landing", currentStep: 1, requestType: "custom", status: "draft", createdAt: now, updatedAt: now };
}
export const createEmptyLandingDashboardDraft = createLandingDashboardBrief;

export interface LandingDraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function loadLandingDashboardDraft(storage: Pick<LandingDraftStorage, "getItem">): CMBrief { return parseLandingDashboardDraft(storage.getItem(LANDING_DASHBOARD_DRAFT_KEY)); }
export function saveLandingDashboardDraft(storage: Pick<LandingDraftStorage, "setItem">, draft: CMBrief): void { storage.setItem(LANDING_DASHBOARD_DRAFT_KEY, JSON.stringify(draft)); }
export function advanceLandingDashboardStep(draft: CMBrief): CMBrief { return { ...draft, currentStep: Math.min(6, draft.currentStep + 1) }; }

export function parseLandingDashboardDraft(value: string | null): CMBrief {
  if (!value) return createLandingDashboardBrief();
  try {
    const parsed = JSON.parse(value) as Partial<CMBrief>;
    if (!parsed || typeof parsed !== "object" || !Number.isInteger(parsed.currentStep)) return createLandingDashboardBrief();
    const currentStep = typeof parsed.currentStep === "number" ? parsed.currentStep : 1;
    return { ...createLandingDashboardBrief(), ...parsed, uid: "landing", currentStep: Math.min(6, Math.max(1, currentStep)), requestType: "custom", status: "draft" };
  } catch { return createLandingDashboardBrief(); }
}

export function landingBriefSnapshot(brief: CMBrief): CMBrief {
  if (!brief.step3) return { ...brief };
  const step3 = { ...brief.step3 };
  delete step3.logoDataUrl;
  return { ...brief, step3 };
}
export const landingDashboardSnapshot = landingBriefSnapshot;
