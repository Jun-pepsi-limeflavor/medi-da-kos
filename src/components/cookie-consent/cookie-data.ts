// Cookie Banner · Cookie Settings 문구와 쿠키 목록(Figma 'Cookie & Chat — Components (Final)' 742:1662 원문 그대로).
// - 카테고리 4종: Essential(항상 허용) · Analytics · Marketing · Functional — Figma에 없는 카테고리·문구는 추가하지 않는다
// - Cookie Details: 그룹 3개·쿠키 6개(Channel Talk 그룹 제목의 'Classification Pending'도 Figma 문구 그대로)
import type { OptionalCookieCategory } from "@/lib/cookie-consent/consent";

export const COOKIE_BANNER = {
  title: "We Value Your Privacy",
  description: [
    "We use essential cookies and similar technologies to operate our website. With your consent, we also use optional technologies to analyze website usage, measure advertising performance, and support additional features.",
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
  {
    key: "functional",
    name: "Functional Cookies",
    description:
      "These technologies support additional website features, including optional chat-related functions and user preferences.",
  },
];

export type CookieDetail = { name: string; provider: string; purpose: string; expiration: string };

export const COOKIE_DETAIL_GROUPS: readonly { title: string; items: readonly CookieDetail[] }[] = [
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
  {
    title: "Channel Talk Cookies — Classification Pending",
    items: [
      { name: "ch-session-248070", provider: "Channel Talk", purpose: "Maintains authentication for the live chat session.", expiration: "30 minutes, renewable" },
      { name: "ch-veil-id", provider: "Channel Talk", purpose: "Recognizes returning chat visitors and helps restore previous conversations.", expiration: "1 year, renewable" },
      { name: "_dd_s_v2", provider: "Datadog via Channel Talk", purpose: "Supports monitoring of errors in the live chat widget.", expiration: "Up to 1 year" },
    ],
  },
];
