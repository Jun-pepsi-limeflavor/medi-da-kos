import type { Metadata } from "next";
import { LandingShell } from "@/components/landing/LandingShell";
export const metadata: Metadata = { title: "Consultation | Medi Da Kos", robots: { index: false, follow: false } };
export default function LandingLayout({ children }: { children: React.ReactNode }) { return <LandingShell>{children}</LandingShell>; }
