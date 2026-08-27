import type { CMBrief } from "@/lib/types";

export type LandingVariant = "catalog" | "dashboard";

export interface LandingContactFields {
  companyName: string;
  contactName: string;
  email: string;
  country: string;
  expectedVolume: string;
  message?: string;
}

export interface LandingCatalogItem {
  id: string;
  name: string;
  category: "serum" | "toner" | "cream" | "mist";
}

export type LandingRequestInput = LandingContactFields &
  (
    | { landingVariant: "catalog"; catalogItems: LandingCatalogItem[]; dashboardBrief?: never }
    | { landingVariant: "dashboard"; dashboardBrief: CMBrief; catalogItems?: never }
  );

export interface LandingRequestContext {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl: string;
  gaClientId?: string;
  userAgent?: string;
}

export interface LandingRequestSubmission extends LandingContactFields, LandingRequestContext {
  landingVariant: LandingVariant;
  catalogItems?: LandingCatalogItem[];
  dashboardBrief?: Record<string, unknown>;
  isTest: boolean;
  status: "new";
  createdAt: string;
}
