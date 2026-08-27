export interface BrandStage {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  label: string;
  description: string;
}

export interface FactoryStage {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  label: string;
  description: string;
}

export const BRAND_STAGES: readonly BrandStage[] = [
  { id: 1, label: "접수", description: "Inquiry" },
  { id: 2, label: "가견적 발송", description: "Quote Sent" },
  { id: 3, label: "샘플 발주", description: "Sample Order" },
  { id: 4, label: "샘플 발송", description: "Sample Shipped" },
  { id: 5, label: "피드백", description: "Feedback" },
  { id: 6, label: "계약", description: "Contract" },
  { id: 7, label: "결제/발주", description: "Payment & PO" },
  { id: 8, label: "배송", description: "Main Delivery" },
] as const;

export const FACTORY_STAGES: readonly FactoryStage[] = [
  { id: 1, label: "견적 문의", description: "RFQ" },
  { id: 2, label: "견적 회신", description: "Quote Reply" },
  { id: 3, label: "샘플 요청", description: "Sample Request" },
  { id: 4, label: "샘플 수정", description: "Sample Revision" },
  { id: 5, label: "계약", description: "Contract" },
  { id: 6, label: "결제완료", description: "Payment Confirmed" },
  { id: 7, label: "생산", description: "Production" },
  { id: 8, label: "완료", description: "Production Finished" },
  { id: 9, label: "배송", description: "Factory Shipped" },
] as const;

export interface Dependency {
  id: string;
  targetSide: "brand" | "factory";
  targetStage: number;
  prereqSide: "brand" | "factory";
  prereqStage: number;
  description: string;
}

export const DEPENDENCIES: readonly Dependency[] = [
  {
    id: "factory_1_requires_brand_1",
    targetSide: "factory",
    targetStage: 1,
    prereqSide: "brand",
    prereqStage: 1,
    description: "공장 1 (견적 문의) -> 선결: 브랜드 >= 1",
  },
  {
    id: "brand_3_requires_factory_2",
    targetSide: "brand",
    targetStage: 3,
    prereqSide: "factory",
    prereqStage: 2,
    description: "브랜드 3 (샘플 발주) -> 선결: 공장 >= 2 (제조사 중 하나라도)",
  },
  {
    id: "factory_3_requires_brand_3",
    targetSide: "factory",
    targetStage: 3,
    prereqSide: "brand",
    prereqStage: 3,
    description: "공장 3 (샘플 요청) -> 선결: 브랜드 >= 3",
  },
  {
    id: "factory_4_requires_brand_5",
    targetSide: "factory",
    targetStage: 4,
    prereqSide: "brand",
    prereqStage: 5,
    description: "공장 4 (샘플 수정) -> 선결: 브랜드 >= 5",
  },
  {
    id: "factory_5_requires_brand_7",
    targetSide: "factory",
    targetStage: 5,
    prereqSide: "brand",
    prereqStage: 7,
    description: "공장 5 (계약) -> 선결: 브랜드 >= 7",
  },
] as const;

export interface EngagementLike {
  contactStatus: "ing" | "fix" | "drop";
  stageFactory: number;
}

export interface DealLike {
  stageBrand: number;
  engagements?: EngagementLike[];
}

export interface Violation {
  dependencyId: string;
  targetSide: "brand" | "factory";
  targetStage: number;
  prereqSide: "brand" | "factory";
  prereqStage: number;
  message: string;
}

/**
 * 복수 제조사 engagement 중 유효 공장 단계를 도출한다.
 * - 확정('fix') 제조사가 있으면 그 단계 (복수면 최댓값)
 * - 없으면 진행중('ing') 중 가장 앞선 단계 (최댓값)
 * - 'drop'은 무시
 * - 유효 제조사가 없으면 null
 */
export function effectiveFactoryStage(
  engagements?: EngagementLike[] | null
): number | null {
  if (!engagements || engagements.length === 0) {
    return null;
  }

  const fixed = engagements.filter((e) => e.contactStatus === "fix");
  if (fixed.length > 0) {
    return Math.max(...fixed.map((e) => e.stageFactory));
  }

  const active = engagements.filter((e) => e.contactStatus === "ing");
  if (active.length > 0) {
    return Math.max(...active.map((e) => e.stageFactory));
  }

  return null;
}

/**
 * 스펙 4.4의 5개 디펜던시 위반 여부를 검사하여 위반 목록을 반환한다.
 */
