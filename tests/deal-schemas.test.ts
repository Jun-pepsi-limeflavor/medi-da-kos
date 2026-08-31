import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dealItemInputSchema,
  dealItemSchema,
  supplierEngagementInputSchema,
  supplierEngagementPatchSchema,
  supplierEngagementSchema,
  sampleRoundInputSchema,
  sampleRoundPatchSchema,
  sampleRoundSchema,
  sampleRoundDocId,
  shipmentInputSchema,
  shipmentPatchSchema,
  shipmentSchema,
  dealTaskInputSchema,
  dealTaskSchema,
  dealInputSchema,
  dealSchema,
} from "../src/lib/schemas/deal.ts";
import {
  moneySchema,
  fxSnapshotSchema,
  supplierQuoteSchema,
  internalCostItemSchema,
  dealFinanceInputSchema,
  dealFinanceSchema,
} from "../src/lib/schemas/deal-finance.ts";

// ============================================================================
// 1. DealItem Schema Tests
// ============================================================================

test("dealItemInputSchema: 정상 입력을 파싱한다", () => {
  const input = {
    productType: "수분크림",
    variantName: "민감성용 50ml",
    volume: "50ml",
    quantity: 1000,
    formulaSpec: {
      targetTexture: "젤 크림",
      keyIngredients: "히알루론산, 세라마이드",
      scent: "무향",
      color: "반투명 흰색",
      notes: "흡수가 빨라야 함",
    },
    packagingSpec: {
      containerType: "자(Jar) 용기",
      material: "유리",
      closure: "스크류 캡",
      notes: "은박 실링 필수",
    },
  };

  const parsed = dealItemInputSchema.parse(input);
  assert.equal(parsed.productType, "수분크림");
  assert.equal(parsed.quantity, 1000);
  assert.equal(parsed.formulaSpec.targetTexture, "젤 크림");
  assert.equal(parsed.packagingSpec.containerType, "자(Jar) 용기");
});

test("dealItemInputSchema: 기본값과 선택 항목을 올바르게 처리한다", () => {
  const parsed = dealItemInputSchema.parse({
    productType: "세럼",
    quantity: 500,
  });
  assert.equal(parsed.productType, "세럼");
  assert.equal(parsed.variantName, "");
  assert.equal(parsed.volume, "");
  assert.equal(parsed.quantity, 500);
  assert.deepEqual(parsed.formulaSpec, {});
  assert.deepEqual(parsed.packagingSpec, {});
});

test("dealItemInputSchema: 필수 필드 누락이나 잘못된 수량을 거부한다", () => {
  assert.throws(() => dealItemInputSchema.parse({ productType: "", quantity: 100 }));
  assert.throws(() => dealItemInputSchema.parse({ productType: "크림", quantity: 0 }));
  assert.throws(() => dealItemInputSchema.parse({ productType: "크림", quantity: -10 }));
  assert.throws(() => dealItemInputSchema.parse({ productType: "크림", quantity: 1.5 }));
});

test("dealItemSchema: ID와 타임스탬프를 포함한 완전한 엔티티를 검증한다", () => {
  const entity = {
    id: "item_123",
    productType: "토너",
    variantName: "대용량",
    volume: "200ml",
    quantity: 2000,
    formulaSpec: {},
    packagingSpec: {},
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
  };
  const parsed = dealItemSchema.parse(entity);
  assert.equal(parsed.id, "item_123");
});

// ============================================================================
// 2. SupplierEngagement Schema Tests
// ============================================================================

test("supplierEngagementInputSchema: 정상적인 공급자 배정 입력을 검증한다", () => {
  const input = {
    supplierId: "sup_greencos",
    roles: ["formulation", "filling"] as const,
    contactStatus: "ing" as const,
    stageFactory: 2,
    contactPersonSnapshot: {
      name: "김철수",
      title: "영업팀장",
      email: "CS.KIM@greencos.co.kr",
      phone: "010-1234-5678",
    },
    moq: 3000,
    leadTime: "6주",
    supportedCerts: ["CGMP", "ISO 22716"],
    notes: "초도 생산 할인 협의",
    ipTerms: {
      ownership: "buyer" as const,
      exclusivityMonths: 12,
      techTransfer: true,
    },
  };

  const parsed = supplierEngagementInputSchema.parse(input);
  assert.equal(parsed.supplierId, "sup_greencos");
  assert.deepEqual(parsed.roles, ["formulation", "filling"]);
  assert.equal(parsed.contactPersonSnapshot.email, "cs.kim@greencos.co.kr");
  assert.equal(parsed.stageFactory, 2);
  assert.equal(parsed.ipTerms?.ownership, "buyer");
});

