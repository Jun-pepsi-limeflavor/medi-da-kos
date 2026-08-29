"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CMBrief } from "./types";
import { getBriefStepLabel } from "./brief-steps";
import { getNavigableSteps, stepHasContent } from "./brief-utils";
import { loadCMBrief, saveCMBrief } from "./firestore-service";
import { useDashboardStep } from "./dashboard-step-context";
import { trackBriefStep } from "./analytics";
import { syncBriefStepToChannelTalk } from "./channel-talk";
import { LANDING_DASHBOARD_DRAFT_KEY, parseLandingDashboardDraft } from "./landing/dashboard-draft";

function notifyBriefStepChange(step: number): void {
  const label = getBriefStepLabel(step);
  syncBriefStepToChannelTalk(step, label);
  trackBriefStep(step, label);
}

interface DashboardBriefContextValue {
  brief: CMBrief | null;
  loading: boolean;
  navigableSteps: number[];
  setBrief: React.Dispatch<React.SetStateAction<CMBrief | null>>;
  refreshBrief: () => Promise<void>;
  goToStep: (step: number) => Promise<void>;
  persistBrief: (next: CMBrief, advance?: boolean) => Promise<CMBrief>;
}

const DashboardBriefContext = createContext<DashboardBriefContextValue | null>(
  null,
);

export function DashboardBriefProvider({
  uid,
  children,
}: {
  uid: string;
  children: ReactNode;
}) {
  const [brief, setBrief] = useState<CMBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCurrentStep } = useDashboardStep();

  const refreshBrief = useCallback(async () => {
    setLoading(true);
    const data = await loadCMBrief(uid);
    setBrief(data);
    setCurrentStep(data.currentStep);
    setLoading(false);
    notifyBriefStepChange(data.currentStep);
  }, [uid, setCurrentStep]);

  useEffect(() => { void Promise.resolve().then(refreshBrief); }, [refreshBrief]);

  const navigableSteps = useMemo(
    () => (brief ? getNavigableSteps(brief) : []),
    [brief],
  );

  const goToStep = useCallback(
    async (step: number) => {
      if (!brief || !stepHasContent(brief, step)) return;
      const updated = { ...brief, currentStep: step };
      await saveCMBrief(updated);
      setBrief(updated);
      setCurrentStep(step);
      notifyBriefStepChange(step);
    },
    [brief, setCurrentStep],
  );

  const persistBrief = useCallback(
    async (next: CMBrief, advance = false) => {
      const updated = {
        ...next,
        status: "draft" as const,
        updatedAt: new Date().toISOString(),
        currentStep: advance
          ? Math.min(6, next.currentStep + 1)
          : next.currentStep,
      };
      await saveCMBrief(updated);
      setBrief(updated);
      setCurrentStep(updated.currentStep);
      notifyBriefStepChange(updated.currentStep);
      return updated;
    },
    [setCurrentStep],
  );

  const value = useMemo(
    () => ({
      brief,
      loading,
      navigableSteps,
      setBrief,
      refreshBrief,
      goToStep,
      persistBrief,
    }),
    [brief, loading, navigableSteps, refreshBrief, goToStep, persistBrief],
  );

  return (
    <DashboardBriefContext.Provider value={value}>
      {children}
    </DashboardBriefContext.Provider>
  );
}

/** Browser-only provider for the public landing. It deliberately satisfies the
 * same wizard contract without creating a guest Firebase identity or document.
 *
 * INTENTIONALLY DOES NOT FIRE notifyBriefStepChange (brief_step_changed GA4 event
 * and ChannelTalk sync) because the landing dashboard is consultation-only with no
 * ChannelTalk member profile. The landing dashboard fires separate brief_step_open
 * and brief_step_complete GA4 events instead, tracked by CMWizard. */
export function LandingDashboardBriefProvider({ children }: { children: ReactNode }) {
  const [brief, setBrief] = useState<CMBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCurrentStep } = useDashboardStep();
  const refreshBrief = useCallback(async () => {
    const next = parseLandingDashboardDraft(typeof window === "undefined" ? null : window.localStorage.getItem(LANDING_DASHBOARD_DRAFT_KEY));
    setBrief(next); setCurrentStep(next.currentStep); setLoading(false);
  }, [setCurrentStep]);
  useEffect(() => { void Promise.resolve().then(refreshBrief); }, [refreshBrief]);
  // The public wizard has no explicit save action. Mirror every field edit to
  // its local draft so a refresh cannot lose a partially completed step.
  useEffect(() => {
    if (!brief || typeof window === "undefined") return;
    window.localStorage.setItem(LANDING_DASHBOARD_DRAFT_KEY, JSON.stringify(brief));
  }, [brief]);
  const persistBrief = useCallback(async (next: CMBrief, advance = false) => {
    const updated = { ...next, uid: "landing", requestType: "custom" as const, status: "draft" as const, currentStep: advance ? Math.min(6, next.currentStep + 1) : next.currentStep, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(LANDING_DASHBOARD_DRAFT_KEY, JSON.stringify(updated));
    setBrief(updated); setCurrentStep(updated.currentStep); return updated;
  }, [setCurrentStep]);
  const goToStep = useCallback(async (step: number) => { if (!brief || !stepHasContent(brief, step)) return; await persistBrief({ ...brief, currentStep: step }); }, [brief, persistBrief]);
  const navigableSteps = useMemo(() => brief ? getNavigableSteps(brief) : [], [brief]);
  const value = useMemo(() => ({ brief, loading, navigableSteps, setBrief, refreshBrief, goToStep, persistBrief }), [brief, loading, navigableSteps, refreshBrief, goToStep, persistBrief]);
  return <DashboardBriefContext.Provider value={value}>{children}</DashboardBriefContext.Provider>;
}

export function useDashboardBrief() {
  const ctx = useContext(DashboardBriefContext);
  if (!ctx) {
    throw new Error(
      "useDashboardBrief must be used within DashboardBriefProvider",
    );
  }
  return ctx;
}
