"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Mail, Package, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const cmSteps = [
  { step: 1, label: "Category" },
  { step: 2, label: "Packaging" },
  { step: 3, label: "Branding" },
  { step: 4, label: "Specs & MOQ" },
  { step: 5, label: "Formula" },
  { step: 6, label: "Compliance" },
];

const links = [
  { href: "/dashboard/orders", label: "My Orders", icon: Package },
  { href: "/dashboard/tracking", label: "Tracking", icon: Truck },
];

export function DashboardSidebar({ currentStep = 1 }: { currentStep?: number }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sky-100 bg-white">
      <div className="border-b border-sky-50 px-5 py-5">
        <Link href="/" className="text-lg font-semibold text-slate-800">
          Medi Da Kos
        </Link>
        <p className="mt-1 text-xs text-slate-500">Custom ODM Dashboard</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Link
          href="/dashboard"
          className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === "/dashboard"
              ? "bg-sky-50 text-sky-700"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <LayoutDashboard size={18} />
          CM Brief
        </Link>

        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          CM Steps 1–6
        </p>
        <ul className="mb-6 space-y-1">
          {cmSteps.map((s) => (
            <li key={s.step}>
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  currentStep === s.step
                    ? "bg-sky-600 text-white"
                    : currentStep > s.step
                      ? "text-sky-600"
                      : "text-slate-500"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep === s.step
                      ? "bg-white/20"
                      : currentStep > s.step
                        ? "bg-sky-100"
                        : "bg-slate-100"
                  }`}
                >
                  {s.step}
                </span>
                {s.label}
              </div>
            </li>
          ))}
        </ul>

        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Manage
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
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-50"
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
          href="mailto:contact@techasset.co.kr"
          className="mb-3 flex items-center gap-2 text-xs text-slate-500 hover:text-sky-600"
        >
          <Mail size={14} />
          contact@techasset.co.kr
        </a>
        <button
          type="button"
          onClick={() => logout().then(() => (window.location.href = "/"))}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
