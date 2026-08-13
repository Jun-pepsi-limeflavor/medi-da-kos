export type ProductCategory = "skincare" | "cosmetic";

/** Step 1 choice: ODM category or RnD Agency pathway */
export type Step1Selection = ProductCategory | "rnd-agency";

export interface PackagingSelection {
  group: string;
  items: string[];
}

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

export interface ShippingAddress {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface CMBriefStep1 {
  /** @deprecated use selection — kept for Firestore migration */
  category?: ProductCategory;
  selection: Step1Selection;
  /** RnD survey answers — structure TBD */
  rndSurvey?: Record<string, unknown>;
}

export interface CMBriefStep2 {
  selections: PackagingSelection[];
}

export interface CMBriefStep3 {
  logoFileName?: string;
  logoDataUrl?: string;
  previewGroup?: string;
}

export interface CMBriefStep4 {
  volume: string;
  unit: "ml" | "g" | "oz";
  /** Units the customer wants to order */
  orderQuantity?: string;
  /** Customer hasn't decided the order quantity yet */
  orderQuantityTbd?: boolean;
  /** @deprecated use orderQuantity — kept for Firestore migration */
  moq?: string;
  sampleRequestDate: string;
  targetLaunchDate: string;
  shippingCountry: string;
}

export interface CMBriefStep5 {
  /** Desired scent direction (free text for R&D) */
  fragranceNotes?: string;
  /** No perceptible scent; masking fragrance may still be used */
  unscented?: boolean;
  /** No fragrance ingredients in the formula */
  fragranceFree?: boolean;
  colorHex: string;
  viscosity: string;
  textureNotes?: string;
  finishNotes?: string;
}

export interface CMBriefStep6 {
  productName?: string;
  vegan: boolean;
  functionalClaims: string[];
  conceptIngredients: string;
  restrictedIngredients: string;
  internationalCertifications: string[];
}

export interface CMBrief {
  uid: string;
  currentStep: number;
  requestType: "custom" | "sample";
  step1?: CMBriefStep1;
  step2?: CMBriefStep2;
  step3?: CMBriefStep3;
  step4?: CMBriefStep4;
  step5?: CMBriefStep5;
  step6?: CMBriefStep6;
  sampleProductId?: string;
  sampleProductName?: string;
  sampleQuantity?: number;
  shippingAddress?: ShippingAddress;
  status: "draft" | "submitted";
  updatedAt: string;
  createdAt: string;
}

export interface TrackingEntry {
  id: string;
  carrier: "FedEx" | "DHL" | "UPS" | "Other";
  trackingNumber: string;
  description: string;
  status: "in-transit" | "delivered" | "pending";
  updatedAt: string;
}

export interface TopProduct {
  id: string;
  rank: number;
  nameEn: string;
  nameKo: string;
  volume: string;
  image: string;
  category: ProductCategory;
}

export interface SampleRequest {
  id: string;
  uid: string;
  sampleProductId: string;
  sampleProductName: string;
  sampleQuantity: number;
  shippingAddress: ShippingAddress;
  status: "submitted";
  createdAt: string;
}

export interface Order {
  id: string;
  uid: string;
  type: "custom" | "sample";
  status: "submitted" | "in-review" | "in-production" | "shipped";
  title: string;
  summary: string;
  referenceId?: string;
  /** CM brief fields at submit time (logo binary omitted) */
  briefSnapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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
  status: "submitted";
  createdAt: string;
}

/** /korea 콜드메일 랜딩 문의 — contact와 별도 컬렉션(koreaLeads) */
export interface KoreaLeadSubmission {
  id: string;
  companyName: string;
  email: string;
  referralSource?: string;
  businessType?: string;
  expectedVolume: string;
  expectedVolumeLabel: string;
  message: string;
  /** utm_content로 결정된 포지셔닝 문단 — "arm-a" | "arm-b" */
  positioningArm: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl?: string;
  gaClientId?: string;
  userAgent?: string;
  /** 운영 도메인 밖(localhost·프리뷰) 제출 — 알림·전환 집계에서 제외 */
  isTest: boolean;
  status: "submitted";
  createdAt: string;
}
