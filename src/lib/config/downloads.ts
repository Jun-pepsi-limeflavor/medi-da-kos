// 다운로드 파일 경로(public/downloads). 여러 페이지가 같은 파일을 쓰도록 한곳에서 관리한다.
// - 브리프 양식: Portfolio CTA와 Contact 'Download brief template'이 같은 Excel 파일을 내려받는다

/** Product development brief template (Excel). The file name has spaces, so the URL is encoded. */
export const BRIEF_TEMPLATE = {
  fileName: "Medidakos_Product Development Brief.xlsx",
  href: `/downloads/${encodeURIComponent("Medidakos_Product Development Brief.xlsx")}`,
} as const;
