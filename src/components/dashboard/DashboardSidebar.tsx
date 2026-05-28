"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Mail, Package, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboardBrief } from "@/lib/dashboard-brief-context";

const cmSteps = [
  { step: 1, label: "Category" },
  { step: 2, label: "Packaging" },
  { step: 3, label: "Branding" },
  { step: 4, label: "Quantity & Specs" },
  { step: 5, label: "Formula" },
  { step: 6, label: "Compliance" },
];

const links = [
  { href: "/dashboard/orders", label: "My Orders", icon: Package },
  { href: "/dashboard/tracking", label: "Tracking", icon: Truck },
];

export function DashboardSidebar({ currentStep = 1 }: { currentStep?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { navigableSteps, goToStep } = useDashboardBrief();

  async function handleStepClick(step: number) {
    if (!navigableSteps.includes(step)) return;
    await goToStep(step);
    if (pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sky-100/70 bg-white/80 backdrop-blur-sm">
      <div className="border-b border-sky-50 px-5 py-5">
        <Link href="/" className="text-lg font-serif font-semibold text-slate-800">
          Medi Da Kos
        </Link>
        <p className="mt-1 text-xs text-slate-500">Your Manufacturing Dashboard</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Link
          href="/dashboard"
          className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === "/dashboard"
              ? "bg-sky-100/70 text-sky-700"
              : "text-slate-600 hover:bg-sky-50/60"
          }`}
        >
          <LayoutDashboard size={18} />
          Product Brief
        </Link>

        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Brief Steps 1–6
        </p>
        <ul className="mb-6 space-y-1">
          {cmSteps.map((s) => {
            const canNavigate = navigableSteps.includes(s.step);
            return (
              <li key={s.step}>
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => handleStepClick(s.step)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition ${
                    currentStep === s.step
                      ? "bg-sky-500/85 text-white shadow-sm shadow-sky-100/80"
                      : canNavigate
                        ? "text-sky-700 hover:bg-sky-50/70"
                        : "cursor-not-allowed text-slate-400"
                  }`}
                  title={
                    canNavigate
                      ? `View step ${s.step}`
                      : "Complete and save this step first"
                  }
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      currentStep === s.step
                        ? "bg-white/20"
                        : canNavigate
                          ? "bg-sky-100/80"
                          : "bg-slate-100"
                    }`}
                  >
                    {s.step}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Orders
        </p>
        <ul className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    pathname === link.href
                      ? "bg-sky-100/70 text-sky-700"
                      : "text-slate-600 hover:bg-sky-50/60"
                  }`}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-sky-50 p-4">
        <a
          href="mailto:contact@medidakos.io"
          className="mb-3 flex items-center gap-2 text-xs text-slate-500 transition hover:text-sky-600"
        >
          <Mail size={14} />
          contact@medidakos.io
        </a>
        <button
          type="button"
          onClick={() => logout().then(() => (window.location.href = "/"))}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-sky-50/60"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
