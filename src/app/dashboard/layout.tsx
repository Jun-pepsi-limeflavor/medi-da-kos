"use client";

import { DashboardGuard } from "@/components/dashboard/DashboardGuard";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardStepProvider, useDashboardStep } from "@/lib/dashboard-step-context";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { currentStep } = useDashboardStep();
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DashboardSidebar currentStep={currentStep} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">{children}</main>
    </div>
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
        <DashboardShell>{children}</DashboardShell>
      </DashboardStepProvider>
    </DashboardGuard>
  );
}