test("supplierEngagementInputSchema: roles가 비어있으면 거부한다", () => {
  assert.throws(() =>
    supplierEngagementInputSchema.parse({
      supplierId: "sup_1",
      roles: [],
      contactPersonSnapshot: { name: "홍길동", email: "h@a.com" },
    })
  );
});

test("supplierEngagementInputSchema: stageFactory는 1~9 사이 정수여야 한다", () => {
  const base = {
    supplierId: "sup_1",
    roles: ["formulation"] as const,
    contactPersonSnapshot: { name: "홍길동", email: "h@a.com" },
  };

  assert.equal(supplierEngagementInputSchema.parse(base).stageFactory, 1);
  assert.equal(supplierEngagementInputSchema.parse({ ...base, stageFactory: 9 }).stageFactory, 9);
  assert.throws(() => supplierEngagementInputSchema.parse({ ...base, stageFactory: 0 }));
  assert.throws(() => supplierEngagementInputSchema.parse({ ...base, stageFactory: 10 }));
  assert.throws(() => supplierEngagementInputSchema.parse({ ...base, stageFactory: 2.5 }));
});

test("supplierEngagementPatchSchema: 메모(notes) 단독 수정을 정상 파싱한다", () => {
  const patch = {
    notes: "2026-08-28: 1차 샘플 제조 착수, 배송 예정일 9/5",
  };

  const parsed = supplierEngagementPatchSchema.parse(patch);
  assert.equal(parsed.notes, "2026-08-28: 1차 샘플 제조 착수, 배송 예정일 9/5");
});

test("supplierEngagementPatchSchema: supplierId와 stageFactory는 패치에서 제외된다", () => {
  const patch = {
    supplierId: "sup_new",
    stageFactory: 5,
    notes: "메모 변경",
  };

  const parsed = supplierEngagementPatchSchema.parse(patch);
  assert.equal(parsed.notes, "메모 변경");
  assert.equal((parsed as Record<string, unknown>).supplierId, undefined);
  assert.equal((parsed as Record<string, unknown>).stageFactory, undefined);
});

// ============================================================================
// 3. SampleRound Schema Tests
// ============================================================================

test("sampleRoundInputSchema: 정상 입력을 파싱한다", () => {
  const input = {
    itemId: "item_01",
    engagementId: "eng_01",
    supplierId: "sup_01",
    roundNo: 1,
    requestNotes: "1차 제형 샘플 의뢰",
    producedQty: 10,
    retainedQty: 2,
    receivedAt: "2026-08-20T10:00:00Z",
    qcStatus: "passed" as const,
    qcNotes: "제형 및 점도 양호",
    verdict: "approved" as const,
  };

  const parsed = sampleRoundInputSchema.parse(input);
  assert.equal(parsed.roundNo, 1);
  assert.equal(parsed.qcStatus, "passed");
  assert.equal(parsed.verdict, "approved");
});

test("sampleRoundInputSchema: roundNo는 양의 정수여야 한다", () => {
  const base = {
    itemId: "item_01",
    engagementId: "eng_01",
    supplierId: "sup_01",
  };

  assert.throws(() => sampleRoundInputSchema.parse({ ...base, roundNo: 0 }));
  assert.throws(() => sampleRoundInputSchema.parse({ ...base, roundNo: -1 }));
  assert.throws(() => sampleRoundInputSchema.parse({ ...base, roundNo: 1.2 }));
  assert.equal(sampleRoundInputSchema.parse({ ...base, roundNo: 1 }).roundNo, 1);
});

