"use client";

import { CMWizard } from "@/components/dashboard/CMWizard";
import { useAuth } from "@/lib/auth-context";
import { useDashboardStep } from "@/lib/dashboard-step-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const { setCurrentStep } = useDashboardStep();

  if (!user) return null;

  return <CMWizard uid={user.uid} onStepChange={setCurrentStep} />;
}
