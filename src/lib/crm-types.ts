import {
  BRAND_STAGES,
  FACTORY_STAGES,
  type BrandStage,
  type FactoryStage,
} from "@/lib/stages";
import type {
  Deal,
  DealDetails,
  DealItem,
  SupplierEngagement,
  SampleRound,
  Shipment,
  DealTask,
  DealEvent,
} from "@/lib/schemas/deal";

// Re-export core stages and deal types
export { BRAND_STAGES, FACTORY_STAGES };
export type {
  BrandStage,
  FactoryStage,
  Deal,
  DealDetails,
  DealItem,
  SupplierEngagement,
  SampleRound,
  Shipment,
  DealTask,
  DealEvent,
};

export type CrmBrandStageId = BrandStage["id"];
export type CrmFactoryStageId = FactoryStage["id"];

export interface CrmDeal {
  id: string;
  title?: string;
  reference?: string;
  buyerId?: string;
  buyerName?: string;
  buyerCountry?: string;
  supplierId?: string;
  supplierName?: string;
  pmName?: string;
  stageBrand?: number;
  priority?: "hot" | "warm" | "cold";
  buyerUnitPrice?: number;
  buyerTotalQty?: number;
  buyerTotalValue?: number;
  inquiryDate?: string;
  [key: string]: any;
}

// Stage color mappings for Kanban columns
export const CRM_BRAND_STAGE_COLORS: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-indigo-500",
  3: "bg-purple-500",
  4: "bg-amber-500",
  5: "bg-orange-500",
  6: "bg-emerald-500",
  7: "bg-teal-500",
  8: "bg-green-600",
};

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