test("sampleRoundInputSchema: retainedQty는 producedQty를 초과할 수 없다", () => {
  const base = {
    itemId: "item_01",
    engagementId: "eng_01",
    supplierId: "sup_01",
    roundNo: 1,
  };

  // retainedQty <= producedQty: 통과
  assert.doesNotThrow(() =>
    sampleRoundInputSchema.parse({ ...base, producedQty: 10, retainedQty: 10 })
  );
  assert.doesNotThrow(() =>
    sampleRoundInputSchema.parse({ ...base, producedQty: 10, retainedQty: 3 })
  );

  // retainedQty > producedQty: 거부
  assert.throws(
    () => sampleRoundInputSchema.parse({ ...base, producedQty: 5, retainedQty: 6 }),
    /보관 수량은 생산 수량을 초과할 수 없습니다/
  );

  // 한쪽만 지정된 경우: 통과
  assert.doesNotThrow(() => sampleRoundInputSchema.parse({ ...base, retainedQty: 5 }));
  assert.doesNotThrow(() => sampleRoundInputSchema.parse({ ...base, producedQty: 5 }));
});

test("sampleRoundInputSchema: qcStatus가 waived이면 qcWaiverReason이 필수다", () => {
  const base = {
    itemId: "item_01",
    engagementId: "eng_01",
    supplierId: "sup_01",
    roundNo: 1,
  };

  // waived인데 사유 없음: 거부
  assert.throws(
    () => sampleRoundInputSchema.parse({ ...base, qcStatus: "waived" }),
    /QC 면제 시 면제 사유는 필수입니다/
  );
  assert.throws(
    () => sampleRoundInputSchema.parse({ ...base, qcStatus: "waived", qcWaiverReason: "   " }),
    /QC 면제 시 면제 사유는 필수입니다/
  );

  // waived인데 사유 있음: 통과
  const parsed = sampleRoundInputSchema.parse({
    ...base,
    qcStatus: "waived",
    qcWaiverReason: "바이어 직접 테스트 및 공장 직송 합의",
  });
  assert.equal(parsed.qcStatus, "waived");
  assert.equal(parsed.qcWaiverReason, "바이어 직접 테스트 및 공장 직송 합의");

  // 다른 상태(passed, failed, pending)는 waiverReason 불필요
  assert.doesNotThrow(() => sampleRoundInputSchema.parse({ ...base, qcStatus: "passed" }));
  assert.doesNotThrow(() => sampleRoundInputSchema.parse({ ...base, qcStatus: "pending" }));
  assert.doesNotThrow(() => sampleRoundInputSchema.parse({ ...base, qcStatus: "failed" }));
});

test("sampleRoundDocId: base64url(itemId + NUL + roundNo) 결정적 인코딩을 생성한다", () => {
  const id1 = sampleRoundDocId("item_abc", 1);
  const id2 = sampleRoundDocId("item_abc", 2);
  const id3 = sampleRoundDocId("item_xyz", 1);

  assert.equal(typeof id1, "string");
  assert.notEqual(id1, id2);
  assert.notEqual(id1, id3);

  // 디코딩 검증
  const decoded = Buffer.from(id1, "base64url").toString("utf8");
  assert.equal(decoded, "item_abc\x001");
});

// ============================================================================
// 4. Shipment Schema Tests
// ============================================================================

test("shipmentInputSchema: 샘플 배송(kind='sample')은 sampleRoundId가 필수다", () => {
  const base = {
    kind: "sample" as const,
    route: "hq_to_buyer" as const,
    trackingNumber: "TRK123456",
    addressSnapshot: {
      recipientName: "Jane Doe",
      address: "123 Main St, New York, NY",
      country: "USA",
    },
  };

  // sampleRoundId 누락: 거부
  assert.throws(
    () => shipmentInputSchema.parse(base),
    /샘플 배송에는 sampleRoundId가 필수입니다/
  );
  assert.throws(
    () => shipmentInputSchema.parse({ ...base, sampleRoundId: "   " }),
    /샘플 배송에는 sampleRoundId가 필수입니다/
  );

  // sampleRoundId 포함: 통과
  const parsed = shipmentInputSchema.parse({ ...base, sampleRoundId: "round_01" });
  assert.equal(parsed.kind, "sample");
  assert.equal(parsed.sampleRoundId, "round_01");
});

