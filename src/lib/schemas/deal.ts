import { z } from "zod";

// ============================================================================
// 1. DealItem (제품)
// ============================================================================

export const formulaSpecSchema = z
  .object({
    targetTexture: z.string().trim().optional(),
    keyIngredients: z.string().trim().optional(),
    scent: z.string().trim().optional(),
    color: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .default({});

export const packagingSpecSchema = z
  .object({
    containerType: z.string().trim().optional(),
    material: z.string().trim().optional(),
    closure: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .default({});

export const dealItemInputSchema = z.object({
  productType: z.string().trim().min(1, { message: "제품 종류는 필수입니다" }),
  variantName: z.string().trim().default(""),
  volume: z.string().trim().default(""),
  quantity: z.number().int().positive({ message: "수량은 1 이상의 정수여야 합니다" }),
  formulaSpec: formulaSpecSchema,
  packagingSpec: packagingSpecSchema,
});

export const dealItemSchema = dealItemInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DealItemInput = z.infer<typeof dealItemInputSchema>;
export type DealItem = z.infer<typeof dealItemSchema>;

// ============================================================================
// 2. SupplierEngagement (공급자 관계)
// ============================================================================

export const SUPPLIER_ENGAGEMENT_ROLES = [
  "formulation",
  "packaging",
  "filling",
  "testing",
  "logistics",
] as const;

export const supplierEngagementRoleSchema = z.enum(SUPPLIER_ENGAGEMENT_ROLES);

export const CONTACT_STATUSES = ["ing", "fix", "drop"] as const;
export const contactStatusSchema = z.enum(CONTACT_STATUSES);

export const contactPersonSnapshotSchema = z.object({
  name: z.string().trim().min(1, { message: "담당자 이름은 필수입니다" }),
  title: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().min(1, { message: "담당자 이메일은 필수입니다" }),
  phone: z.string().trim().optional(),
});

export const ipTermsSchema = z
  .object({
    ownership: z.enum(["buyer", "supplier", "shared"]).optional(),
    exclusivityMonths: z.number().int().nonnegative().optional(),
    techTransfer: z.boolean().optional(),
  })
  .optional();

export const supplierEngagementInputSchema = z.object({
  supplierId: z.string().trim().min(1, { message: "공급자 ID는 필수입니다" }),
  roles: z.array(supplierEngagementRoleSchema).min(1, { message: "역할은 최소 1개 이상이어야 합니다" }),
  contactStatus: contactStatusSchema.default("ing"),
  stageFactory: z.number().int().min(1).max(9).default(1),
  contactPersonSnapshot: contactPersonSnapshotSchema,
  moq: z.number().int().nonnegative().optional(),
  leadTime: z.string().trim().optional(),
  supportedCerts: z.array(z.string().trim()).default([]),
  notes: z.string().trim().optional(),
  ipTerms: ipTermsSchema,
});

export const supplierEngagementPatchSchema = supplierEngagementInputSchema
  .partial()
  .omit({ supplierId: true, stageFactory: true });

export const supplierEngagementSchema = supplierEngagementInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SupplierEngagementInput = z.infer<typeof supplierEngagementInputSchema>;
export type SupplierEngagement = z.infer<typeof supplierEngagementSchema>;

// ============================================================================
// 3. SampleRound (샘플 회차)
// ============================================================================

export const QC_STATUSES = ["pending", "passed", "failed", "waived"] as const;
export const qcStatusSchema = z.enum(QC_STATUSES);

export const SAMPLE_VERDICTS = ["approved", "revision", "dropped"] as const;
export const sampleVerdictSchema = z.enum(SAMPLE_VERDICTS);

const sampleRoundRawSchema = z.object({
  itemId: z.string().trim().min(1, { message: "제품 ID는 필수입니다" }),
  engagementId: z.string().trim().min(1, { message: "공급자 관계 ID는 필수입니다" }),
  supplierId: z.string().trim().min(1, { message: "공급자 ID는 필수입니다" }),
  roundNo: z.number().int().positive({ message: "회차 번호는 1 이상의 정수여야 합니다" }),
  requestNotes: z.string().trim().optional(),
  producedQty: z.number().int().nonnegative().optional(),
  retainedQty: z.number().int().nonnegative().optional(),
  receivedAt: z.string().optional(),
  qcStatus: qcStatusSchema.default("pending"),
  qcNotes: z.string().trim().optional(),
  qcWaiverReason: z.string().trim().optional(),
  verdict: sampleVerdictSchema.optional(),
  feedbackAt: z.string().optional(),
  feedbackNotes: z.string().trim().optional(),
});

function refineSampleRound(
  value: {
    producedQty?: number;
    retainedQty?: number;
    qcStatus: "pending" | "passed" | "failed" | "waived";
    qcWaiverReason?: string;
  },
  ctx: z.RefinementCtx
) {
  if (value.producedQty !== undefined && value.retainedQty !== undefined) {
    if (value.retainedQty > value.producedQty) {
      ctx.addIssue({
        code: "custom",
        path: ["retainedQty"],
        message: "보관 수량은 생산 수량을 초과할 수 없습니다",
      });
    }
  }
  if (value.qcStatus === "waived") {
    if (!value.qcWaiverReason || value.qcWaiverReason.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["qcWaiverReason"],
        message: "QC 면제 시 면제 사유는 필수입니다",
      });
    }
  }
}

export const sampleRoundInputSchema = sampleRoundRawSchema.superRefine(refineSampleRound);
// Patch schemas intentionally have no defaults: an omitted field must not reset
// stored state while an admin changes an unrelated field.
export const sampleRoundPatchSchema = z.object({
  requestNotes: z.string().trim().optional(),
  producedQty: z.number().int().nonnegative().optional(),
  retainedQty: z.number().int().nonnegative().optional(),
  receivedAt: z.string().optional(),
  qcStatus: qcStatusSchema.optional(),
  qcNotes: z.string().trim().optional(),
  qcWaiverReason: z.string().trim().optional(),
  verdict: sampleVerdictSchema.optional(),
  feedbackAt: z.string().optional(),
  feedbackNotes: z.string().trim().optional(),
});

export const sampleRoundSchema = sampleRoundRawSchema
  .extend({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine(refineSampleRound);

export type SampleRoundInput = z.infer<typeof sampleRoundInputSchema>;
export type SampleRoundPatch = z.infer<typeof sampleRoundPatchSchema>;
export type SampleRound = z.infer<typeof sampleRoundSchema>;

export function sampleRoundDocId(itemId: string, roundNo: number): string {
  return Buffer.from(`${itemId}\0${roundNo}`, "utf8").toString("base64url");
}

// ============================================================================
// 4. Shipment (배송 구간)
// ============================================================================

export const SHIPMENT_KINDS = ["sample", "main"] as const;
export const shipmentKindSchema = z.enum(SHIPMENT_KINDS);

export const SHIPMENT_ROUTES = [
  "supplier_to_hq",
  "hq_to_buyer",
  "supplier_to_buyer",
] as const;
export const shipmentRouteSchema = z.enum(SHIPMENT_ROUTES);

export const SHIPMENT_STATUSES = [
  "preparing",
  "shipped",
  "in_transit",
  "delivered",
  "failed",
] as const;
export const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);

export const shipmentAddressSnapshotSchema = z.object({
  recipientName: z.string().trim().min(1, { message: "수령인 이름은 필수입니다" }),
  address: z.string().trim().min(1, { message: "주소는 필수입니다" }),
  country: z.string().trim().min(1, { message: "국가는 필수입니다" }),
  phone: z.string().trim().optional(),
});

export const shipmentCustomsSnapshotSchema = z
  .object({
    customsCode: z.string().trim().optional(),
    declaredValue: z.number().optional(),
    currency: z.string().trim().optional(),
  })
  .optional();

const shipmentRawSchema = z.object({
  kind: shipmentKindSchema,
  route: shipmentRouteSchema,
  engagementId: z.string().trim().optional(),
  sampleRoundId: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  carrier: z.string().trim().optional(),
  status: shipmentStatusSchema.default("preparing"),
  shippedAt: z.string().optional(),
  deliveredAt: z.string().optional(),
  addressSnapshot: shipmentAddressSnapshotSchema,
  customsSnapshot: shipmentCustomsSnapshotSchema,
});

function refineShipment(
  value: {
    kind: "sample" | "main";
    route: "supplier_to_hq" | "hq_to_buyer" | "supplier_to_buyer";
    engagementId?: string;
    sampleRoundId?: string;
  },
  ctx: z.RefinementCtx
) {
  if (value.kind === "sample") {
    if (!value.sampleRoundId || value.sampleRoundId.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sampleRoundId"],
        message: "샘플 배송에는 sampleRoundId가 필수입니다",
      });
    }
  }
  if (value.kind === "main") {
    if (value.sampleRoundId && value.sampleRoundId.trim().length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sampleRoundId"],
        message: "본품 배송에는 sampleRoundId를 지정할 수 없습니다",
      });
    }
  }
  const supplierOrigin = value.route === "supplier_to_hq" || value.route === "supplier_to_buyer";
  if (supplierOrigin && !value.engagementId) {
    ctx.addIssue({
      code: "custom",
      path: ["engagementId"],
      message: "공급자 출발 배송에는 engagementId가 필수입니다",
    });
  }
  if (value.route === "hq_to_buyer" && value.engagementId) {
    ctx.addIssue({
      code: "custom",
      path: ["engagementId"],
      message: "HQ 출발 배송에는 engagementId를 지정할 수 없습니다",
    });
  }
}

