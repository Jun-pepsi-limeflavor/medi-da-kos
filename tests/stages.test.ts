import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_STAGES,
  FACTORY_STAGES,
  DEPENDENCIES,
  effectiveFactoryStage,
  findViolations,
  checkGate,
  canAutoSyncMainShipment,
  canAutoSyncMainShipmentForEngagement,
  type GateSnapshot,
} from "../src/lib/stages.ts";

// ============================================================================
// 1. 단계 및 의존성 상수 정의 검증
// ============================================================================

test("BRAND_STAGES는 1부터 8까지 정의되어야 한다", () => {
  assert.equal(BRAND_STAGES.length, 8);
  assert.deepEqual(
    BRAND_STAGES.map((s) => s.id),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
  assert.equal(BRAND_STAGES[0].label, "접수");
  assert.equal(BRAND_STAGES[7].label, "배송");
});

test("FACTORY_STAGES는 1부터 9까지 정의되어야 한다", () => {
  assert.equal(FACTORY_STAGES.length, 9);
  assert.deepEqual(
    FACTORY_STAGES.map((s) => s.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.equal(FACTORY_STAGES[0].label, "견적 문의");
  assert.equal(FACTORY_STAGES[8].label, "배송");
});

test("DEPENDENCIES는 스펙 4.4에 정의된 5개 선결조건을 포함해야 한다", () => {
  assert.equal(DEPENDENCIES.length, 5);
  const ids = DEPENDENCIES.map((d) => d.id);
  assert.ok(ids.includes("factory_1_requires_brand_1"));
  assert.ok(ids.includes("brand_3_requires_factory_2"));
  assert.ok(ids.includes("factory_3_requires_brand_3"));
  assert.ok(ids.includes("factory_4_requires_brand_5"));
  assert.ok(ids.includes("factory_5_requires_brand_7"));
});

// ============================================================================
// 2. effectiveFactoryStage
// ============================================================================

test("effectiveFactoryStage: 제조사가 없거나 빈 배열이면 null을 반환한다", () => {
  assert.equal(effectiveFactoryStage(), null);
  assert.equal(effectiveFactoryStage(null), null);
  assert.equal(effectiveFactoryStage([]), null);
});

test("effectiveFactoryStage: drop 제조사만 있으면 null을 반환한다", () => {
  assert.equal(
    effectiveFactoryStage([
      { contactStatus: "drop", stageFactory: 5 },
      { contactStatus: "drop", stageFactory: 9 },
    ]),
    null
  );
});

test("effectiveFactoryStage: ing 제조사가 1개면 해당 단계를 반환한다", () => {
  assert.equal(
    effectiveFactoryStage([{ contactStatus: "ing", stageFactory: 2 }]),
    2
  );
});

test("effectiveFactoryStage: ing 제조사가 복수면 가장 앞선 단계(최댓값)를 반환한다", () => {
  assert.equal(
    effectiveFactoryStage([
      { contactStatus: "ing", stageFactory: 1 },
      { contactStatus: "ing", stageFactory: 4 },
      { contactStatus: "ing", stageFactory: 2 },
    ]),
    4
  );
});

test("effectiveFactoryStage: drop 제조사는 ing 최댓값 계산에서 무시된다", () => {
  assert.equal(
    effectiveFactoryStage([
      { contactStatus: "ing", stageFactory: 2 },
      { contactStatus: "drop", stageFactory: 8 },
    ]),
    2
  );
});

test("effectiveFactoryStage: 확정('fix') 제조사가 있으면 ing보다 우선한다", () => {
  assert.equal(
    effectiveFactoryStage([
      { contactStatus: "fix", stageFactory: 3 },
      { contactStatus: "ing", stageFactory: 6 },
    ]),
    3
  );
});

test("effectiveFactoryStage: fix 제조사가 복수면 fix 중 최댓값을 반환한다", () => {
  assert.equal(
    effectiveFactoryStage([
      { contactStatus: "fix", stageFactory: 2 },
      { contactStatus: "fix", stageFactory: 5 },
      { contactStatus: "ing", stageFactory: 7 },
    ]),
    5
  );
});

test("effectiveFactoryStage: fix와 drop 혼합 시 drop은 무시된다", () => {
  assert.equal(
    effectiveFactoryStage([
      { contactStatus: "fix", stageFactory: 4 },
      { contactStatus: "drop", stageFactory: 9 },
    ]),
    4
  );
});

// ============================================================================
// 3. findViolations
// ============================================================================

test("findViolations: 정상적인 순서에서는 위반이 없다", () => {
  // 브랜드 1, 공장 1
  assert.deepEqual(
    findViolations({
      stageBrand: 1,
      engagements: [{ contactStatus: "ing", stageFactory: 1 }],
    }),
    []
  );

  // 브랜드 3, 공장 2 (선결조건 충족)
  assert.deepEqual(
    findViolations({
      stageBrand: 3,
      engagements: [{ contactStatus: "ing", stageFactory: 2 }],
    }),
    []
  );

  // 브랜드 3, 복수 공장 중 하나만 2단계 도달 (선결조건 충족)
  assert.deepEqual(
    findViolations({
      stageBrand: 3,
      engagements: [
        { contactStatus: "ing", stageFactory: 1 },
        { contactStatus: "ing", stageFactory: 2 },
      ],
    }),
    []
  );

  // 브랜드 5, 공장 4
  assert.deepEqual(
    findViolations({
      stageBrand: 5,
      engagements: [{ contactStatus: "ing", stageFactory: 4 }],
    }),
    []
  );

  // 브랜드 7, 공장 5
  assert.deepEqual(
    findViolations({
      stageBrand: 7,
      engagements: [{ contactStatus: "ing", stageFactory: 5 }],
    }),
    []
  );
});

test("findViolations 1: 공장 1 (견적 문의) -> 선결 브랜드 >= 1 위반", () => {
  const violations = findViolations({
    stageBrand: 0,
    engagements: [{ contactStatus: "ing", stageFactory: 1 }],
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].dependencyId, "factory_1_requires_brand_1");
  assert.equal(violations[0].targetSide, "factory");
  assert.equal(violations[0].targetStage, 1);
  assert.equal(violations[0].prereqSide, "brand");
  assert.equal(violations[0].prereqStage, 1);
});

test("findViolations 2: 브랜드 3 (샘플 발주) -> 선결 공장 >= 2 (제조사 중 하나라도) 위반", () => {
  // 제조사가 아예 없는 경우
  const v1 = findViolations({ stageBrand: 3, engagements: [] });
  assert.equal(v1.length, 1);
  assert.equal(v1[0].dependencyId, "brand_3_requires_factory_2");

  // drop 제조사만 2단계인 경우
  const v2 = findViolations({
    stageBrand: 3,
    engagements: [{ contactStatus: "drop", stageFactory: 2 }],
  });
  assert.equal(v2.length, 1);
  assert.equal(v2[0].dependencyId, "brand_3_requires_factory_2");

  // ing 제조사가 아직 1단계인 경우
  const v3 = findViolations({
    stageBrand: 3,
    engagements: [{ contactStatus: "ing", stageFactory: 1 }],
  });
  assert.equal(v3.length, 1);
  assert.equal(v3[0].dependencyId, "brand_3_requires_factory_2");
});

test("findViolations 3: 공장 3 (샘플 요청) -> 선결 브랜드 >= 3 위반", () => {
  const violations = findViolations({
    stageBrand: 2,
    engagements: [{ contactStatus: "ing", stageFactory: 3 }],
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].dependencyId, "factory_3_requires_brand_3");
});

test("findViolations 4: 공장 4 (샘플 수정) -> 선결 브랜드 >= 5 위반", () => {
  const violations = findViolations({
    stageBrand: 4,
    engagements: [{ contactStatus: "ing", stageFactory: 4 }],
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].dependencyId, "factory_4_requires_brand_5");
});

test("findViolations 5: 공장 5 (계약) -> 선결 브랜드 >= 7 위반", () => {
  const violations = findViolations({
    stageBrand: 6,
    engagements: [{ contactStatus: "ing", stageFactory: 5 }],
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].dependencyId, "factory_5_requires_brand_7");
});

test("findViolations: 여러 디펜던시가 동시에 위반된 경우 모두 반환한다", () => {
  // 공장 4단계인데 브랜드가 2단계 (공장 3 위반 + 공장 4 위반)
  const violations = findViolations({
    stageBrand: 2,
    engagements: [{ contactStatus: "ing", stageFactory: 4 }],
  });
  const ids = violations.map((v) => v.dependencyId);
  assert.ok(ids.includes("factory_3_requires_brand_3"));
  assert.ok(ids.includes("factory_4_requires_brand_5"));
});

// ============================================================================
// 4. checkGate: 하드 게이트 검사
// ============================================================================

test("checkGate: 하드 게이트 대상이 아닌 일반 전환은 항상 { ok: true }이다", () => {
  const dummySnapshot: GateSnapshot = {};
  assert.deepEqual(
    checkGate(dummySnapshot, { side: "brand", toStage: 1 }),
    { ok: true }
  );
  assert.deepEqual(
    checkGate(dummySnapshot, { side: "brand", toStage: 2 }),
    { ok: true }
  );
  assert.deepEqual(
    checkGate(dummySnapshot, { side: "brand", toStage: 3 }),
    { ok: true }
  );
  assert.deepEqual(
    checkGate(dummySnapshot, { side: "factory", toStage: 1 }),
    { ok: true }
  );
  assert.deepEqual(
    checkGate(dummySnapshot, { side: "factory", toStage: 6 }),
    { ok: true }
  );
});

// --- 게이트 1: 브랜드 4 (샘플 발송) ---

test("checkGate (브랜드 4): 활성 sampleRound가 없으면 차단한다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.reason, /샘플 라운드/);
  }
});

test("checkGate (브랜드 4): dropped된 라운드만 있으면 차단한다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        verdict: "dropped",
        qcStatus: "passed",
        receivedAt: "2026-08-20T00:00:00Z",
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "hq_to_buyer",
        sampleRoundId: "round_1",
        trackingNumber: "12345678",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
});

