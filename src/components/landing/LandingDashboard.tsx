"use client";

import { useState } from "react";
import { CMWizard } from "@/components/dashboard/CMWizard";
import { DashboardStepProvider } from "@/lib/dashboard-step-context";
import { LandingDashboardBriefProvider } from "@/lib/dashboard-brief-context";
import type { CMBrief } from "@/lib/types";
import { ConsultationForm } from "./ConsultationForm";

function DashboardContent() {
  const [ready, setReady] = useState<CMBrief | null>(null);
  if (ready) return <ConsultationForm variant="dashboard" dashboardBrief={ready} onBack={() => setReady(null)} />;
  return <CMWizard mode="consultation" onConsultationReady={(brief) => setReady(brief)} />;
}
export function LandingDashboard() { return <DashboardStepProvider><LandingDashboardBriefProvider><DashboardContent /></LandingDashboardBriefProvider></DashboardStepProvider>; }
