import React from "react";
import Link from "next/link";
import { LayoutDashboard, Factory, Users, ShieldCheck, Inbox, Kanban } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-page";
import LogoutButton from "./LogoutButton";
import AdminMotionShell from "./AdminMotionShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireAdminPage();

  return (
    <AdminMotionShell>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans antialiased">
        <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin" className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">Medidakos</span>
                <span className="bg-indigo-950 text-indigo-400 border border-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase">
                  Backoffice
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-neutral-400">
                <Link href="/admin" className="px-3 py-2 rounded-md hover:text-white hover:bg-neutral-800 flex items-center gap-1.5">
                  <LayoutDashboard className="w-4 h-4" /> 대시보드
                </Link>
                <Link href="/admin/deals" className="px-3 py-2 rounded-md hover:text-white hover:bg-neutral-800 flex items-center gap-1.5">
                  <Kanban className="w-4 h-4" /> 딜 보드
                </Link>
                <Link href="/admin/buyers" className="px-3 py-2 rounded-md hover:text-white hover:bg-neutral-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> 바이어
                </Link>
                <Link href="/admin/suppliers" className="px-3 py-2 rounded-md hover:text-white hover:bg-neutral-800 flex items-center gap-1.5">
                  <Factory className="w-4 h-4" /> 제조사
                </Link>
                <Link href="/admin/intakes" className="px-3 py-2 rounded-md hover:text-white hover:bg-neutral-800 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4" /> 인테이크
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-2 bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-neutral-200">{actor.email}</span>
              </span>
              <LogoutButton />
            </div>
          </div>
        </header>

        <main data-admin-content className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </AdminMotionShell>
  );
}
