export type ProductCategory = "skincare" | "makeup";

export type PackagingType =
  | "bottle"
  | "tube"
  | "jar"
  | "closure"
  | "makeup"
  | "stick"
  | "kolmar-exclusive"
  | "accessory";

export type FragranceOption =
  | "green-tea"
  | "hypoallergenic"
  | "unscented"
  | "fragrance-free";

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
  category: ProductCategory;
}

export interface CMBriefStep2 {
  packaging: PackagingType[];
}

export interface CMBriefStep3 {
  logoFileName?: string;
  logoDataUrl?: string;
  previewPackaging?: PackagingType;
}

export interface CMBriefStep4 {
  volume: string;
  unit: "ml" | "g" | "oz";
  moq: string;
  sampleRequestDate: string;
  targetLaunchDate: string;
  shippingCountry: string;
}

export interface CMBriefStep5 {
  fragrance: FragranceOption;
  colorHex: string;
  viscosity: string;
  textureNotes?: string;
  finishNotes?: string;
}

export interface CMBriefStep6 {
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
