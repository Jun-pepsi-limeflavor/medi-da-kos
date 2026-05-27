"use client";

import { DashboardGuard } from "@/components/dashboard/DashboardGuard";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardStepProvider, useDashboardStep } from "@/lib/dashboard-step-context";
import { DashboardBriefProvider } from "@/lib/dashboard-brief-context";
import { useAuth } from "@/lib/auth-context";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { currentStep } = useDashboardStep();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-sky-50/60 via-white to-sky-100/30">
      <DashboardSidebar currentStep={currentStep} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">{children}</main>
    </div>
  );
}

function DashboardBriefWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <DashboardBriefProvider uid={user.uid}>
      <DashboardShell>{children}</DashboardShell>
    </DashboardBriefProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGuard>
      <DashboardStepProvider>
        <DashboardBriefWrapper>{children}</DashboardBriefWrapper>
      </DashboardStepProvider>
    </DashboardGuard>
  );
}