export function findViolations(deal: DealLike): Violation[] {
  const violations: Violation[] = [];
  const engagements = deal.engagements ?? [];
  const activeEngagements = engagements.filter((e) => e.contactStatus !== "drop");
  const effStage = effectiveFactoryStage(engagements);

  for (const dep of DEPENDENCIES) {
    if (dep.targetSide === "brand") {
      // 브랜드 3: 선결조건인 공장 2는 "제조사 중 하나라도 도달했으면 충족"
      if (deal.stageBrand >= dep.targetStage) {
        const hasPrereq = activeEngagements.some(
          (e) => e.stageFactory >= dep.prereqStage
        );
        if (!hasPrereq) {
          violations.push({
            dependencyId: dep.id,
            targetSide: dep.targetSide,
            targetStage: dep.targetStage,
            prereqSide: dep.prereqSide,
            prereqStage: dep.prereqStage,
            message: `브랜드 ${dep.targetStage}단계 진행 전 공장 ${dep.prereqStage}단계 이상(제조사 중 최소 1곳)이 필요합니다.`,
          });
        }
      }
    } else {
      // 타겟이 공장인 경우: 대표 공장 단계가 해당 타겟에 도달했는지 확인
      if (effStage !== null && effStage >= dep.targetStage) {
        if (deal.stageBrand < dep.prereqStage) {
          violations.push({
            dependencyId: dep.id,
            targetSide: dep.targetSide,
            targetStage: dep.targetStage,
            prereqSide: dep.prereqSide,
            prereqStage: dep.prereqStage,
            message: `공장 ${dep.targetStage}단계 진행 전 브랜드 ${dep.prereqStage}단계 이상이 필요합니다.`,
          });
        }
      }
    }
  }

  return violations;
}

export type GateResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface GateTransition {
  side: "brand" | "factory";
  toStage: number;
  itemId?: string;
  engagementId?: string;
}

export interface SampleRoundLike {
  id: string;
  itemId: string;
  supplierId?: string;
  roundNo: number;
  qcStatus?: "pending" | "passed" | "failed" | "waived" | string;
  qcWaiverReason?: string | null;
  receivedAt?: string | number | Date | null;
  verdict?: "approved" | "revision" | "dropped" | string | null;
  [key: string]: unknown;
}

