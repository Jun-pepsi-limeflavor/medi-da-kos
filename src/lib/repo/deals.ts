import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import { stripUndefined } from "@/lib/firestore-sanitize";
import {
  dealInputSchema,
  dealItemInputSchema,
  supplierEngagementInputSchema,
  supplierEngagementPatchSchema,
  sampleRoundInputSchema,
  sampleRoundPatchSchema,
  sampleRoundDocId,
  shipmentInputSchema,
  shipmentPatchSchema,
  dealTaskInputSchema,
  type Deal,
  type DealDetails,
  type DealInput,
  type DealItem,
  type DealItemInput,
  type SupplierEngagement,
  type SupplierEngagementInput,
  type SampleRound,
  type SampleRoundInput,
  type Shipment,
  type ShipmentInput,
  type DealTask,
  type DealTaskInput,
  type DealEvent,
} from "@/lib/schemas/deal";

const DEALS_COLLECTION = "deals";
const INTAKE_REVIEWS_COLLECTION = "intakeReviews";

export class DealNotFoundError extends Error {
  constructor(dealId: string) {
    super(`딜을 찾을 수 없습니다: ${dealId}`);
    this.name = "DealNotFoundError";
  }
}

export class InvalidIntakeReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIntakeReviewError";
  }
}

export class DuplicateSampleRoundError extends Error {
  constructor(itemId: string, roundNo: number) {
    super(`해당 제품(${itemId})의 ${roundNo}회차 샘플이 이미 존재합니다.`);
    this.name = "DuplicateSampleRoundError";
  }
}

export class EngagementNotFoundError extends Error {
  constructor(engagementId: string) {
    super(`공급자 관계를 찾을 수 없습니다: ${engagementId}`);
    this.name = "EngagementNotFoundError";
  }
}

export class InvalidEngagementReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEngagementReferenceError";
  }
}

export type { DealDetails };

export async function listDeals(): Promise<Deal[]> {
  const snap = await getAdminDb()
    .collection(DEALS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Deal);
}

export async function listDealsWithDetails(): Promise<DealDetails[]> {
  const deals = await listDeals();
  const details = await Promise.all(
    deals.map(async (deal) => {
      const full = await getDealWithSubcollections(deal.id);
      return full;
    })
  );
  return details.filter((d): d is DealDetails => d !== null);
}

export async function listDealsBySupplier(supplierId: string): Promise<Deal[]> {
  const snap = await getAdminDb()
    .collection(DEALS_COLLECTION)
    .where("supplierIds", "array-contains", supplierId)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Deal);
}

export interface SupplierDealSummary {
  deal: Deal;
  engagement: SupplierEngagement;
}

export async function listDealsBySupplierWithEngagements(
  supplierId: string
): Promise<SupplierDealSummary[]> {
  const deals = await listDealsBySupplier(supplierId);
  const results = await Promise.all(
    deals.map(async (deal) => {
      const engagementsSnap = await getAdminDb()
        .collection(DEALS_COLLECTION)
        .doc(deal.id)
        .collection("supplierEngagements")
        .where("supplierId", "==", supplierId)
        .get();

      const engagements = engagementsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as SupplierEngagement
      );

      return engagements.map((engagement) => ({
        deal,
        engagement,
      }));
    })
  );

  return results.flat();
}

export async function getDeal(dealId: string): Promise<Deal | null> {
  const doc = await getAdminDb().collection(DEALS_COLLECTION).doc(dealId).get();
  return doc.exists ? ({ id: doc.id, ...doc.data() } as Deal) : null;
}

export async function getDealWithSubcollections(
  dealId: string
): Promise<DealDetails | null> {
  const dealRef = getAdminDb().collection(DEALS_COLLECTION).doc(dealId);
  const dealDoc = await dealRef.get();
  if (!dealDoc.exists) return null;

  const [
    itemsSnap,
    engagementsSnap,
    sampleRoundsSnap,
    shipmentsSnap,
    tasksSnap,
    eventsSnap,
  ] = await Promise.all([
    dealRef.collection("items").get(),
    dealRef.collection("supplierEngagements").get(),
    dealRef.collection("sampleRounds").get(),
    dealRef.collection("shipments").get(),
    dealRef.collection("tasks").get(),
    dealRef.collection("events").orderBy("at", "desc").get(),
  ]);

  return {
    deal: { id: dealDoc.id, ...dealDoc.data() } as Deal,
    items: itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DealItem),
    supplierEngagements: engagementsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SupplierEngagement
    ),
    sampleRounds: sampleRoundsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SampleRound
    ),
    shipments: shipmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Shipment),
    tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DealTask),
    events: eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DealEvent),
  };
}

