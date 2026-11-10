// Contact 문의 폼 입력·첨부 파일 검증 규칙(화면과 분리된 순수 함수 — 테스트 대상).
// - 필수 항목·이메일·웹 주소·수량(5,000 이상 정수, 쉼표 허용)·희망 출시일(MM / YYYY, 이번 달 이후) 검증
// - 필수·이메일 형식은 Log In·Sign Up과 같은 규칙·문구(lib/auth/validation 재사용)
// - 수량 천 단위 쉼표 표시, 출시일 'MM / YYYY' 정규화
// - 브리프 첨부: 허용 확장자·파일당 10 MiB·최대 3개·중복 제외 검증
// - 오류 문구는 모두 확정(2026-11-10 승인)

import { AUTH_MESSAGES, validateAuthField } from "@/lib/auth/validation";

export type InquiryValues = {
  fullName: string;
  email: string;
  company: string;
  country: string;
  website: string;
  productCategory: string;
  quantity: string;
  targetMarkets: string;
  launchDate: string;
  message: string;
};

export type InquiryField = keyof InquiryValues;

/** Display order — the first invalid field in this order gets focus on submit. */
export const INQUIRY_FIELDS: readonly InquiryField[] = [
  "fullName",
  "email",
  "company",
  "country",
  "website",
  "productCategory",
  "quantity",
  "targetMarkets",
  "launchDate",
  "message",
];

/** Figma: required fields are the ones marked * (everything except Website or social link). */
export const REQUIRED_FIELDS: ReadonlySet<InquiryField> = new Set(INQUIRY_FIELDS.filter((f) => f !== "website"));

export const MIN_QUANTITY = 5000;

export const INQUIRY_MESSAGES = {
  // Shared with Log In · Sign Up (same rule, same copy)
  required: AUTH_MESSAGES.required,
  invalidEmail: AUTH_MESSAGES.email,
  // Figma
  minQuantity: "Please enter a number of 5,000 or more.",
  formError: "Some required fields are empty. Check the highlighted fields and send again.",
  // Contact-only (approved 2026-11-10)
  invalidWebsite: "Please enter a valid web address.",
  wholeNumber: "Please enter a whole number.",
  launchFormat: "Please enter a date as MM / YYYY.",
  launchPast: "Please enter this month or a later date.",
} as const;

/** Same email rule as Log In · Sign Up (HTML valid e-mail address). */
export function isValidEmail(value: string): boolean {
  return validateAuthField("email", value) === undefined;
}

/** Optional website/social link: http(s) address with a dotted host. A missing scheme is treated as https. */
export function isValidWebsite(value: string): boolean {
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return false;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return (url.protocol === "https:" || url.protocol === "http:") && /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** Positive whole number with optional thousands commas ("12,000" → 12000); otherwise null. */
export function parseQuantity(value: string): number | null {
  const digits = value.trim().replace(/,/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Thousands commas for a valid whole number (shown on blur); other input is left as typed. */
export function formatQuantity(value: string): string {
  const n = parseQuantity(value);
  return n === null ? value : n.toLocaleString("en-US");
}

/** "3/2027", "03 / 2027" → { month: 3, year: 2027 }; otherwise null. */
export function parseLaunchDate(value: string): { month: number; year: number } | null {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  return month >= 1 && month <= 12 ? { month, year } : null;
}

/** Shown as "MM / YYYY" on blur when the value parses. */
export function normalizeLaunchDate(value: string): string {
  const date = parseLaunchDate(value);
  return date ? `${String(date.month).padStart(2, "0")} / ${date.year}` : value;
}

/** Error message for one field, or null when valid. `now` decides which month counts as the past. */
export function validateInquiryField(field: InquiryField, value: string, now: Date = new Date()): string | null {
  const trimmed = value.trim();
  if (!trimmed) return REQUIRED_FIELDS.has(field) ? INQUIRY_MESSAGES.required : null;
  switch (field) {
    case "email":
      return isValidEmail(trimmed) ? null : INQUIRY_MESSAGES.invalidEmail;
    case "website":
      return isValidWebsite(trimmed) ? null : INQUIRY_MESSAGES.invalidWebsite;
    case "quantity": {
      const n = parseQuantity(trimmed);
      if (n === null) return INQUIRY_MESSAGES.wholeNumber;
      return n < MIN_QUANTITY ? INQUIRY_MESSAGES.minQuantity : null;
    }
    case "launchDate": {
      const date = parseLaunchDate(trimmed);
      if (!date) return INQUIRY_MESSAGES.launchFormat;
      const currentMonth = now.getFullYear() * 12 + now.getMonth();
      return date.year * 12 + (date.month - 1) < currentMonth ? INQUIRY_MESSAGES.launchPast : null;
    }
    default:
      return null;
  }
}

export function validateInquiry(values: InquiryValues, now: Date = new Date()): Partial<Record<InquiryField, string>> {
  const errors: Partial<Record<InquiryField, string>> = {};
  for (const field of INQUIRY_FIELDS) {
    const error = validateInquiryField(field, values[field], now);
    if (error) errors[field] = error;
  }
  return errors;
}

// ---------- Brief attachments ----------

/** Minimal file shape (a browser File satisfies it). */
export type BriefFile = { name: string; size: number; lastModified: number };

export const BRIEF_FILE_RULES = {
  /** Figma screen copy: PDF, DOCX, XLSX, PPTX, JPG, PNG ("JPG" includes .jpeg). */
  extensions: [".pdf", ".docx", ".xlsx", ".pptx", ".jpg", ".jpeg", ".png"],
  maxFiles: 3,
  /** 10 MiB (Figma: shown to users as "10 MB"). */
  maxBytes: 10 * 1024 * 1024,
} as const;

/** `accept` attribute for the file input (extensions; the browser picker may still allow "All files"). */
export const BRIEF_FILE_ACCEPT = BRIEF_FILE_RULES.extensions.join(",");

/** Approved 2026-11-10 (replaces Figma's outdated ".docx, .xlsx or .pdf" error copy). */
export const BRIEF_FILE_MESSAGES = {
  type: "This file type isn't supported. Upload a PDF, DOCX, XLSX, PPTX, JPG or PNG file.",
  size: "Each file must be 10 MB or smaller.",
  count: "You can upload up to 3 files.",
  duplicate: "This file has already been added.",
} as const;

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return BRIEF_FILE_RULES.extensions.some((ext) => lower.endsWith(ext));
}

const sameFile = (a: BriefFile, b: BriefFile) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Adds `incoming` to `current` in order, skipping invalid, duplicate and over-limit files.
 * Returns the new list and the first problem found (to show under the dropzone), or null.
 */
export function addBriefFiles<T extends BriefFile>(current: readonly T[], incoming: readonly T[]): { files: T[]; error: string | null } {
  const files = [...current];
  let error: string | null = null;
  const note = (message: string) => {
    error ??= message;
  };
  for (const file of incoming) {
    if (!hasAllowedExtension(file.name)) note(BRIEF_FILE_MESSAGES.type);
    else if (file.size > BRIEF_FILE_RULES.maxBytes) note(BRIEF_FILE_MESSAGES.size);
    else if (files.some((f) => sameFile(f, file))) note(BRIEF_FILE_MESSAGES.duplicate);
    else if (files.length >= BRIEF_FILE_RULES.maxFiles) note(BRIEF_FILE_MESSAGES.count);
    else files.push(file);
  }
  return { files, error };
}

/** "842 KB", "3.4 MB" (1 KB = 1024 bytes, matching the 10 MiB limit). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
