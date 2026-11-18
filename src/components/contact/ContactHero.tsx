// Contact 1 · Hero.
// - Eyebrow 'Contact', 대형 제목(104px, 두 줄), 소개 문장. 상단 정렬·글자 크기는 다른 페이지 Hero와 같다
// - 하단 여백만 56px(모바일 32px)로 줄여 아래 구분선·문의 폼이 더 일찍 보이게 한다(Figma 96 → 56, 2026-11-10)
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: Contact — Final Design › 1 · Hero (291:708). */
export function ContactHero() {
  return (
    <section className="bg-mdk-white pt-10 pb-8 lg:pt-[72px] lg:pb-14">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-8`}>
        <div className="flex flex-col gap-5 lg:gap-7">
          <p className={EYEBROW}>Contact</p>
          <h1 className="text-[clamp(40px,7.22vw,104px)] leading-[0.94] font-semibold tracking-[-0.045em] text-mdk-charcoal">
            Your next launch <br className="hidden sm:inline" />
            starts here
          </h1>
        </div>
        <p className="text-mdk-lead text-mdk-charcoal">Share your product idea, and we’ll guide you through the next steps.</p>
      </div>
    </section>
  );
}