export async function createDeal(
  input: DealInput,
  actor: AdminIdentity
): Promise<string> {
  const parsed = dealInputSchema.parse(input);
  const db = getAdminDb();
  const intakeReviewRef = db
    .collection(INTAKE_REVIEWS_COLLECTION)
    .doc(parsed.intakeReviewId);
  const newDealRef = db.collection(DEALS_COLLECTION).doc();
  const eventRef = newDealRef.collection("events").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const intakeDoc = await tx.get(intakeReviewRef);
    if (!intakeDoc.exists) {
      throw new InvalidIntakeReviewError(
        `인테이크 리뷰가 존재하지 않습니다: ${parsed.intakeReviewId}`
      );
    }
    const intakeData = intakeDoc.data();
    if (intakeData?.status !== "qualified") {
      throw new InvalidIntakeReviewError(
        `인테이크 상태가 qualified가 아닙니다: ${intakeData?.status}`
      );
    }
    if (intakeData?.isTest === true) {
      throw new InvalidIntakeReviewError(
        "테스트 인테이크는 딜로 전환할 수 없습니다."
      );
    }
    if (intakeData?.dealId) {
      throw new InvalidIntakeReviewError(
        `이미 딜(${intakeData.dealId})로 전환된 인테이크입니다.`
      );
    }

    const dealData = stripUndefined({
      ...parsed,
      stageBrand: 1,
      supplierIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor.email,
      updatedBy: actor.email,
    });

    tx.set(newDealRef, dealData);
    tx.update(intakeReviewRef, { dealId: newDealRef.id });
    tx.set(
      eventRef,
      stripUndefined({
        type: "stage",
        to: 1,
        actor: actor.email,
        at: now,
        body: "딜 생성",
        sourceRefs: parsed.sourceRefs ?? [],
      })
    );
  });

  return newDealRef.id;
}

export async function updateDeal(
  dealId: string,
  patch: Partial<DealInput>,
  actor: AdminIdentity
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .update({
      ...stripUndefined(patch),
      updatedAt: now,
      updatedBy: actor.email,
    });
}

export async function appendEvent(
  dealId: string,
  event: Omit<DealEvent, "id" | "actor" | "at">,
  actor: AdminIdentity
): Promise<string> {
  const now = new Date().toISOString();
  const eventData = stripUndefined({
    ...event,
    actor: actor.email,
    at: now,
  });

  const ref = await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("events")
    .add(eventData);

  return ref.id;
}

export async function addItem(
  dealId: string,
  item: DealItemInput,
  _actor: AdminIdentity
): Promise<string> {
  const parsed = dealItemInputSchema.parse(item);
  const now = new Date().toISOString();
  const ref = await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("items")
    .add(
      stripUndefined({
        ...parsed,
        createdAt: now,
        updatedAt: now,
      })
    );
  return ref.id;
}

export async function addSupplierEngagement(
  dealId: string,
  engagement: SupplierEngagementInput,
  actor: AdminIdentity
): Promise<string> {
  const parsed = supplierEngagementInputSchema.parse(engagement);
  const db = getAdminDb();
  const dealRef = db.collection(DEALS_COLLECTION).doc(dealId);
  const engagementRef = dealRef.collection("supplierEngagements").doc();
  const eventRef = dealRef.collection("events").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const dealDoc = await tx.get(dealRef);
    if (!dealDoc.exists) {
      throw new DealNotFoundError(dealId);
    }
    tx.set(
      engagementRef,
      stripUndefined({
        ...parsed,
        createdAt: now,
        updatedAt: now,
      })
    );
    tx.update(dealRef, {
      supplierIds: FieldValue.arrayUnion(parsed.supplierId),
      updatedAt: now,
      updatedBy: actor.email,
    });
    tx.set(
      eventRef,
      stripUndefined({
        type: "note",
        actor: actor.email,
        at: now,
        body: `공급자 배정: ${parsed.supplierId}`,
      })
    );
  });

  return engagementRef.id;
}

