// Cookie Banner · Cookie Settings 문구와 쿠키 목록(Figma 'Cookie & Chat — Components (Final)' 742:1662 원문 그대로).
// - 카테고리 3종: Essential(항상 허용) · Analytics · Marketing (2026-11-23 Functional 제거, POLICY_VERSION 2).
//   배너 설명의 "support additional features"(Functional 설명)도 함께 뺐다. 그 밖의 문구는 Figma 그대로
// - GPC_NOTICE: GPC 신호가 켜진 브라우저의 Marketing 행에만 표시(Figma에 없음, 2026-11-23 추가)
// - Cookie Details: 그룹 3개(Essential·Analytics·Marketing, Settings 카테고리 순서)·쿠키 6개.
//   Channel Talk 쿠키 3개는 Essential로 표시(2026-11-25 운영 결정 — Channel Talk 답변: 상담 동작·모니터링용, 개별 차단 옵션 없음).
//   표시 분류일 뿐 SDK 실행 방식은 그대로(상담은 동의와 무관하게 boot). _dd_s_v2 기간은 실측(약 365일) 기준, 공식 답변 대기
//   (Figma의 'Channel Talk Cookies — Classification Pending' 그룹은 별도 반영 예정)
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
  description: "These technologies are necessary for essential website functions, such as authentication and security.",
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

export type CookieDetail = { name: string; provider: string; purpose: string; expiration: string };

export const COOKIE_DETAIL_GROUPS: readonly { title: string; items: readonly CookieDetail[] }[] = [
  {
    title: "Essential Cookies",
    items: [
      { name: "ch-session-248070", provider: "Channel Talk", purpose: "Maintains and manages the live chat session.", expiration: "30 minutes, renewable" },
      { name: "ch-veil-id", provider: "Channel Talk", purpose: "Identifies returning chat visitors to keep previous conversations available.", expiration: "1 year, renewable" },
      {
        name: "_dd_s_v2",
        provider: "Datadog via Channel Talk",
        purpose: "Monitors errors and performance of the live chat widget. Set by Channel Talk and cannot be turned off separately from live chat.",
        expiration: "Up to 1 year",
      },
    ],
  },
  {
    title: "Analytics Cookies",
    items: [
      { name: "_ga", provider: "Google Analytics", purpose: "Distinguishes visitors to help measure website usage.", expiration: "2 years (default)" },
      { name: "_ga_NQPD9VE63R", provider: "Google Analytics", purpose: "Stores session information for website analytics.", expiration: "2 years (default)" },
    ],
  },
  {
    title: "Marketing Cookies",
    items: [{ name: "_fbp", provider: "Meta", purpose: "Helps identify browsers for advertising measurement.", expiration: "90 days" }],
  },
];
