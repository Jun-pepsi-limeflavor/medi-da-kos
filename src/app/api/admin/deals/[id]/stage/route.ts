import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/with-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import { stripUndefined } from "@/lib/firestore-sanitize";
import {
  checkGate,
  findViolations,
  canAutoSyncMainShipmentForEngagement,
  effectiveFactoryStage,
  type GateTransition,
  type Violation,
} from "@/lib/stages";
import type { SampleRound, SupplierEngagement, Shipment } from "@/lib/schemas/deal";

export const runtime = "nodejs";

const stageTransitionSchema = z
  .object({
    track: z.enum(["brand", "factory"]),
    engagementId: z.string().trim().min(1).optional(),
    target: z.number().int().positive(),
    override: z.boolean().optional(),
    reason: z.string().trim().optional(),
    itemId: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.track !== "factory" || !!data.engagementId, {
    message: "공장 단계 전환에는 engagementId가 필수입니다",
  })
  .refine((data) => !data.override || !!data.reason, {
    message: "override 진행 시 사유(reason)가 필수입니다",
  });

function extractDealId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.indexOf("deals");
  return index === -1 || index + 1 >= segments.length
    ? null
    : decodeURIComponent(segments[index + 1]);
}

type TransitionOutcome =
  | { kind: "not-found" | "engagement-not-found" }
  | { kind: "blocked"; reason: string }
  | { kind: "confirm"; violations: Violation[] }
  | { kind: "success"; stageBrand: number; stageFactory?: number };

export const POST = withAdmin(async (req, actor) => {
  const id = extractDealId(req.nextUrl.pathname);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const parsed = stageTransitionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { track, engagementId, target, override, reason, itemId } = parsed.data;
  if (track === "brand" && (target < 1 || target > 8)) {
    return NextResponse.json({ error: "브랜드 단계는 1~8 사이여야 합니다" }, { status: 400 });
  }
  if (track === "factory" && (target < 1 || target > 9)) {
    return NextResponse.json({ error: "공장 단계는 1~9 사이여야 합니다" }, { status: 400 });
  }

  const db = getAdminDb();
  const dealRef = db.collection("deals").doc(id);
  const transition: GateTransition = { side: track, toStage: target, itemId, engagementId };
  const now = new Date().toISOString();
  let outcome: TransitionOutcome | undefined;

  await db.runTransaction(async (tx) => {
    // Every gate input is read by this transaction. A pre-transaction view is never
    // used to authorize a write, so a concurrently changed supplier or shipment cannot pass a stale gate.
    outcome = undefined;
    const dealDoc = await tx.get(dealRef);
    if (!dealDoc.exists) {
      outcome = { kind: "not-found" };
      return;
    }
    const [itemsSnap, engagementsSnap, sampleRoundsSnap, shipmentsSnap] = await Promise.all([
      tx.get(dealRef.collection("items")),
      tx.get(dealRef.collection("supplierEngagements")),
      tx.get(dealRef.collection("sampleRounds")),
      tx.get(dealRef.collection("shipments")),
    ]);
    const deal = dealDoc.data()!;
    const engagements = engagementsSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as SupplierEngagement,
    );
    const targetEngagement = track === "factory"
      ? engagements.find((engagement) => engagement.id === engagementId)
      : undefined;
    if (track === "factory" && !targetEngagement) {
      outcome = { kind: "engagement-not-found" };
      return;
    }
    const sampleRounds = sampleRoundsSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as SampleRound,
    );
    const shipments = shipmentsSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Shipment,
    );

    const gate = checkGate(
      {
        deal,
        shippingInfo: deal.shippingInfo,
        payment: deal.payment,
        items: itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        sampleRounds,
        shipments,
      },
      transition,
    );
    if (!gate.ok) {
      outcome = { kind: "blocked", reason: gate.reason };
      return;
    }

    const violations = findViolations({
      stageBrand: track === "brand" ? target : deal.stageBrand,
      engagements: engagements.map((engagement) => ({
        contactStatus: engagement.contactStatus,
        stageFactory: track === "factory" && engagement.id === engagementId
          ? target
          : engagement.stageFactory,
      })),
    });
    if (violations.length > 0 && !override) {
      outcome = { kind: "confirm", violations };
      return;
    }

    let previousStage: number;
    let nextBrandStage = deal.stageBrand;
    const nextFactoryStage = track === "factory" ? target : effectiveFactoryStage(engagements) ?? undefined;

    if (track === "brand") {
      previousStage = deal.stageBrand;
      nextBrandStage = target;
      tx.update(dealRef, { stageBrand: target, updatedAt: now, updatedBy: actor.email });
    } else {
      previousStage = targetEngagement!.stageFactory;
      tx.update(dealRef.collection("supplierEngagements").doc(engagementId!), {
        stageFactory: target,
        updatedAt: now,
        updatedBy: actor.email,
      });
      const hasThisEngagementsMainShipment = shipments.some((shipment) =>
        canAutoSyncMainShipmentForEngagement({
          kind: shipment.kind,
          route: shipment.route,
          trackingNumber: shipment.trackingNumber,
          shipmentEngagementId: shipment.engagementId,
          targetEngagementId: engagementId!,
          factoryStage: target,
        }),
      );
      if (target === 9 && hasThisEngagementsMainShipment) {
        nextBrandStage = 8;
        tx.update(dealRef, { stageBrand: 8, updatedAt: now, updatedBy: actor.email });
      }
    }

    tx.set(dealRef.collection("events").doc(), stripUndefined({
      type: override ? "override" : "stage",
      actor: actor.email,
      at: now,
      from: previousStage,
      to: target,
      reason: override ? reason : undefined,
    }));
    outcome = { kind: "success", stageBrand: nextBrandStage, stageFactory: nextFactoryStage };
  });

  if (!outcome || outcome.kind === "not-found") {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }
  if (outcome.kind === "engagement-not-found") {
    return NextResponse.json({ error: "engagement not found" }, { status: 404 });
  }
  if (outcome.kind === "blocked") {
    return NextResponse.json({ error: outcome.reason }, { status: 409 });
  }
  if (outcome.kind === "confirm") {
    return NextResponse.json({ needsConfirm: true, violations: outcome.violations }, { status: 200 });
  }
  if (outcome.kind === "success") {
    return NextResponse.json({ ok: true, stageBrand: outcome.stageBrand, stageFactory: outcome.stageFactory });
  }
  return NextResponse.json({ error: "stage transition failed" }, { status: 409 });
});
