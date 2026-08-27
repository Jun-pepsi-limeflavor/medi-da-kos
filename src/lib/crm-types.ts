export type CrmStage =
  | "inquiry"
  | "spec_review"
  | "sourcing"
  | "sampling"
  | "quoting"
  | "po_confirmed"
  | "production"
  | "shipping";

export interface StageInfo {
  id: CrmStage;
  label: string;
  subLabel: string;
  color: string;
  pct: number;
}

export const CRM_STAGES: StageInfo[] = [
  { id: "inquiry", label: "새 문의", subLabel: "Inquiry Received", color: "bg-blue-500", pct: 5 },
  { id: "spec_review", label: "사양 확인", subLabel: "Spec Review", color: "bg-indigo-500", pct: 10 },
  { id: "sourcing", label: "소싱 & 매칭", subLabel: "Sourcing & Match", color: "bg-purple-500", pct: 20 },
  { id: "sampling", label: "샘플 진행", subLabel: "Sampling", color: "bg-amber-500", pct: 35 },
  { id: "quoting", label: "견적 & 협상", subLabel: "Quote & Negotiate", color: "bg-orange-500", pct: 50 },
  { id: "po_confirmed", label: "PO 확정", subLabel: "PO Confirmed", color: "bg-emerald-500", pct: 70 },
  { id: "production", label: "생산 & QC", subLabel: "Production & QC", color: "bg-teal-500", pct: 85 },
  { id: "shipping", label: "출하 & 정산", subLabel: "Shipping & Settle", color: "bg-green-600", pct: 100 },
];

export interface ProductSpec {
  productType: string;
  volumeMl: number;
  containerType: string;
  keyIngredients: string[];
  regulatoryNotes?: string;
  sampleStatus: "not_started" | "in_formulation" | "produced" | "shipped" | "approved" | "revision_needed";
}

export interface CrmDeal {
  id: string;
  title: string;
  buyerId: string;
  buyerName: string;
  buyerCountry: string;
  supplierId?: string;
  supplierName?: string;
  pmName: string;
  stage: CrmStage;
  priority: "hot" | "warm" | "cold";
  
  // Revenue (Buyer side)
  buyerUnitPrice: number; // USD
  buyerTotalQty: number;
  buyerTotalValue: number; // USD
  
  // Cost (Supplier side - Internal)
  supplierUnitPrice: number; // KRW
  supplierTotalCost: number; // KRW
  shippingCostUsd: number;
  
  // Computed Margin
  grossProfitUsd: number;
  marginPct: number;
  
  productSpec: ProductSpec;
  
  // Timeline
  inquiryDate: string;
  sampleSentDate?: string;
  poDate?: string;
  expectedCloseDate?: string;
  
  updatedAt: string;
}

export interface CrmMessage {
  id: string;
  dealId: string;
  senderType: "buyer" | "pm" | "supplier" | "system";
  senderName: string;
  senderEmail?: string;
  content: string;
  timestamp: string;
  aiSummary?: string;
  actionRequired?: boolean;
}
