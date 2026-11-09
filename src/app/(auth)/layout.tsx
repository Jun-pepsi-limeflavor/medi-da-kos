// Log In·Sign Up 공통 레이아웃.
// - Navbar만 표시(Announcement Bar·Footer 없음)
// - 연회색 배경 위에 인증 카드를 가운데 배치
import { Navbar } from "@/components/layout/Navbar";

/**
 * Log In · Sign Up (Figma: Navbar only — no Announcement Bar, no Footer; off-white page background).
 * Figma Main · Auth: 60px from the Navbar bottom to the card, 100px from the card to the page bottom.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mdk flex flex-1 flex-col bg-mdk-off-white text-mdk-charcoal">
      <Navbar />
      <main className="flex flex-1 justify-center px-4 pt-10 pb-16 sm:px-6 sm:pt-[60px] sm:pb-[100px]">{children}</main>
    </div>
  );
}
