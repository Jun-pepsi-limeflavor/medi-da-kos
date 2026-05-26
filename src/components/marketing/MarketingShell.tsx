"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const isHome = usePathname() === "/";

  return (
    <>
      <Header />
      <main className={`flex-1 ${isHome ? "" : "pt-16"}`}>{children}</main>
      <Footer />
    </>
  );
}