test("shipmentInputSchema: 본품 배송(kind='main')은 sampleRoundId를 지정할 수 없다", () => {
  const base = {
    kind: "main" as const,
    route: "supplier_to_buyer" as const,
    engagementId: "eng_01",
    trackingNumber: "MAIN987654",
    addressSnapshot: {
      recipientName: "Jane Doe",
      address: "123 Main St, New York, NY",
      country: "USA",
    },
  };

  // sampleRoundId 없음: 통과
  const parsed = shipmentInputSchema.parse(base);
  assert.equal(parsed.kind, "main");
  assert.equal(parsed.sampleRoundId, undefined);

  // sampleRoundId 포함: 거부
  assert.throws(
    () => shipmentInputSchema.parse({ ...base, sampleRoundId: "round_01" }),
    /본품 배송에는 sampleRoundId를 지정할 수 없습니다/
  );
});

test("shipmentInputSchema: 공급자 출발 배송은 engagementId가 필수이고 HQ 출발에는 금지된다", () => {
  const base = {
    kind: "main" as const,
    route: "supplier_to_buyer" as const,
    trackingNumber: "MAIN987654",
    addressSnapshot: {
      recipientName: "Jane Doe",
      address: "123 Main St, New York, NY",
      country: "USA",
    },
  };

  assert.throws(
    () => shipmentInputSchema.parse(base),
    /공급자 출발 배송에는 engagementId가 필수입니다/
  );
  assert.doesNotThrow(() => shipmentInputSchema.parse({ ...base, engagementId: "eng_01" }));
  assert.throws(
    () => shipmentInputSchema.parse({ ...base, route: "hq_to_buyer", engagementId: "eng_01" }),
    /HQ 출발 배송에는 engagementId를 지정할 수 없습니다/
  );
});

test("sampleRoundPatchSchema: item·공급자·engagement·회차 정체성은 수정할 수 없다", () => {
  assert.deepEqual(sampleRoundPatchSchema.parse({ qcStatus: "passed" }), { qcStatus: "passed" });
  assert.deepEqual(sampleRoundPatchSchema.parse({ itemId: "other", supplierId: "other", engagementId: "other", roundNo: 9 }), {});
});

test("shipmentPatchSchema: 배송 정체성과 경로는 수정할 수 없다", () => {
  assert.deepEqual(shipmentPatchSchema.parse({ trackingNumber: "NEW" }), { trackingNumber: "NEW" });
  assert.deepEqual(
    shipmentPatchSchema.parse({ kind: "sample", route: "supplier_to_buyer", engagementId: "other", sampleRoundId: "other" }),
    {}
  );
});

// ============================================================================
// 5. DealTask Schema Tests
// ============================================================================

test("dealTaskInputSchema: 작업 입력을 검증하고 기본값을 설정한다", () => {
  const input = {
    type: "sample_feedback",
    summary: "바이어 1차 샘플 피드백 수신 확인",
    ownerId: "admin_01",
    waitingOn: "buyer" as const,
  };

  const parsed = dealTaskInputSchema.parse(input);
  assert.equal(parsed.type, "sample_feedback");
  assert.equal(parsed.status, "open");
  assert.equal(parsed.waitingOn, "buyer");
});

test("dealTaskSchema: 완료 메타데이터가 포함된 전체 작업 문서를 파싱한다", () => {
  const task = {
    id: "task_01",
    type: "quote_check",
    summary: "공장 단가표 대조",
    ownerId: "admin_01",
    waitingOn: "us" as const,
    status: "done" as const,
    createdAt: "2026-08-20T00:00:00Z",
    createdBy: "admin@medidakos.com",
    completedAt: "2026-08-21T00:00:00Z",
    completedBy: "admin@medidakos.com",
  };

  const parsed = dealTaskSchema.parse(task);
  assert.equal(parsed.status, "done");
  assert.equal(parsed.completedBy, "admin@medidakos.com");
});

// ============================================================================
// 6. Deal Core Schema Tests
// ============================================================================

test("dealInputSchema: 정상적인 딜 생성 입력을 파싱한다", () => {
  const input = {
    reference: "MK-20260827-0001",
    intakeReviewId: "review_123",
    buyerId: "buyer_456",
    buyerInfo: {
      companyName: "Glow Cosmetics",
      contactName: "Alice Smith",
      email: "Alice@Glow.com",
      country: "USA",
    },
    shippingInfo: {
      recipientName: "Alice Smith",
      addressLine1: "500 5th Ave",
      city: "New York",
      postalCode: "10110",
      country: "USA",
    },
    additionalRequests: "비건 인증 가능 여부 확인 필요",
  };

  const parsed = dealInputSchema.parse(input);
  assert.equal(parsed.reference, "MK-20260827-0001");
  assert.equal(parsed.stageBrand, 1);
  assert.equal(parsed.buyerInfo.email, "alice@glow.com");
  assert.equal(parsed.payment.samplePayment.status, "unpaid");
  assert.equal(parsed.payment.mainPayment.status, "unpaid");
  assert.deepEqual(parsed.ownerIds, []);
  assert.deepEqual(parsed.supplierIds, []);
});

