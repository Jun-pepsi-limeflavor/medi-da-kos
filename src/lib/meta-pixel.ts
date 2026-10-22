import { isNonProductionEnv } from "./env-flags";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** 이 사이트에서 쓰는 Meta 표준 이벤트. 맞춤 이벤트는 광고 최적화 대상이 아니라 쓰지 않는다. */
export type MetaStandardEvent = "Lead" | "Contact" | "CompleteRegistration" | "SubmitApplication";

/**
 * 운영 도메인의 실제 방문일 때만 Meta로 보낼지 판정한다.
 *
 * GA는 `is_test`로 나중에 걸러내지만 Meta 광고 최적화는 그런 필터가 없어
 * 테스트 전환이 그대로 학습된다. 그래서 보내지 않는 쪽으로 막는다.
 */
export function shouldSendToMeta(): boolean {
  return !isNonProductionEnv();
}

/** 개인정보(이메일·회사명 등)는 params에 넣지 않는다. */
export function trackMetaEvent(event: MetaStandardEvent, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!shouldSendToMeta()) {
    // 로컬·프리뷰·?qa=1 에서 연결 확인용
    console.info("[meta] skipped (test env)", event, params ?? {});
    return;
  }
  if (typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}
