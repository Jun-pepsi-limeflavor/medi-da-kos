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
import { usePathname } from "next/navigation";
import type { CMBrief } from "./types";
import { getNavigableSteps, stepHasContent } from "./brief-utils";
import { loadCMBrief, saveCMBrief } from "./firestore-service";
import { useDashboardStep } from "./dashboard-step-context";
import { useBriefStepDwellSync } from "@/hooks/use-brief-step-dwell-sync";

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
  const pathname = usePathname();
  const { setCurrentStep } = useDashboardStep();

  const refreshBrief = useCallback(async () => {
    setLoading(true);
    const data = await loadCMBrief(uid);
    setBrief(data);
    setCurrentStep(data.currentStep);
    setLoading(false);
  }, [uid, setCurrentStep]);

  useEffect(() => {
    refreshBrief();
  }, [refreshBrief]);

  useBriefStepDwellSync(
    brief?.currentStep ?? null,
    pathname === "/dashboard" && !loading && brief !== null,
  );

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

export function useDashboardBrief() {
  const ctx = useContext(DashboardBriefContext);
  if (!ctx) {
    throw new Error(
      "useDashboardBrief must be used within DashboardBriefProvider",
    );
  }
  return ctx;
}
