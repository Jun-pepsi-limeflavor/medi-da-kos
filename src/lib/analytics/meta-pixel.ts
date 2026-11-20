import { isQaVisit } from "@/lib/utils/env-flags";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** 이 사이트에서 쓰는 Meta 표준 이벤트. 맞춤 이벤트는 광고 최적화 대상이 아니라 쓰지 않는다. */
export type MetaStandardEvent = "Lead" | "Contact" | "CompleteRegistration" | "SubmitApplication";

/**
 * 개인정보(이메일·회사명 등)는 params에 넣지 않는다.
 *
 * 어느 픽셀로 갈지는 MetaPixel이 정한다: 운영 빌드·운영 도메인이면 운영 픽셀, 개발 빌드·그 밖의 호스트면 개발 픽셀,
 * 그 밖에는 로드하지 않는다(analytics-env.ts). 픽셀이 로드되지 않았거나 `?qa=1`이면 보내지 않는다 —
 * Meta 광고 최적화에는 GA `is_test` 같은 필터가 없어 테스트 전환이 운영 픽셀에 그대로 학습되기 때문이다.
 */
export function trackMetaEvent(event: MetaStandardEvent, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function" || isQaVisit()) {
    // 픽셀 미로드(ID 없음·환경 불일치)·?qa=1 에서 연결 확인용
    console.info("[meta] skipped (pixel not loaded or qa)", event, params ?? {});
    return;
  }
  window.fbq("track", event, params);
}