export interface ShipmentLike {
  id?: string;
  kind: "sample" | "main" | string;
  route: "supplier_to_hq" | "hq_to_buyer" | "supplier_to_buyer" | string;
  sampleRoundId?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface ShippingInfoLike {
  country?: string | null;
  taxId?: string | null;
  [key: string]: unknown;
}

export interface PaymentLike {
  samplePayment?: unknown;
  mainPayment?: {
    escrowStatus?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface GateSnapshot {
  deal?: {
    stageBrand?: number;
    shippingInfo?: ShippingInfoLike | null;
    payment?: PaymentLike | null;
    [key: string]: unknown;
  } | null;
  shippingInfo?: ShippingInfoLike | null;
  payment?: PaymentLike | null;
  items?: Array<{ id: string; [key: string]: unknown }>;
  sampleRounds?: SampleRoundLike[];
  shipments?: ShipmentLike[];
}

function isBrazil(country?: string | null): boolean {
  if (!country) return false;
  const normalized = country.trim().toLowerCase();
  return (
    normalized === "brazil" ||
    normalized === "br" ||
    normalized === "브라질" ||
    normalized === "brasil"
  );
}

/**
 * 하드 게이트 검사:
 * 1) 브랜드 4 (샘플 발송):
 *    - 해당 제품의 최신 활성 sampleRound 존재 필수
 *    - HQ 경유: receivedAt 존재, qcStatus === 'passed', hq_to_buyer 운송장 필수
 *    - 공장 직송: qcStatus === 'waived', qcWaiverReason 공백 아님 필수, supplier_to_buyer 운송장 필수
 *    - 다른 제품이나 이전 roundNo의 송장은 무효
 *    - 배송지 국가가 브라질이면 shippingInfo.taxId 필수
 * 2) 브랜드 8 (배송):
 *    - kind === 'main'인 shipment의 trackingNumber 필수
 * 3) 공장 7 (생산):
 *    - payment.mainPayment.escrowStatus === 'funded' 필수
 * 그 외 전환은 모두 { ok: true }
 */
export function checkGate(
  snapshot: GateSnapshot,
  transition: GateTransition
): GateResult {
  // 1) 브랜드 4: 샘플 발송 하드 게이트
  if (transition.side === "brand" && transition.toStage === 4) {
    const shippingInfo =
      snapshot.deal?.shippingInfo ?? snapshot.shippingInfo ?? null;

    // 브라질 세금 번호 검사
    if (isBrazil(shippingInfo?.country)) {
      const taxId = shippingInfo?.taxId?.trim();
      if (!taxId) {
        return {
          ok: false,
          reason: "브라질 배송은 세금 번호(taxId)가 필수입니다.",
        };
      }
    }

    const allRounds = snapshot.sampleRounds ?? [];
    const relevantRounds = transition.itemId
      ? allRounds.filter((r) => r.itemId === transition.itemId)
      : allRounds;

    // 활성 sampleRound: verdict !== 'dropped'
    const activeRounds = relevantRounds.filter((r) => r.verdict !== "dropped");
    if (activeRounds.length === 0) {
      return {
        ok: false,
        reason: "해당 제품의 최신 활성 샘플 라운드(sampleRound)가 존재하지 않습니다.",
      };
    }

    // 최신 라운드 (roundNo 최댓값)
    const latestRound = activeRounds.reduce((prev, curr) =>
      curr.roundNo > prev.roundNo ? curr : prev
    );

    const allShipments = snapshot.shipments ?? [];
    // 해당 roundId에 연결된 샘플 송장만 유효 (이전 roundNo나 다른 제품 송장 무효)
    const validSampleShipments = allShipments.filter(
      (s) =>
        s.kind === "sample" &&
        s.sampleRoundId === latestRound.id &&
        typeof s.trackingNumber === "string" &&
        s.trackingNumber.trim().length > 0
    );

    if (latestRound.qcStatus === "waived") {
      // 공장 직송 경로
      const waiverReason = latestRound.qcWaiverReason?.trim();
      if (!waiverReason) {
        return {
          ok: false,
          reason: "공장 직송 시 공백이 아닌 QC 면제 사유(qcWaiverReason)가 필수입니다.",
        };
      }

      const hasDirectShipment = validSampleShipments.some(
        (s) => s.route === "supplier_to_buyer"
      );
      if (!hasDirectShipment) {
        return {
          ok: false,
          reason: "공장 직송 샘플 발송을 위한 유효한 운송장(supplier_to_buyer trackingNumber)이 필요합니다.",
        };
      }
    } else {
      // HQ 경유 기본 경로
      if (!latestRound.receivedAt) {
        return {
          ok: false,
          reason: "HQ 경유 샘플 발송을 위해 본사 입고 확인(receivedAt)이 필요합니다.",
        };
      }

      if (latestRound.qcStatus !== "passed") {
        return {
          ok: false,
          reason: "HQ 경유 샘플 발송을 위해 QC 검사 통과(qcStatus === 'passed')가 필요합니다.",
        };
      }

      const hasHqToBuyerShipment = validSampleShipments.some(
        (s) => s.route === "hq_to_buyer"
      );
      if (!hasHqToBuyerShipment) {
        return {
          ok: false,
          reason: "바이어 발송을 위한 HQ 발송 운송장(hq_to_buyer trackingNumber)이 필요합니다.",
        };
      }
    }

    return { ok: true };
  }

  // 2) 브랜드 8: 본품 배송 하드 게이트
  if (transition.side === "brand" && transition.toStage === 8) {
    const allShipments = snapshot.shipments ?? [];
    const hasMainTracking = allShipments.some(
      (s) =>
        s.kind === "main" &&
        typeof s.trackingNumber === "string" &&
        s.trackingNumber.trim().length > 0
    );

    if (!hasMainTracking) {
      return {
        ok: false,
        reason: "본품 배송(브랜드 8) 단계 전환 시 유효한 본품 운송장(kind: 'main', trackingNumber)이 필수입니다.",
      };
    }

    return { ok: true };
  }

  // 3) 공장 7: 생산 시작 하드 게이트
  if (transition.side === "factory" && transition.toStage === 7) {
    const payment = snapshot.deal?.payment ?? snapshot.payment ?? null;
    const escrowStatus = payment?.mainPayment?.escrowStatus;

    if (escrowStatus !== "funded") {
      return {
        ok: false,
        reason: "공장 생산(공장 7) 단계 전환 시 에스크로 입금 확인(payment.mainPayment.escrowStatus === 'funded')이 필수입니다.",
      };
    }

    return { ok: true };
  }

  return { ok: true };
}

/**
 * 본품 자동 동기화 조건 검사:
 * kind === 'main' && route === 'supplier_to_buyer' && factoryStage === 9 일 때만 참
 */
export function canAutoSyncMainShipment(params: {
  kind: string;
  route: string;
  factoryStage: number;
}): boolean {
  return (
    params.kind === "main" &&
    params.route === "supplier_to_buyer" &&
    params.factoryStage === 9
  );
}
