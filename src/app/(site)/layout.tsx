// 리뉴얼 페이지 라우트 그룹 레이아웃. 하위 페이지를 SiteShell로 감싼다.
import { SiteShell } from "@/components/layout/SiteShell";

/**
 * Renewal pages live in this route group. Move a page here from (marketing) when its new design is built;
 * remove (marketing) and the legacy Header/Footer/MarketingShell once the last legacy page has moved.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
