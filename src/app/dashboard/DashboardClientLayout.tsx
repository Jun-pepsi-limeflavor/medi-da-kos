"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { DashboardGuard } from "@/components/dashboard/DashboardGuard";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardStepProvider, useDashboardStep } from "@/lib/dashboard-step-context";
import { DashboardBriefProvider } from "@/lib/dashboard-brief-context";
import { useAuth } from "@/lib/auth-context";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { currentStep } = useDashboardStep();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Covers <Link> navigation (My Orders, Tracking). A step click while already
  // on /dashboard does not change the path, so the sidebar closes itself there.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    const mq = window.matchMedia("(min-width: 1024px)");
    function onWide(e: MediaQueryListEvent) {
      if (e.matches) setSidebarOpen(false);
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-sky-50/60 via-white to-sky-100/30">
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      <DashboardSidebar
        currentStep={currentStep}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* min-w-0 lets this column shrink below its content width — without it
          wide tables and grids force page-level horizontal scroll. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-sky-100/70 bg-white/90 px-4 backdrop-blur-sm lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open dashboard menu"
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition hover:bg-sky-50/60"
          >
            <Menu size={22} />
          </button>
          <span className="font-serif text-base font-semibold text-slate-800">
            Medi Da Kos
          </span>
        </div>
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">{children}</main>
      </div>
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

export default function DashboardClientLayout({
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
