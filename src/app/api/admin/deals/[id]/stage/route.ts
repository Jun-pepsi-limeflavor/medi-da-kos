import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-sanitize";
import {
  checkGate,
  findViolations,
  canAutoSyncMainShipment,
  effectiveFactoryStage,
  type GateSnapshot,
  type GateTransition,
} from "@/lib/stages";
import {
  type SupplierEngagement,
  type Shipment,
} from "@/lib/schemas/deal";
import { getDealWithSubcollections, DealNotFoundError } from "@/lib/repo/deals";

export const runtime = "nodejs";

const stageTransitionSchema = z
  .object({
    track: z.enum(["brand", "factory"]),
    engagementId: z.string().optional(),
    target: z.number().int().positive(),
    override: z.boolean().optional(),
    reason: z.string().trim().optional(),
    shipmentId: z.string().optional(),
    itemId: z.string().optional(),
  })
  .refine((d) => d.track !== "factory" || !!d.engagementId, {
    message: "공장 단계 전환에는 engagementId가 필수입니다",
  })
  .refine((d) => !d.override || (!!d.reason && d.reason.length > 0), {
    message: "override 진행 시 사유(reason)가 필수입니다",
  });

function extractDealId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("deals");
  if (idx === -1 || idx + 1 >= segments.length) return null;
  return decodeURIComponent(segments[idx + 1]);
}

export const POST = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = stageTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { track, engagementId, target, override, reason, itemId } = parsed.data;

  if (track === "brand" && (target < 1 || target > 8)) {
    return NextResponse.json({ error: "브랜드 단계는 1~8 사이여야 합니다" }, { status: 400 });
  }
  if (track === "factory" && (target < 1 || target > 9)) {
    return NextResponse.json({ error: "공장 단계는 1~9 사이여야 합니다" }, { status: 400 });
  }

  // 1. 현재 딜 상태 조회
  const details = await getDealWithSubcollections(id);
  if (!details) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  const targetEngagement = engagementId
    ? details.supplierEngagements.find((e: SupplierEngagement) => e.id === engagementId)
    : undefined;

  if (track === "factory" && !targetEngagement) {
    return NextResponse.json({ error: "engagement not found" }, { status: 404 });
  }

  // 2. checkGate 검사 (하드 게이트는 override 불가, 즉시 409)
  const snapshot: GateSnapshot = {
    deal: details.deal,
    shippingInfo: details.deal.shippingInfo,
    payment: details.deal.payment,
    items: details.items,
    sampleRounds: details.sampleRounds,
    shipments: details.shipments,
  };

  const transition: GateTransition = {
    side: track,
    toStage: target,
    itemId,
    engagementId,
  };

  const gateResult = checkGate(snapshot, transition);
  if (!gateResult.ok) {
    return NextResponse.json({ error: gateResult.reason }, { status: 409 });
  }

  // 3. 가상의 다음 상태 구성 및 findViolations 검사
  const virtualBrandStage = track === "brand" ? target : details.deal.stageBrand;
  const virtualEngagements = details.supplierEngagements.map((e: SupplierEngagement) => {
    if (track === "factory" && e.id === engagementId) {
      return {
        contactStatus: e.contactStatus,
        stageFactory: target,
      };
    }
    return {
      contactStatus: e.contactStatus,
      stageFactory: e.stageFactory,
    };
  });

  const violations = findViolations({
    stageBrand: virtualBrandStage,
    engagements: virtualEngagements,
  });

  if (violations.length > 0) {
    if (!override) {
      return NextResponse.json({ needsConfirm: true, violations }, { status: 200 });
    }
    if (!reason || reason.length === 0) {
      return NextResponse.json(
        { error: "override 진행 시 사유(reason)가 필수입니다" },
        { status: 400 }
      );
    }
  }

  // 4. Firestore transaction을 통한 단계 및 이벤트 기록
  const db = getAdminDb();
  const dealRef = db.collection("deals").doc(id);
  const now = new Date().toISOString();

  let nextStageBrand = details.deal.stageBrand;
  let nextStageFactory = track === "factory" ? target : (effectiveFactoryStage(details.supplierEngagements) ?? undefined);

  await db.runTransaction(async (tx) => {
    const dealDoc = await tx.get(dealRef);
    if (!dealDoc.exists) {
      throw new DealNotFoundError(id);
    }
    const currentDealData = dealDoc.data()!;
    let prevStage: number;

    if (track === "brand") {
      prevStage = currentDealData.stageBrand;
      tx.update(dealRef, {
        stageBrand: target,
        updatedAt: now,
        updatedBy: actor.email,
      });
      nextStageBrand = target;
    } else {
      const engagementRef = dealRef.collection("supplierEngagements").doc(engagementId!);
      const engDoc = await tx.get(engagementRef);
      if (!engDoc.exists) {
        throw new Error("engagement not found");
      }
      prevStage = engDoc.data()!.stageFactory;
      tx.update(engagementRef, {
        stageFactory: target,
        updatedAt: now,
        updatedBy: actor.email,
      });
      nextStageFactory = target;

      // 공장 9 도달 시 canAutoSyncMainShipment 조건 만족 시 stageBrand: 8 동기화
      if (target === 9) {
        const canSync = details.shipments.some((s: Shipment) =>
          canAutoSyncMainShipment({
            kind: s.kind,
            route: s.route,
            factoryStage: target,
          })
        );
        if (canSync) {
          tx.update(dealRef, {
            stageBrand: 8,
            updatedAt: now,
            updatedBy: actor.email,
          });
          nextStageBrand = 8;
        }
      }
    }

    const eventRef = dealRef.collection("events").doc();
    tx.set(
      eventRef,
      stripUndefined({
        type: override ? "override" : "stage",
        actor: actor.email,
        at: now,
        from: prevStage,
        to: target,
        reason: override ? reason : undefined,
      })
    );
  });

  return NextResponse.json({
    ok: true,
    stageBrand: nextStageBrand,
    stageFactory: nextStageFactory,
  });
});
