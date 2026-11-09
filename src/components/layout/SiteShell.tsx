"use client";

// 리뉴얼 페이지 공통 틀: Announcement Bar → Navbar → 본문 → Footer.
// - Announcement Bar는 지정된 페이지에서만 표시
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { showsAnnouncementBar } from "@/lib/config/routes";

/**
 * Renewal layout: Announcement Bar (per-page rule) → sticky Navbar → page → Footer.
 * Used by the (site) route group only; legacy pages keep (marketing)/MarketingShell until each is rebuilt.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="font-mdk flex flex-1 flex-col bg-mdk-white text-mdk-charcoal">
      {showsAnnouncementBar(pathname) ? <AnnouncementBar /> : null}
      <Navbar />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
