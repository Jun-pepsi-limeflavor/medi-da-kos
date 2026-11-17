// 404 페이지(일치하는 경로 없음·notFound()). 화면은 Next.js 기본 404와 같게 두고 메타데이터만 지정한다.
// - 지정하지 않으면 Root Layout의 Home Title·Description·Canonical·OG가 그대로 상속된다.
// - Next.js가 404 응답에 robots noindex를 자동으로 넣지만, 운영 Layout의 index 메타와 겹치지 않도록 직접 지정한다.
import type { Metadata } from "next";
import { OPEN_GRAPH_BASE } from "@/lib/config/seo";

const TITLE = "Page Not Found";
const DESCRIPTION = "The page you’re looking for doesn’t exist.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    title: `${TITLE} | Medidakos`,
    description: DESCRIPTION,
  },
};

// Same markup and styles as Next.js's built-in 404 (HTTPAccessErrorFallback), minus its own <title>.
const FONT =
  'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"';
const CSS =
  "body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}";

export default function NotFound() {
  return (
    <div
      style={{
        fontFamily: FONT,
        height: "100vh",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h1
          className="next-error-h1"
          style={{
            display: "inline-block",
            margin: "0 20px 0 0",
            padding: "0 23px 0 0",
            fontSize: 24,
            fontWeight: 500,
            verticalAlign: "top",
            lineHeight: "49px",
          }}
        >
          404
        </h1>
        <div style={{ display: "inline-block" }}>
          <h2 style={{ fontSize: 14, fontWeight: 400, lineHeight: "49px", margin: 0 }}>
            This page could not be found.
          </h2>
        </div>
      </div>
    </div>
  );
}
