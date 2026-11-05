export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  country: string;
  companyName: string;
  provider: "email" | "google" | "mock";
  role?: "admin" | "user";
  createdAt: string;
}

export interface ContactSubmission {
  id: string;
  companyName: string;
  email: string;
  referralSource?: string;
  businessType?: string;
  message: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl?: string;
  gaClientId?: string;
  userAgent?: string;
  isTest?: boolean;
  status: "submitted";
  createdAt: string;
}