export const shipmentInputSchema = shipmentRawSchema.superRefine(refineShipment);
export const shipmentPatchSchema = z.object({
  trackingNumber: z.string().trim().optional(),
  carrier: z.string().trim().optional(),
  status: shipmentStatusSchema.optional(),
  shippedAt: z.string().optional(),
  deliveredAt: z.string().optional(),
  addressSnapshot: shipmentAddressSnapshotSchema.optional(),
  customsSnapshot: shipmentCustomsSnapshotSchema.optional(),
});

export const shipmentSchema = shipmentRawSchema
  .extend({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine(refineShipment);

export type ShipmentInput = z.infer<typeof shipmentInputSchema>;
export type ShipmentPatch = z.infer<typeof shipmentPatchSchema>;
export type Shipment = z.infer<typeof shipmentSchema>;

// ============================================================================
// 5. DealTask (작업)
// ============================================================================

export const DEAL_TASK_WAITING_ON = ["us", "buyer", "supplier", "carrier"] as const;
export const dealTaskWaitingOnSchema = z.enum(DEAL_TASK_WAITING_ON);

export const DEAL_TASK_STATUSES = ["open", "done", "canceled"] as const;
export const dealTaskStatusSchema = z.enum(DEAL_TASK_STATUSES);

export const dealTaskInputSchema = z.object({
  type: z.string().trim().min(1, { message: "작업 유형은 필수입니다" }),
  summary: z.string().trim().min(1, { message: "작업 요약은 필수입니다" }),
  ownerId: z.string().trim().min(1, { message: "담당자 ID는 필수입니다" }),
  waitingOn: dealTaskWaitingOnSchema,
  dueAt: z.string().optional(),
  status: dealTaskStatusSchema.default("open"),
  sourceMessageId: z.string().trim().optional(),
});

export const dealTaskSchema = dealTaskInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  completedAt: z.string().optional(),
  completedBy: z.string().optional(),
});