test("checkGate (브랜드 4): 배송 국가가 브라질이면 taxId가 없을 때 차단한다", () => {
  const brazilVariants = ["Brazil", "BR", "브라질", "brasil", " brazil "];

  for (const country of brazilVariants) {
    const snapshot: GateSnapshot = {
      shippingInfo: {
        country,
        taxId: "", // 비어 있음
      },
      sampleRounds: [
        {
          id: "round_1",
          itemId: "item_1",
          roundNo: 1,
          receivedAt: "2026-08-20T00:00:00Z",
          qcStatus: "passed",
        },
      ],
      shipments: [
        {
          kind: "sample",
          route: "hq_to_buyer",
          sampleRoundId: "round_1",
          trackingNumber: "TRK_123",
        },
      ],
    };

    const res = checkGate(snapshot, { side: "brand", toStage: 4 });
    assert.equal(res.ok, false, `Country ${country} should require taxId`);
    if (!res.ok) {
      assert.match(res.reason, /taxId|세금/i);
    }
  }
});

test("checkGate (브랜드 4 HQ 경유): receivedAt 없으면 차단한다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        qcStatus: "passed",
        // receivedAt 누락
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "hq_to_buyer",
        sampleRoundId: "round_1",
        trackingNumber: "TRK_123",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.reason, /입고|receivedAt/i);
  }
});

