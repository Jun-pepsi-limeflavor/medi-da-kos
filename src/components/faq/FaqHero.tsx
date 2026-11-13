// FAQ 1 · Hero.
// - Eyebrow 'FAQ', 대형 제목(104px, 1200px 폭에서 두 줄), 소개 문단(609px). 상단 정렬은 다른 페이지 Hero와 같다
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: FAQ — Final Design › 1 · Hero (290:561). */
export function FaqHero() {
  return (
    <section className="bg-mdk-white pt-10 pb-12 lg:pt-[72px] lg:pb-24">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-8`}>
        <div className="flex flex-col gap-5 lg:gap-7">
          <p className={EYEBROW}>FAQ</p>
          <h1 className="text-[clamp(40px,7.22vw,104px)] leading-[0.94] font-semibold tracking-[-0.045em] text-mdk-charcoal">
            Frequently asked questions
          </h1>
        </div>
        <p className="max-w-[609px] text-mdk-lead text-mdk-charcoal">
          Answers to the questions brands ask most before starting a project.
        </p>
      </div>
    </section>
  );
}
