/**
 * 콜드메일·광고 전용 랜딩 셸.
 *
 * (marketing) 그룹의 MarketingShell을 일부러 쓰지 않는다 — 그쪽 Header에는
 * 네비 4개와 Log in 버튼이 있고, 수신자를 로그인 화면으로 흘려보내는 게
 * 이 페이지가 존재하는 이유 자체를 무너뜨린다. 여기엔 나가는 링크가 없다.
 */
export default function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-sky-100/90 bg-white/85">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <span className="font-serif text-lg font-semibold tracking-tight text-slate-800">
            Medi Da Kos
          </span>
        </div>
      </header>

      <main className="flex-1 bg-gradient-to-b from-sky-50/50 via-white to-white pb-24 sm:pb-0">
        {children}
      </main>

      <footer className="border-t border-sky-100/90 bg-white/85">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="font-serif text-base text-slate-600">Medi Da Kos</p>
          <p>&copy; 2026 Medi Da Kos</p>
        </div>
      </footer>
    </>
  );
}
