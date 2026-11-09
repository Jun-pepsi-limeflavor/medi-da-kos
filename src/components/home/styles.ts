// Home 섹션 공통 클래스.
// - 콘텐츠 폭(1440 프레임 안 좌우 120px → 1200px)과 Eyebrow·Display 제목 스타일

/** Same horizontal frame as Navbar/Footer: 24px gutter, 120px from xl, content capped at 1200px. */
export const SECTION_CONTAINER = "mx-auto w-full max-w-[1440px] px-6 xl:px-[120px]";

/** MDK/Eyebrow in charcoal-muted. */
export const EYEBROW = "text-mdk-eyebrow text-mdk-charcoal-muted";

/** MDK/Display L (72/72), reduced on small screens. */
export const DISPLAY_TITLE =
  "text-[40px] leading-[44px] font-semibold tracking-[-0.04em] md:text-[56px] md:leading-[58px] lg:text-mdk-display-l";
