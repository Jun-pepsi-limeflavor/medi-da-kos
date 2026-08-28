import { z } from "zod";

// ============================================================================
// Money & FX
// ============================================================================

export const moneySchema = z.object({
  amount: z
    .number()
    .finite({ message: "금액은 유한한 수여야 합니다" })
    .nonnegative({ message: "금액은 0 이상이어야 합니다" }),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, { message: "통화는 3자리 영문 대문자여야 합니다" }),
});

export type Money = z.infer<typeof moneySchema>;

export const fxSnapshotSchema = z.object({
  rate: z.number().positive({ message: "환율은 양수여야 합니다" }),
  base: z
    .string()
    .regex(/^[A-Z]{3}$/, { message: "기본 통화는 3자리 영문 대문자여야 합니다" }),
  quote: z
    .string()
    .regex(/^[A-Z]{3}$/, { message: "상대 통화는 3자리 영문 대문자여야 합니다" }),
  asOf: z.string().datetime({ message: "asOf는 ISO 8601 일시여야 합니다" }).or(z.string().min(1)),
  source: z.string().trim().min(1, { message: "환율 출처는 필수입니다" }),
});

export type FxSnapshot = z.infer<typeof fxSnapshotSchema>;

// ============================================================================
// SupplierQuote
// ============================================================================

export const supplierQuoteSchema = z.object({
  id: z.string().trim().min(1, { message: "견적 ID는 필수입니다" }),
  itemId: z.string().trim().min(1, { message: "제품 ID는 필수입니다" }),
  engagementId: z.string().trim().min(1, { message: "공급자 배정 ID는 필수입니다" }),
  version: z.number().int().positive({ message: "버전은 1 이상의 정수여야 합니다" }),
  quantityTier: z.number().int().positive({ message: "수량 구간은 1 이상의 정수여야 합니다" }),
  unitCost: moneySchema,
  shipping: moneySchema.optional(),
  incoterm: z.string().trim().optional(),
  validUntil: z.string().datetime().or(z.string()).optional(),
  sourceRefs: z.array(z.string().trim().min(1)).min(1, { message: "견적 근거는 최소 1개 이상이어야 합니다" }),
});

export type SupplierQuote = z.infer<typeof supplierQuoteSchema>;

// ============================================================================
// BuyerQuote & InternalCosts
// ============================================================================

export const buyerQuoteSchema = z.object({
  unitPrice: moneySchema,
  totalValue: moneySchema,
});

export type BuyerQuote = z.infer<typeof buyerQuoteSchema>;

export const internalCostItemSchema = z.object({
  category: z.string().trim().min(1, { message: "비용 항목은 필수입니다" }),
  amount: moneySchema,
  notes: z.string().trim().optional(),
});

export type InternalCostItem = z.infer<typeof internalCostItemSchema>;

// ============================================================================
// DealFinance
// ============================================================================

export const dealFinanceInputSchema = z.object({
  supplierQuotes: z.array(supplierQuoteSchema).default([]),
  buyerQuote: buyerQuoteSchema.optional(),
  internalCosts: z.array(internalCostItemSchema).default([]),
  fxSnapshot: fxSnapshotSchema.optional(),
  grossProfit: moneySchema.optional(),
  margin: z.number().optional(),
});

export const dealFinanceSchema = dealFinanceInputSchema.extend({
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type DealFinanceInput = z.infer<typeof dealFinanceInputSchema>;
export type DealFinance = z.infer<typeof dealFinanceSchema>;
