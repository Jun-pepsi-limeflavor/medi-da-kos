export const REFERRAL_SOURCES = [
  "Search (Google, Bing, etc.)",
  "I saw an ad",
  "Social Media",
  "A friend",
  "Events",
  "Other",
] as const;

export const BUSINESS_TYPES = [
  "Salon, Spa, Esthetician, MUA",
  "Existing Beauty Brand",
  "Influencer / Creator",
  "Agency",
  "New Entrepreneur",
  "Other",
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** /korea 랜딩 폼 전용 — 첫 생산 예상 물량 */
export const EXPECTED_VOLUMES = [
  { value: "under-5k", label: "About 5,000 units" },
  { value: "5k-10k", label: "5,000 – 10,000 units" },
  { value: "10k-plus", label: "10,000 units and up" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export type ExpectedVolume = (typeof EXPECTED_VOLUMES)[number]["value"];

/** 알림 메일에서 코드값 대조 없이 읽히도록 라벨을 같이 저장한다. */
export function expectedVolumeLabel(value: string): string {
  return EXPECTED_VOLUMES.find((item) => item.value === value)?.label ?? value;
}