test("checkGate (브랜드 4 HQ 경유): qcStatus가 passed가 아니면 차단한다", () => {
  const statuses = ["pending", "failed", "other"];
  for (const qcStatus of statuses) {
    const snapshot: GateSnapshot = {
      sampleRounds: [
        {
          id: "round_1",
          itemId: "item_1",
          roundNo: 1,
          receivedAt: "2026-08-20T00:00:00Z",
          qcStatus,
        },
      ],
      shipments: [
        {
          kind: "sample",
          route: "hq_to_buyer",
          sampleRoundId: "round_1",
          trackingNumber: "TRK_123",
        },
      ],
    };
    const res = checkGate(snapshot, { side: "brand", toStage: 4 });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.reason, /QC/i);
    }
  }
});

test("checkGate (브랜드 4 HQ 경유): hq_to_buyer 운송장이 없으면 차단한다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        receivedAt: "2026-08-20T00:00:00Z",
        qcStatus: "passed",
      },
    ],
    shipments: [
      // supplier_to_hq만 있고 hq_to_buyer가 없음
      {
        kind: "sample",
        route: "supplier_to_hq",
        sampleRoundId: "round_1",
        trackingNumber: "TRK_IN",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.reason, /hq_to_buyer|운송장/i);
  }
});

test("checkGate (브랜드 4 HQ 경유): 다른 라운드의 송장은 무효여서 차단된다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        verdict: "revision",
      },
      {
        id: "round_2",
        itemId: "item_1",
        roundNo: 2,
        receivedAt: "2026-08-20T00:00:00Z",
        qcStatus: "passed",
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "hq_to_buyer",
        sampleRoundId: "round_1", // round_2의 최신 활성 라운드가 아님
        trackingNumber: "TRK_OLD",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
});

