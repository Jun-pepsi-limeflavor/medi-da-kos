import type { ReactNode } from "react";

export function LandingShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-stone-50 text-slate-900"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10"><header className="mb-10 flex items-center justify-between border-b border-stone-200 pb-5"><span className="font-serif text-xl font-semibold tracking-tight">Medi Da Kos</span><span className="text-sm text-slate-500">Korean beauty manufacturing</span></header>{children}</div></main>;
}
