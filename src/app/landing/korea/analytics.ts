import { trackConversionEvent } from "@/lib/analytics";

/**
 * /korea 랜딩의 반응 계측.
 *
 * 이벤트를 늘리지 않고 파라미터로 분해한다. 섹션이 늘거나 FAQ 문항이 바뀌어도
 * 이벤트 이름은 그대로 두고 `section_id`·`faq_id` 값만 늘어난다 —
 * 주차마다 카피가 바뀌는 페이지라 이름을 고정해야 주 간 비교가 가능하다.
 *
 * 모든 이벤트에 `positioning_arm`을 붙인다. `is_test`는 `trackConversionEvent`가
 * 전역으로 붙인다. 둘 다 GA4에서 맞춤 측정기준으로 등록해야 보고서에 나온다 —
 * 등록 전에는 수집돼도 안 보인다.
 */

/** 페이지 안에서 관찰하는 구간. 값이 곧 보고서의 행이 된다. */
export type KoreaSectionId =
  | "hero"
  | "formulas"
  | "positioning"
  | "steps"
  | "checks"
  | "volume"
  | "honesty"
  | "brief"
  | "faq"
  | "closing";

export type KoreaCtaId = "hero" | "closing" | "sticky";

let armForSession = "arm-b";

/** 페이지 진입 시 1회. 서버가 정한 arm을 클라이언트 이벤트에도 실어보내기 위함. */
export function setKoreaArm(arm: string) {
  armForSession = arm;
}

export function track(event: string, params: Record<string, unknown>) {
  trackConversionEvent(event, { ...params, positioning_arm: armForSession });
}

/** 세로 스크롤 도달률. 25/50/75/100 각각 1회씩. */
export function trackScrollDepth(percent: 25 | 50 | 75 | 100) {
  track("scroll_depth", { percent_scrolled: percent });
}

/** 구간이 화면에 절반 이상 들어온 순간. 구간당 1회. */
export function trackSectionView(sectionId: KoreaSectionId) {
  track("section_view", { section_id: sectionId });
}

/** FAQ 문항을 펼친 순간. 어떤 반론이 살아 있는지 읽는 지표. */
export function trackFaqOpen(faqId: string) {
  track("faq_open", { faq_id: faqId });
}

export function trackCtaClick(ctaId: KoreaCtaId) {
  track("cta_click", { cta_id: ctaId });
}

/** 폼 첫 입력. 도달과 제출 사이의 이탈을 분리해서 본다. */
export function trackFormStart() {
  track("form_start", { form_id: "coldmail-landing" });
}

/**
 * 폼을 쓰다 말고 떠난 순간. 마지막으로 만진 필드가 어디서 막혔는지 알려준다.
 *
 * 필드 **이름만** 보낸다 — 입력값(이메일·회사명)은 절대 보내지 않는다.
 * 페이지를 떠나는 중이라 일반 요청은 잘리므로 beacon으로 내보낸다.
 */
export function trackFormAbandon(lastField: string) {
  track("form_abandon", {
    form_id: "coldmail-landing",
    last_field: lastField,
    transport_type: "beacon",
  });
}

/**
 * CTA가 화면에 3초 이상 머문 것.
 *
 * 스크롤 도달률로는 "못 봤다"와 "보고도 안 눌렀다"가 안 갈린다.
 * 이 이벤트와 `cta_click`을 나란히 놓아야 문제가 노출인지 문구인지 판별된다.
 */
export function trackCtaView(ctaId: KoreaCtaId) {
  track("cta_view", { cta_id: ctaId });
}

/**
 * 화면이 실제로 보인 채로 15초를 넘긴 세션.
 *
 * GA4 기본 참여 세션 기준은 10초인데 봇 상당수가 그 언저리에 머문다.
 * 사람만 남기는 자체 기준으로 15초를 따로 센다. 탭이 숨겨진 동안은 세지 않는다.
 */
export function trackEngaged15s() {
  track("engaged_15s", {});
}
