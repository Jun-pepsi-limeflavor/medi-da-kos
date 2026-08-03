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