export async function updateSupplierEngagement(
  dealId: string,
  engagementId: string,
  patch: Partial<SupplierEngagementInput>,
  actor: AdminIdentity
): Promise<void> {
  const parsed = supplierEngagementPatchSchema.parse(patch);
  const db = getAdminDb();
  const dealRef = db.collection(DEALS_COLLECTION).doc(dealId);
  const engagementRef = dealRef.collection("supplierEngagements").doc(engagementId);
  const eventRef = dealRef.collection("events").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const [dealDoc, engagementDoc] = await Promise.all([
      tx.get(dealRef),
      tx.get(engagementRef),
    ]);
    if (!dealDoc.exists) throw new DealNotFoundError(dealId);
    if (!engagementDoc.exists) throw new EngagementNotFoundError(engagementId);

    tx.update(engagementRef, {
      ...stripUndefined(parsed),
      updatedAt: now,
      updatedBy: actor.email,
    });
    tx.update(dealRef, { updatedAt: now, updatedBy: actor.email });
    tx.set(eventRef, {
      type: "note",
      actor: actor.email,
      at: now,
      body: `공급자 관계 수정: ${engagementId}`,
    });
  });
}

export async function replaceSupplierEngagement(
  dealId: string,
  oldEngagementId: string,
  replacement: SupplierEngagementInput,
  reason: string,
  actor: AdminIdentity,
  sourceRefs: string[] = [],
): Promise<string> {
  const parsed = supplierEngagementInputSchema.parse(replacement);
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new InvalidEngagementReferenceError("공급자 교체 사유는 필수입니다.");

  const db = getAdminDb();
  const dealRef = db.collection(DEALS_COLLECTION).doc(dealId);
  const oldEngagementRef = dealRef.collection("supplierEngagements").doc(oldEngagementId);
  const newEngagementRef = dealRef.collection("supplierEngagements").doc();
  const eventRef = dealRef.collection("events").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const [dealDoc, oldEngagementDoc] = await Promise.all([
      tx.get(dealRef),
      tx.get(oldEngagementRef),
    ]);
    if (!dealDoc.exists) throw new DealNotFoundError(dealId);
    if (!oldEngagementDoc.exists) throw new EngagementNotFoundError(oldEngagementId);

    const oldSupplierId = oldEngagementDoc.data()?.supplierId;
    if (oldEngagementDoc.data()?.contactStatus === "drop") {
      throw new InvalidEngagementReferenceError("이미 종료된 공급자 관계는 교체할 수 없습니다.");
    }
    if (oldSupplierId === parsed.supplierId) {
      throw new InvalidEngagementReferenceError("교체 대상과 새 공급자는 달라야 합니다.");
    }

    tx.update(oldEngagementRef, {
      contactStatus: "drop",
      updatedAt: now,
      updatedBy: actor.email,
    });
    tx.set(newEngagementRef, {
      ...stripUndefined({ ...parsed, contactStatus: "ing", stageFactory: 1 }),
      createdAt: now,
      updatedAt: now,
      createdBy: actor.email,
      updatedBy: actor.email,
    });
    tx.update(dealRef, {
      supplierIds: FieldValue.arrayUnion(parsed.supplierId),
      updatedAt: now,
      updatedBy: actor.email,
    });
    tx.set(eventRef, stripUndefined({
      type: "note",
      actor: actor.email,
      at: now,
      body: `공급자 교체: ${oldSupplierId} -> ${parsed.supplierId}; 사유: ${trimmedReason}`,
      reason: trimmedReason,
      sourceRefs,
    }));
  });

  return newEngagementRef.id;
}

export async function addSampleRound(
  dealId: string,
  round: SampleRoundInput,
  actor: AdminIdentity
): Promise<string> {
  const parsed = sampleRoundInputSchema.parse(round);
  const docId = sampleRoundDocId(parsed.itemId, parsed.roundNo);
  const db = getAdminDb();
  const roundRef = db
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("sampleRounds")
    .doc(docId);
  const dealRef = db.collection(DEALS_COLLECTION).doc(dealId);
  const engagementRef = dealRef.collection("supplierEngagements").doc(parsed.engagementId);
  const eventRef = dealRef.collection("events").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const [dealDoc, engagementDoc, existing] = await Promise.all([
      tx.get(dealRef),
      tx.get(engagementRef),
      tx.get(roundRef),
    ]);
    if (!dealDoc.exists) throw new DealNotFoundError(dealId);
    if (!engagementDoc.exists) throw new EngagementNotFoundError(parsed.engagementId);
    if (engagementDoc.data()?.supplierId !== parsed.supplierId) {
      throw new InvalidEngagementReferenceError("샘플의 supplierId와 engagementId가 일치하지 않습니다.");
    }
    if (existing.exists) {
      throw new DuplicateSampleRoundError(parsed.itemId, parsed.roundNo);
    }
    tx.set(
      roundRef,
      stripUndefined({
        ...parsed,
        createdAt: now,
        updatedAt: now,
      })
    );
    tx.set(eventRef, {
      type: "note",
      actor: actor.email,
      at: now,
      body: `샘플 회차 등록: ${docId}`,
    });
  });

  return docId;
}

