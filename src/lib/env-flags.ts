import { SITE_URL } from "./site";

/** 운영 도메인에서 의도적으로 테스트할 때 붙이는 쿼리. `?qa=1` */
const QA_PARAM = "qa";

/**
 * `www.` 접두어를 뗀 호스트명.
 *
 * medidakos.com과 www.medidakos.com이 **둘 다 200을 반환한다** — 리다이렉트가 없다.
 * SITE_URL은 www 쪽이라, 정규화 없이 비교하면 apex로 들어온 실제 고객이
 * 전부 테스트로 분류돼 모든 보고서에서 조용히 빠진다.
 */
function bareHost(host: string): string {
  return host.replace(/^www\./i, "");
}

/**
 * 이 제출/이벤트를 실제 고객 행동으로 세면 안 되는가.
 *
 * 호스트명만 보면 운영 도메인에서 우리가 직접 눌러본 건을 표시할 방법이 없다.
 * 2026-08-05 koreaLeads 첫 행("test / testtest")이 운영에서 들어와
 * `isTest: false`로 저장됐다 — 진짜 리드와 구분이 안 된다.
 * 그래서 도메인 판정에 `?qa=1` 수동 표시를 더한다.
 */
export function isNonProductionEnv(): boolean {
  if (typeof window === "undefined") return true;
  if (bareHost(window.location.hostname) !== bareHost(new URL(SITE_URL).hostname)) {
    return true;
  }
  return new URLSearchParams(window.location.search).has(QA_PARAM);
}
