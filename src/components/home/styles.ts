// Home 섹션 공통 클래스.
// - 콘텐츠 폭(1440 프레임 안 좌우 120px → 1200px)과 Eyebrow·Display 제목 스타일
// - Display 제목은 lg에서 행간 72px을 다시 지정(작은 화면 leading이 토큰 행간보다 우선하기 때문)

/** Same horizontal frame as Navbar/Footer: 24px gutter, 120px from xl, content capped at 1200px. */
export const SECTION_CONTAINER = "mx-auto w-full max-w-[1440px] px-6 xl:px-[120px]";

/** MDK/Eyebrow in charcoal-muted. */
export const EYEBROW = "text-mdk-eyebrow text-mdk-charcoal-muted";

/** MDK/Display L (72/72), reduced on small screens. */
export const DISPLAY_TITLE =
  "text-[40px] leading-[44px] font-semibold tracking-[-0.04em] md:text-[56px] md:leading-[58px] lg:text-mdk-display-l lg:leading-[72px]";