export async function updateSampleRound(
  dealId: string,
  roundId: string,
  patch: Partial<SampleRoundInput>,
  _actor: AdminIdentity
): Promise<void> {
  const parsed = sampleRoundPatchSchema.parse(patch);
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("sampleRounds")
    .doc(roundId)
    .update({
      ...stripUndefined(parsed),
      updatedAt: now,
    });
}

export async function upsertShipment(
  dealId: string,
  shipment: ShipmentInput | Partial<ShipmentInput>,
  actor: AdminIdentity,
  shipmentId?: string
): Promise<string> {
  const now = new Date().toISOString();
  const db = getAdminDb();
  const dealRef = db
    .collection(DEALS_COLLECTION)
    .doc(dealId);
  const colRef = dealRef.collection("shipments");

  if (shipmentId) {
    const shipmentRef = colRef.doc(shipmentId);
    const eventRef = dealRef.collection("events").doc();
    const parsed = shipmentPatchSchema.parse(shipment);
    await db.runTransaction(async (tx) => {
      const [dealDoc, shipmentDoc] = await Promise.all([
        tx.get(dealRef),
        tx.get(shipmentRef),
      ]);
      if (!dealDoc.exists) throw new DealNotFoundError(dealId);
      if (!shipmentDoc.exists) throw new InvalidEngagementReferenceError(`배송을 찾을 수 없습니다: ${shipmentId}`);
      tx.update(shipmentRef, {
        ...stripUndefined(parsed),
        updatedAt: now,
      });
      tx.set(eventRef, {
        type: "note",
        actor: actor.email,
        at: now,
        body: `배송 수정: ${shipmentId}`,
      });
    });
    return shipmentId;
  } else {
    const parsed = shipmentInputSchema.parse(shipment as ShipmentInput);
    const ref = colRef.doc();
    const eventRef = dealRef.collection("events").doc();
    await db.runTransaction(async (tx) => {
      const dealDoc = await tx.get(dealRef);
      if (!dealDoc.exists) throw new DealNotFoundError(dealId);

      let engagementData: FirebaseFirestore.DocumentData | undefined;
      if (parsed.engagementId) {
        const engagementDoc = await tx.get(dealRef.collection("supplierEngagements").doc(parsed.engagementId));
        if (!engagementDoc.exists) throw new EngagementNotFoundError(parsed.engagementId);
        engagementData = engagementDoc.data();
      }
      if (parsed.kind === "sample") {
        const roundDoc = await tx.get(dealRef.collection("sampleRounds").doc(parsed.sampleRoundId!));
        if (!roundDoc.exists) {
          throw new InvalidEngagementReferenceError(`샘플 회차를 찾을 수 없습니다: ${parsed.sampleRoundId}`);
        }
        const roundData = roundDoc.data();
        if (parsed.engagementId && roundData?.engagementId !== parsed.engagementId) {
          throw new InvalidEngagementReferenceError("배송의 engagementId와 샘플 회차의 engagementId가 일치하지 않습니다.");
        }
        if (engagementData && engagementData.supplierId !== roundData?.supplierId) {
          throw new InvalidEngagementReferenceError("배송의 engagementId와 샘플 회차의 supplierId가 일치하지 않습니다.");
        }
      }
      tx.set(ref, stripUndefined({ ...parsed, createdAt: now, updatedAt: now }));
      tx.set(eventRef, {
        type: "note",
        actor: actor.email,
        at: now,
        body: `배송 등록: ${ref.id}`,
      });
    });
    return ref.id;
  }
}

export async function createTask(
  dealId: string,
  task: DealTaskInput,
  actor: AdminIdentity
): Promise<string> {
  const parsed = dealTaskInputSchema.parse(task);
  const now = new Date().toISOString();
  const ref = await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("tasks")
    .add(
      stripUndefined({
        ...parsed,
        status: parsed.status ?? "open",
        createdAt: now,
        createdBy: actor.email,
      })
    );
  return ref.id;
}

export async function completeTask(
  dealId: string,
  taskId: string,
  actor: AdminIdentity
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("tasks")
    .doc(taskId)
    .update({
      status: "done",
      completedAt: now,
      completedBy: actor.email,
    });
}