export type DealTaskInput = z.infer<typeof dealTaskInputSchema>;
export type DealTask = z.infer<typeof dealTaskSchema>;

// ============================================================================
// 6. DealEvent (이벤트 로그)
// ============================================================================

export const DEAL_EVENT_TYPES = ["note", "stage", "override"] as const;
export const dealEventTypeSchema = z.enum(DEAL_EVENT_TYPES);

export const dealEventSchema = z.object({
  id: z.string().optional(),
  type: dealEventTypeSchema,
  actor: z.string().trim().min(1),
  at: z.string(),
  body: z.string().trim().optional(),
  from: z.number().int().optional(),
  to: z.number().int().optional(),
  reason: z.string().trim().optional(),
  sourceRefs: z.array(z.string()).default([]),
});

export type DealEvent = z.infer<typeof dealEventSchema>;

// ============================================================================
// 7. Deal Core (딜 기본 원장)
// ============================================================================

export const dealPaymentSubSchema = z.object({
  status: z.enum(["unpaid", "partial", "paid", "refunded"]).default("unpaid"),
  escrowStatus: z.enum(["none", "initiated", "funded", "released"]).optional(),
  paidAt: z.string().optional(),
});

export const dealPaymentSchema = z
  .object({
    samplePayment: dealPaymentSubSchema.default({ status: "unpaid" }),
    mainPayment: dealPaymentSubSchema.default({ status: "unpaid" }),
  })
  .default({
    samplePayment: { status: "unpaid" },
    mainPayment: { status: "unpaid" },
  });