test("checkGate (브랜드 4 HQ 경유): 모든 조건 만족 시 정상 통과", () => {
  const snapshot: GateSnapshot = {
    deal: {
      shippingInfo: {
        country: "South Korea",
      },
    },
    sampleRounds: [
      {
        id: "round_2",
        itemId: "item_1",
        roundNo: 2,
        receivedAt: "2026-08-20T00:00:00Z",
        qcStatus: "passed",
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "hq_to_buyer",
        sampleRoundId: "round_2",
        trackingNumber: "TRK_HQ_BUYER_123",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.deepEqual(res, { ok: true });
});

test("checkGate (브랜드 4 공장 직송): qcWaiverReason이 없거나 공백이면 차단한다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        qcStatus: "waived",
        qcWaiverReason: "   ", // 공백
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "supplier_to_buyer",
        sampleRoundId: "round_1",
        trackingNumber: "TRK_DIRECT",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.reason, /면제 사유|qcWaiverReason/i);
  }
});

test("checkGate (브랜드 4 공장 직송): supplier_to_buyer 운송장이 없으면 차단한다", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        qcStatus: "waived",
        qcWaiverReason: "고객사 요청 긴급 직송",
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "supplier_to_hq",
        sampleRoundId: "round_1",
        trackingNumber: "TRK_HQ",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.reason, /supplier_to_buyer|운송장/i);
  }
});

test("checkGate (브랜드 4 공장 직송): 면제사유 및 직송 운송장 구비 시 통과", () => {
  const snapshot: GateSnapshot = {
    sampleRounds: [
      {
        id: "round_1",
        itemId: "item_1",
        roundNo: 1,
        qcStatus: "waived",
        qcWaiverReason: "바이어 직접 공장 검수 완료",
      },
    ],
    shipments: [
      {
        kind: "sample",
        route: "supplier_to_buyer",
        sampleRoundId: "round_1",
        trackingNumber: "TRK_DIRECT_999",
      },
    ],
  };
  const res = checkGate(snapshot, { side: "brand", toStage: 4 });
  assert.deepEqual(res, { ok: true });
});

// --- 게이트 2: 브랜드 8 (배송) ---

test("checkGate (브랜드 8): main shipment 운송장이 없으면 차단한다", () => {
  // shipment 없음
  assert.equal(checkGate({ shipments: [] }, { side: "brand", toStage: 8 }).ok, false);

  // sample shipment만 있음
  const sampleOnly: GateSnapshot = {
    shipments: [
      {
        kind: "sample",
        route: "supplier_to_buyer",
        trackingNumber: "TRK_SAMPLE",
      },
    ],
  };
  assert.equal(checkGate(sampleOnly, { side: "brand", toStage: 8 }).ok, false);

  // main shipment는 있으나 trackingNumber 공백
  const emptyTrk: GateSnapshot = {
    shipments: [
      {
        kind: "main",
        route: "supplier_to_buyer",
        trackingNumber: "   ",
      },
    ],
  };
  assert.equal(checkGate(emptyTrk, { side: "brand", toStage: 8 }).ok, false);
});

