"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const DashboardStepContext = createContext<{
  currentStep: number;
  setCurrentStep: (step: number) => void;
} | null>(null);

export function DashboardStepProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  return (
    <DashboardStepContext.Provider value={{ currentStep, setCurrentStep }}>
      {children}
    </DashboardStepContext.Provider>
  );
}

export function useDashboardStep() {
  const ctx = useContext(DashboardStepContext);
  if (!ctx) {
    throw new Error("useDashboardStep must be used within DashboardStepProvider");
  }
  return ctx;
}
