// Log In·Sign Up 공통 페이지 틀.
// - Navbar만 표시(Announcement Bar·Footer 없음), 연회색 배경 위에 인증 카드를 가운데 배치
// - 레이아웃이 아닌 각 Page의 루트로 렌더링해 페이지 첫 요소가 문서 최상단에서 시작하게 한다.
//   Next.js는 이동 시 Page 첫 요소로 스크롤하므로 /login ↔ /signup 전환이 항상 최상단에서 열린다.
import { Navbar } from "@/components/layout/Navbar";

/**
 * Figma Main · Auth: 60px from the Navbar bottom to the card, 100px from the card to the page bottom.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mdk flex flex-1 flex-col bg-mdk-off-white text-mdk-charcoal">
      <Navbar />
      <main className="flex flex-1 justify-center px-4 pt-10 pb-16 sm:px-6 sm:pt-[60px] sm:pb-[100px]">{children}</main>
    </div>
  );
}
