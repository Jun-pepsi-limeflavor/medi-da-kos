// 동의 당시 고지 원문(배너·설정·Cookie Details·GPC 안내)의 정본과 해시.
// - 서버 기록(cookieConsentLogs)에는 정책 버전과 NOTICE_HASH만 남기고, 원문은 버전별로 Git에 보존한다:
//   docs/legal/cookie-consent/policy-v{POLICY_VERSION}.json (기존 버전 파일은 지우거나 고치지 않는다)
// - 문구를 바꾸면 tests/cookie-consent/notice.test.ts가 실패한다 → 새 해시로 NOTICE_HASH를 바꾸고 같은 버전 스냅샷을 갱신하거나,
//   재동의가 필요한 변경(목적·업체·카테고리 추가, 공유 확대)이면 POLICY_VERSION을 올리고 새 스냅샷 파일을 추가한다
// - 해시: 아래 CONSENT_NOTICE를 JSON.stringify한 UTF-8 문자열의 SHA-256(hex)
import {
  COOKIE_BANNER,
  COOKIE_DETAIL_GROUPS,
  COOKIE_SETTINGS_COPY,
  ESSENTIAL_CATEGORY,
  GPC_NOTICE,
  OPTIONAL_CATEGORIES,
} from "@/components/cookie-consent/cookie-data";
import { CONSENT_RETENTION_MONTHS, POLICY_VERSION } from "@/lib/cookie-consent/policy";

export const CONSENT_NOTICE = {
  policyVersion: POLICY_VERSION,
  choiceValidityMonths: CONSENT_RETENTION_MONTHS,
  banner: COOKIE_BANNER,
  settings: COOKIE_SETTINGS_COPY,
  essential: ESSENTIAL_CATEGORY,
  optional: OPTIONAL_CATEGORIES,
  details: COOKIE_DETAIL_GROUPS,
  gpcNotice: GPC_NOTICE,
} as const;

/** SHA-256 of JSON.stringify(CONSENT_NOTICE). Kept as a constant so the browser needs no hashing code. */
export const NOTICE_HASH = "89b8127d86e4163b826645310cd383a6c16c54aac0cf599cf8665c30e354a3c9";