export const dealBuyerInfoSchema = z.object({
  companyName: z.string().trim().min(1, { message: "바이어 회사명은 필수입니다" }),
  contactName: z.string().trim().min(1, { message: "바이어 담당자명은 필수입니다" }),
  email: z.string().trim().toLowerCase().min(1, { message: "바이어 이메일은 필수입니다" }),
  phone: z.string().trim().optional(),
  country: z.string().trim().min(1, { message: "바이어 국가는 필수입니다" }),
});

export const dealShippingInfoSchema = z.object({
  recipientName: z.string().trim().min(1, { message: "수령인명은 필수입니다" }),
  addressLine1: z.string().trim().min(1, { message: "주소(Line1)는 필수입니다" }),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().default(""),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().default(""),
  country: z.string().trim().min(1, { message: "배송 국가는 필수입니다" }),
  phone: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
});

export const dealTimelineSchema = z
  .object({
    targetDeliveryDate: z.string().optional(),
    targetSampleDate: z.string().optional(),
    notes: z.string().trim().optional(),
  })
  .default({});

export const dealInputSchema = z.object({
  reference: z.string().trim().min(1, { message: "레퍼런스는 필수입니다" }),
  intakeReviewId: z.string().trim().min(1, { message: "인테이크 리뷰 ID는 필수입니다" }),
  buyerId: z.string().trim().min(1, { message: "바이어 ID는 필수입니다" }),
  stageBrand: z.number().int().min(1).max(8).default(1),
  sourceRefs: z.array(z.string()).default([]),
  buyerInfo: dealBuyerInfoSchema,
  shippingInfo: dealShippingInfoSchema,
  items: z.array(dealItemInputSchema).default([]),
  certifications: z.array(z.string().trim()).default([]),
  timeline: dealTimelineSchema,
  additionalRequests: z.string().trim().default(""),
  payment: dealPaymentSchema,
  ownerIds: z.array(z.string().trim()).default([]),
  supplierIds: z.array(z.string().trim()).default([]),
});

export const dealSchema = dealInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

export type DealInput = z.infer<typeof dealInputSchema>;
export type Deal = z.infer<typeof dealSchema>;

export interface DealDetails {
  deal: Deal;
  items: DealItem[];
  supplierEngagements: SupplierEngagement[];
  sampleRounds: SampleRound[];
  shipments: Shipment[];
  tasks: DealTask[];
  events: DealEvent[];
}