test("checkGate (브랜드 8): main shipment의 trackingNumber가 유효하면 통과", () => {
  const snapshot: GateSnapshot = {
    shipments: [
      {
        kind: "main",
        route: "supplier_to_buyer",
        trackingNumber: "MAIN_TRK_001",
      },
    ],
  };
  assert.deepEqual(
    checkGate(snapshot, { side: "brand", toStage: 8 }),
    { ok: true }
  );
});

// --- 게이트 3: 공장 7 (생산) ---

test("checkGate (공장 7): payment.mainPayment.escrowStatus가 funded가 아니면 차단한다", () => {
  // payment 정보 없음
  assert.equal(checkGate({}, { side: "factory", toStage: 7 }).ok, false);

  // unfunded 또는 pending
  const unfunded: GateSnapshot = {
    payment: {
      mainPayment: {
        escrowStatus: "unfunded",
      },
    },
  };
  assert.equal(checkGate(unfunded, { side: "factory", toStage: 7 }).ok, false);

  const pending: GateSnapshot = {
    deal: {
      payment: {
        mainPayment: {
          escrowStatus: "pending",
        },
      },
    },
  };
  assert.equal(checkGate(pending, { side: "factory", toStage: 7 }).ok, false);
});

test("checkGate (공장 7): payment.mainPayment.escrowStatus === 'funded'이면 통과", () => {
  const snapshot1: GateSnapshot = {
    payment: {
      mainPayment: {
        escrowStatus: "funded",
      },
    },
  };
  assert.deepEqual(
    checkGate(snapshot1, { side: "factory", toStage: 7 }),
    { ok: true }
  );

  const snapshot2: GateSnapshot = {
    deal: {
      payment: {
        mainPayment: {
          escrowStatus: "funded",
        },
      },
    },
  };
  assert.deepEqual(
    checkGate(snapshot2, { side: "factory", toStage: 7 }),
    { ok: true }
  );
});

// ============================================================================
// 5. canAutoSyncMainShipment
// ============================================================================

test("canAutoSyncMainShipment: kind='main' && route='supplier_to_buyer' && factoryStage=9 일 때만 참이다", () => {
  assert.equal(
    canAutoSyncMainShipment({
      kind: "main",
      route: "supplier_to_buyer",
      factoryStage: 9,
    }),
    true
  );

  // route가 hq_to_buyer인 경우
  assert.equal(
    canAutoSyncMainShipment({
      kind: "main",
      route: "hq_to_buyer",
      factoryStage: 9,
    }),
    false
  );

  // kind가 sample인 경우
  assert.equal(
    canAutoSyncMainShipment({
      kind: "sample",
      route: "supplier_to_buyer",
      factoryStage: 9,
    }),
    false
  );

  // factoryStage가 8인 경우
  assert.equal(
    canAutoSyncMainShipment({
      kind: "main",
      route: "supplier_to_buyer",
      factoryStage: 8,
    }),
    false
  );
});

test("canAutoSyncMainShipmentForEngagement: 같은 제조사 관계의 유효 운송장만 자동 동기화한다", () => {
  const base = {
    kind: "main",
    route: "supplier_to_buyer",
    trackingNumber: "TRACK-001",
    factoryStage: 9,
    targetEngagementId: "eng_new",
  };
  assert.equal(canAutoSyncMainShipmentForEngagement({ ...base, shipmentEngagementId: "eng_new" }), true);
  assert.equal(canAutoSyncMainShipmentForEngagement({ ...base, shipmentEngagementId: "eng_old" }), false);
  assert.equal(canAutoSyncMainShipmentForEngagement({ ...base, shipmentEngagementId: "eng_new", trackingNumber: "  " }), false);
});
