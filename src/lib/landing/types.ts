import type { CMBrief } from "@/lib/types";

export type LandingVariant = "catalog" | "dashboard" | "korea";

export interface LandingContactFields {
  companyName: string;
  contactName?: string;
  email: string;
  country?: string;
  expectedVolume: string;
  message?: string;
  referralSource?: string;
  businessType?: string;
  positioningArm?: string;
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
    | { landingVariant: "korea"; catalogItems?: never; dashboardBrief?: never }
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
  /** 제출 브라우저에서 boot된 Channel 고객 id. 얻지 못하면 넣지 않는다(서버가 server_lead로 처리). */
  channelUserId?: string;
}

export interface LandingRequestSubmission extends LandingContactFields, LandingRequestContext {
  landingVariant: LandingVariant;
  catalogItems?: LandingCatalogItem[];
  dashboardBrief?: Record<string, unknown>;
  isTest: boolean;
  status: "new";
  createdAt: string;
}
