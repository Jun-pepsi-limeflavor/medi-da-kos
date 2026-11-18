// Services 4 · Samples & MOQ (#samples-moq).
// - 개발 단계별 비용 표(Custom R&D & samples) + MOQ 패널(5,000 units per SKU) + 관련 질문
// - 표는 md 미만에서 행마다 세로 카드로 바꾸고 열 제목을 각 값 위에 표시
import { ANCHOR_TARGET } from "@/components/services/anchors";
import { RelatedQuestions } from "@/components/services/RelatedQuestions";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: Custom R&D & sample costs (table) (255:393). */
const COLUMNS = ["Development stage", "Development fee", "Shipping"] as const;
const ROWS = [
  ["Initial formula samples (up to 3 products)", "No charge", "Shipping fee applies"],
  ["Additional formula development", "Quoted separately", "Shipping fee applies"],
  ["Revisions (from round 2)", "Quoted separately", "Shipping fee applies"],
] as const;

// Figma columns 260 · flexible · 200 with 24px gaps; the gap sits inside each cell as right padding.
const COL_WIDTH = ["md:w-[284px]", "", "md:w-[200px]"] as const;
const MOBILE_LABEL =
  "max-md:before:mb-1 max-md:before:block max-md:before:text-[13px] max-md:before:leading-4 max-md:before:font-medium max-md:before:text-mdk-charcoal-muted max-md:before:content-[attr(data-label)]";

export function ServicesSamplesMoq() {
  return (
    <section data-services-section="samples-moq" className="bg-mdk-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-16`}>
        <div id="samples-moq" className={cx(ANCHOR_TARGET, "flex flex-col gap-6")}>
          <p className={EYEBROW}>Samples &amp; MOQ</p>
          <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>Start with a sample</h2>
          <p className="max-w-[760px] text-mdk-lead text-mdk-charcoal">
            Every product begins with development tailored to your brand. Your first sampling round includes up to three
            formula samples with no development fee. Additional development and revision rounds are quoted separately.
          </p>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <h3 className="text-[22px] leading-7 font-medium tracking-[-0.015em] text-mdk-charcoal">Custom R&amp;D &amp; samples</h3>
            <table className="w-full border-collapse text-left max-md:block">
              <thead className="max-md:sr-only">
                <tr className="border-b border-mdk-charcoal">
                  {COLUMNS.map((col, i) => (
                    <th
                      key={col}
                      scope="col"
                      className={cx(
                        "pr-6 pb-3.5 text-[14px] leading-5 font-medium tracking-[-0.003em] text-mdk-charcoal-muted last:pr-0",
                        COL_WIDTH[i],
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="max-md:block max-md:border-t max-md:border-mdk-charcoal">
                {ROWS.map((row) => (
                  <tr key={row[0]} className="border-b border-mdk-light-gray max-md:flex max-md:flex-col max-md:gap-3 max-md:py-5">
                    {row.map((cell, i) => (
                      <td
                        key={COLUMNS[i]}
                        data-label={COLUMNS[i]}
                        className={cx(
                          "pr-6 align-top text-mdk-body text-mdk-charcoal last:pr-0 md:py-5",
                          i === 0 && "font-medium",
                          COL_WIDTH[i],
                          MOBILE_LABEL,
                          "max-md:block max-md:pr-0",
                        )}
                      >
                        {cell.startsWith("Initial formula samples") ? (
                          <>
                            {cell.slice(0, cell.indexOf(" ("))}
                            <br className="max-md:hidden" /> {cell.slice(cell.indexOf(" (") + 1)}
                          </>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[14px] leading-[25px] tracking-[-0.002em] text-mdk-charcoal-muted">
              Each new round of sample development begins once payment for any R&amp;D and shipping fees has been received.
            </p>
          </div>

          <aside
            aria-label="Minimum order quantity"
            className="flex flex-col gap-4 rounded-mdk-lg bg-mdk-off-white p-8 sm:p-10 lg:w-[400px] lg:shrink-0"
          >
            <p className={EYEBROW}>Minimum order quantity</p>
            <p className="flex flex-col gap-1 text-mdk-charcoal">
              <span className="text-[72px] leading-[72px] font-semibold tracking-[-0.045em] sm:text-[96px] sm:leading-[92px]">5,000</span>
              <span className="text-[20px] leading-[30px] font-medium tracking-[-0.015em]">units per SKU</span>
            </p>
            <p className="text-mdk-body text-mdk-charcoal">
              Each distinct product you plan to sell — for example, a toner and a serum are two SKUs.
            </p>
            <p className="text-mdk-body text-mdk-charcoal">
              Samples are developed for review before production and are not subject to the MOQ.
            </p>
            <p className="text-[14px] leading-[22px] tracking-[-0.002em] text-mdk-charcoal-muted">
              MOQ applies to production orders. It may vary by product type and manufacturing conditions; your PM team
              confirms it during consultation.
            </p>
          </aside>
        </div>

        <RelatedQuestions
          items={[
            { id: "faq-018", question: "Can I start with a smaller trial order?" },
            { id: "faq-023", question: "Are samples and international shipping free?" },
            { id: "faq-024", question: "Can I revise the formula after testing samples?" },
          ]}
        />
      </div>
    </section>
  );
}
