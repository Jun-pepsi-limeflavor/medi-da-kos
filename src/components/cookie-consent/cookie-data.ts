// Cookie Banner · Cookie Settings 문구와 쿠키 목록(Figma 'Cookie & Chat — Components (Final)' 742:1662 원문 그대로).
// - 카테고리 3종: Essential(항상 허용) · Analytics · Marketing (2026-11-23 Functional 제거, POLICY_VERSION 2).
//   배너 설명의 "support additional features"(Functional 설명)도 함께 뺐다. 그 밖의 문구는 Figma 그대로
// - GPC_NOTICE: GPC 신호가 켜진 브라우저의 Marketing 행에만 표시(Figma에 없음, 2026-11-23 추가)
// - Cookie Details(2026-11-26 확정 14행, Settings 카테고리 순서): Essential 3 · Analytics 4 · Marketing 7, 행마다 저장 방식(type).
//   고지 원칙: 쿠키는 모두 표시, 쿠키가 아닌 저장소는 Analytics·Marketing의 식별·추적용만 표시
//   (Essential 기능용 localStorage·sessionStorage·IndexedDB — 동의 기록, Firebase 로그인, Channel Talk 상태 — 는 Privacy Policy에서 범주로 안내).
//   Analytics·Marketing 행은 cleanup.ts가 철회 시 지우는 항목과 같다(tests/cookie-consent/cookie-details.test.ts).
// - Channel Talk 쿠키 3개는 Essential(2026-11-25 운영 결정 — 상담 동작·모니터링용, 개별 차단 옵션 없음). 표시 분류일 뿐 SDK는 동의와 무관하게 boot.
//   _dd_s_v2: 쿠키 수명은 실측 365일(Datadog trackAnonymousUser 기본값), 15분·4시간은 쿠키 안 모니터링 세션의 만료
// - GA4 쿠키는 기본 2년이나 브라우저가 줄일 수 있음(Chrome 실측 400일). Google Ads 항목(_gcl_*)은 GA4 태그가
//   Analytics·Marketing 동의 + 광고 클릭 ID(gclid) 유입일 때만 만든다(운영 태그 재현 실측). _fbc는 dev에서 생성 확인 예정
import type { OptionalCookieCategory } from "@/lib/cookie-consent/consent";

export const COOKIE_BANNER = {
  title: "We Value Your Privacy",
  description: [
    "We use essential cookies and similar technologies to operate our website. With your consent, we also use optional technologies to analyze website usage and measure advertising performance.",
    "You can accept all optional cookies, reject them, or manage your preferences at any time.",
  ],
} as const;

export const COOKIE_SETTINGS_COPY = {
  title: "Cookie Settings",
  /** Figma: two sentences on separate lines (line break, no paragraph spacing). */
  description: [
    "Manage your preferences for optional cookies and similar technologies.",
    "You can change or withdraw your consent at any time.",
  ],
} as const;

export const ESSENTIAL_CATEGORY = {
  name: "Essential Cookies",
  description:
    "These technologies are necessary for essential website functions, such as authentication, security, consent management, and live chat support, including monitoring of the chat service.",
} as const;

export const OPTIONAL_CATEGORIES: readonly { key: OptionalCookieCategory; name: string; description: string }[] = [
  {
    key: "analytics",
    name: "Analytics Cookies",
    description: "These technologies help us understand how visitors use our website and measure website performance.",
  },
  {
    key: "marketing",
    name: "Marketing Cookies",
    description: "These technologies help measure advertising performance and support personalized advertising activities.",
  },
];

/** Shown under Marketing when the browser sends a Global Privacy Control signal (Marketing stays off). */
export const GPC_NOTICE = "Your browser's Global Privacy Control signal is honored, so marketing technologies stay off.";

/** How the item is stored in the browser (shown as "Type"). */
export const STORAGE_TYPES = ["Cookie", "Local storage", "Session storage"] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export type CookieDetail = { name: string; type: StorageType; provider: string; purpose: string; expiration: string };

const GA_EXPIRATION = "Up to 2 years (browsers may set a shorter limit)";
const UNTIL_WITHDRAWN = "Until deleted; removed when you withdraw consent";
const TAB_SESSION = "Until the browser tab is closed";

export const COOKIE_DETAIL_GROUPS: readonly { title: string; items: readonly CookieDetail[] }[] = [
  {
    title: "Essential Cookies",
    items: [
      { name: "ch-session-248070", type: "Cookie", provider: "Channel Talk", purpose: "Maintains and manages the live chat session.", expiration: "30 minutes, renewable" },
      { name: "ch-veil-id", type: "Cookie", provider: "Channel Talk", purpose: "Identifies returning chat visitors to keep previous conversations available.", expiration: "1 year, renewable" },
      {
        name: "_dd_s_v2",
        type: "Cookie",
        provider: "Datadog via Channel Talk",
        purpose: "Monitors errors and performance of the live chat widget. Set by Channel Talk and cannot be turned off separately from live chat.",
        expiration: "Up to 1 year",
      },
    ],
  },
  {
    title: "Analytics Cookies",
    items: [
      { name: "_ga", type: "Cookie", provider: "Google Analytics", purpose: "Distinguishes visitors to help measure website usage.", expiration: GA_EXPIRATION },
      { name: "_ga_NQPD9VE63R", type: "Cookie", provider: "Google Analytics", purpose: "Stores session information for website analytics.", expiration: GA_EXPIRATION },
      {
        name: "medidakos_ga_client_id",
        type: "Session storage",
        provider: "Medidakos",
        purpose: "Keeps your Google Analytics visitor ID in this tab so inquiries can be linked to website analytics.",
        expiration: TAB_SESSION,
      },
      {
        name: "medidakos_utm_params",
        type: "Session storage",
        provider: "Medidakos",
        purpose: "Keeps the campaign (UTM) parameters of your landing page in this tab so inquiries can be attributed to the campaign.",
        expiration: TAB_SESSION,
      },
    ],
  },
  {
    title: "Marketing Cookies",
    items: [
      { name: "_fbp", type: "Cookie", provider: "Meta", purpose: "Helps identify browsers for advertising measurement.", expiration: "90 days" },
      { name: "_fbc", type: "Cookie", provider: "Meta", purpose: "Stores the Meta ad click ID, only when you arrive from a Meta ad.", expiration: "90 days" },
      { name: "lastExternalReferrer", type: "Local storage", provider: "Meta", purpose: "Records the last external website that referred you, for advertising measurement.", expiration: UNTIL_WITHDRAWN },
      { name: "lastExternalReferrerTime", type: "Local storage", provider: "Meta", purpose: "Records when that last external referral happened.", expiration: UNTIL_WITHDRAWN },
      {
        name: "_gcl_aw",
        type: "Cookie",
        provider: "Google Ads via Google Analytics",
        purpose: "Stores the Google Ads click ID to measure ad conversions, only when you arrive from a Google ad and both Analytics and Marketing are allowed.",
        expiration: "90 days",
      },
      {
        name: "_gcl_gs",
        type: "Cookie",
        provider: "Google Ads via Google Analytics",
        purpose: "Stores related Google Ads click information, only when you arrive from a Google ad and both Analytics and Marketing are allowed.",
        expiration: "90 days",
      },
      {
        name: "_gcl_ls",
        type: "Local storage",
        provider: "Google Ads via Google Analytics",
        purpose: "Keeps Google Ads click information for conversion measurement, only when you arrive from a Google ad and both Analytics and Marketing are allowed.",
        expiration: "Until deleted; removed when you withdraw Analytics or Marketing consent",
      },
    ],
  },
];