test("dealSchema: 서버 생성 필드를 포함한 딜 원장을 검증한다", () => {
  const deal = {
    id: "deal_789",
    reference: "MK-20260827-0001",
    intakeReviewId: "review_123",
    buyerId: "buyer_456",
    stageBrand: 1,
    sourceRefs: ["msg_001"],
    buyerInfo: {
      companyName: "Glow Cosmetics",
      contactName: "Alice Smith",
      email: "alice@glow.com",
      country: "USA",
    },
    shippingInfo: {
      recipientName: "Alice Smith",
      addressLine1: "500 5th Ave",
      city: "New York",
      postalCode: "10110",
      country: "USA",
    },
    certifications: ["VEGAN"],
    timeline: {},
    additionalRequests: "",
    payment: {
      samplePayment: { status: "unpaid" as const },
      mainPayment: { status: "unpaid" as const },
    },
    ownerIds: ["admin@medidakos.com"],
    supplierIds: ["sup_01"],
    createdAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
    createdBy: "admin@medidakos.com",
    updatedBy: "admin@medidakos.com",
  };

  const parsed = dealSchema.parse(deal);
  assert.equal(parsed.id, "deal_789");
  assert.deepEqual(parsed.items, []);
});

test("dealInputSchema: items가 포함된 신규 딜 개설 입력을 정상 검증한다", () => {
  const input = {
    reference: "House of Seoul Hydrating Cream 50ml PO",
    intakeReviewId: "review_intake_01",
    buyerId: "deem@example.com",
    stageBrand: 1,
    buyerInfo: {
      companyName: "House of Seoul",
      contactName: "Deem Alsaif",
      email: "deem@example.com",
      country: "미국 (USA)",
    },
    shippingInfo: {
      recipientName: "Deem Alsaif",
      addressLine1: "123 Ocean Ave",
      city: "San Francisco",
      country: "미국 (USA)",
      postalCode: "94105",
    },
    items: [
      {
        productType: "수분 진정 크림",
        variantName: "Hydro Calming",
        volume: "50ml",
        quantity: 3000,
        formulaSpec: {
          targetTexture: "촉촉한 젤 크림",
          keyIngredients: "병풀추출물, 히알루론산",
          scent: "무향 (Unscented)",
          color: "#E0F2FE",
        },
        packagingSpec: {
          containerType: "유리 자 (Glass Jar)",
          closure: "단상자 포함",
        },
      },
    ],
    certifications: ["CPNP", "FDA"],
    timeline: {
      targetSampleDate: "2026-09-15",
      targetDeliveryDate: "2026-11-30",
    },
    additionalRequests: "비건 인증 라벨 표기 필요",
    payment: {
      samplePayment: { status: "unpaid" as const },
      mainPayment: { status: "unpaid" as const },
    },
  };

  const parsed = dealInputSchema.parse(input);
  assert.equal(parsed.reference, "House of Seoul Hydrating Cream 50ml PO");
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].productType, "수분 진정 크림");
  assert.equal(parsed.items[0].quantity, 3000);
  assert.equal(parsed.items[0].formulaSpec.targetTexture, "촉촉한 젤 크림");
  assert.equal(parsed.items[0].packagingSpec.containerType, "유리 자 (Glass Jar)");
});

test("dealInputSchema: items 내 수량이 0 이하면 거부한다", () => {
  const invalid = {
    reference: "Test Ref",
    intakeReviewId: "review_01",
    buyerId: "test@example.com",
    buyerInfo: {
      companyName: "Test Co",
      contactName: "Tester",
      email: "test@example.com",
      country: "USA",
    },
    shippingInfo: {
      recipientName: "Tester",
      addressLine1: "123 St",
      country: "USA",
    },
    items: [
      {
        productType: "크림",
        quantity: 0,
        formulaSpec: {},
        packagingSpec: {},
      },
    ],
    payment: {
      samplePayment: { status: "unpaid" as const },
      mainPayment: { status: "unpaid" as const },
    },
  };

  assert.throws(() => dealInputSchema.parse(invalid));
});

