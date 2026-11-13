// Services 페이지 앵커 정의.
// - 섹션 앵커 5개(라벨·id)는 routes.ts의 SERVICES_SECTIONS와 같은 id를 사용
// - sticky 기준: Navbar 72 + 차콜 Anchor Bar 52 = 124px
// - 앵커 이동 대상과 Scroll Spy 기준을 분리한다
//   · 이동 대상: 각 섹션의 eyebrow·제목 묶음(id). 바 아래 40px 여백에 오도록 scroll-margin 164px
//   · Scroll Spy: <section data-services-section="id"> 전체. 섹션 상단(디자인 여백 포함)이 124px 선에 닿는 순간 활성
// - 단계 목록은 바 아래 + 24px = 148px 기준(이동·Scroll Spy·sticky 동일)

export const SERVICES_ANCHORS = [
  { id: "scope", label: "Scope" },
  { id: "how-it-works", label: "How it works" },
  { id: "samples-moq", label: "Samples & MOQ" },
  { id: "payment-shipping", label: "Payment & shipping" },
  { id: "quality-compliance", label: "Quality & compliance" },
] as const;

export type ServicesAnchorId = (typeof SERVICES_ANCHORS)[number]["id"];

/** Navbar (72) + Anchor Bar (52): Scroll Spy line for the five sections. */
export const SERVICES_SCROLL_OFFSET = 124;

/** Stage details scroll target and Scroll Spy line: sticky bars + 24px gap. */
export const STAGE_SCROLL_OFFSET = 148;

/** Anchor target (eyebrow + heading block): lands 40px below the sticky bars, skipping the section's top padding. */
export const ANCHOR_TARGET = "scroll-mt-[164px]";

/** Scroll Spy element for a section anchor: the whole <section>, including its top padding. */
export const findServicesSection = (id: string) => document.querySelector(`[data-services-section="${id}"]`);
