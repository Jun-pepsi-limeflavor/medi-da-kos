"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const isHome = usePathname() === "/";

  return (
    <>
      <Header />
      {/* Home only drops the header offset at lg, where the hero goes full-bleed. */}
      <main className={`flex-1 pt-16 ${isHome ? "lg:pt-0" : ""}`}>
        {children}
      </main>
      <Footer />
    </>
  );
}