// ============================================================================
// 7. Deal Finance Schema Tests
// ============================================================================

test("moneySchema: 유효한 금액과 3자리 대문자 통화를 파싱한다", () => {
  const valid = moneySchema.parse({ amount: 1500.5, currency: "USD" });
  assert.equal(valid.amount, 1500.5);
  assert.equal(valid.currency, "USD");

  const zero = moneySchema.parse({ amount: 0, currency: "KRW" });
  assert.equal(zero.amount, 0);

  // 음수 금액 거부
  assert.throws(() => moneySchema.parse({ amount: -10, currency: "USD" }));
  // 무한대 거부
  assert.throws(() => moneySchema.parse({ amount: Infinity, currency: "USD" }));
  // 통화 소문자 거부
  assert.throws(() => moneySchema.parse({ amount: 100, currency: "usd" }));
  // 통화 자릿수 불일치 거부
  assert.throws(() => moneySchema.parse({ amount: 100, currency: "US" }));
  assert.throws(() => moneySchema.parse({ amount: 100, currency: "USDT" }));
});

test("fxSnapshotSchema: 환율 스냅샷을 검증한다", () => {
  const snap = fxSnapshotSchema.parse({
    rate: 1350.5,
    base: "USD",
    quote: "KRW",
    asOf: "2026-08-27T09:00:00Z",
    source: "하나은행",
  });
  assert.equal(snap.rate, 1350.5);
  assert.equal(snap.base, "USD");
  assert.equal(snap.quote, "KRW");

  // 0 또는 음수 환율 거부
  assert.throws(() =>
    fxSnapshotSchema.parse({
      rate: 0,
      base: "USD",
      quote: "KRW",
      asOf: "2026-08-27T09:00:00Z",
      source: "하나은행",
    })
  );
});

test("supplierQuoteSchema: 공급자 견적 구조를 검증한다", () => {
  const quote = {
    id: "quote_v1",
    itemId: "item_01",
    engagementId: "eng_01",
    version: 1,
    quantityTier: 3000,
    unitCost: { amount: 4500, currency: "KRW" },
    shipping: { amount: 300, currency: "KRW" },
    incoterm: "FOB Busan",
    validUntil: "2026-12-31T23:59:59Z",
    sourceRefs: ["email_from_greencos_20260825"],
  };

  const parsed = supplierQuoteSchema.parse(quote);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.unitCost.amount, 4500);
  assert.equal(parsed.sourceRefs.length, 1);

  // sourceRefs가 비어있으면 거부
  assert.throws(() =>
    supplierQuoteSchema.parse({
      ...quote,
      sourceRefs: [],
    })
  );
});

test("dealFinanceInputSchema: 전체 재무 문서를 파싱하고 기본값을 확인한다", () => {
  const finance = {
    supplierQuotes: [
      {
        id: "q1",
        itemId: "item_01",
        engagementId: "eng_01",
        version: 1,
        quantityTier: 5000,
        unitCost: { amount: 3.5, currency: "USD" },
        sourceRefs: ["msg_123"],
      },
    ],
    buyerQuote: {
      unitPrice: { amount: 8.0, currency: "USD" },
      totalValue: { amount: 40000, currency: "USD" },
    },
    internalCosts: [
      {
        category: "design",
        amount: { amount: 500, currency: "USD" },
        notes: "라벨 디자인 외주",
      },
    ],
    fxSnapshot: {
      rate: 1350,
      base: "USD",
      quote: "KRW",
      asOf: "2026-08-27T00:00:00Z",
      source: "수기 입력",
    },
    grossProfit: { amount: 22000, currency: "USD" },
    margin: 55.0,
  };

  const parsed = dealFinanceInputSchema.parse(finance);
  assert.equal(parsed.supplierQuotes.length, 1);
  assert.equal(parsed.buyerQuote?.unitPrice.amount, 8.0);
  assert.equal(parsed.internalCosts[0].category, "design");
  assert.equal(parsed.margin, 55.0);
});
