import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import { stripUndefined } from "@/lib/firestore-sanitize";
import {
  dealInputSchema,
  dealItemInputSchema,
  supplierEngagementInputSchema,
  sampleRoundInputSchema,
  sampleRoundDocId,
  shipmentInputSchema,
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
  _actor: AdminIdentity
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("supplierEngagements")
    .doc(engagementId)
    .update({
      ...stripUndefined(patch),
      updatedAt: now,
    });
}

export async function addSampleRound(
  dealId: string,
  round: SampleRoundInput,
  _actor: AdminIdentity
): Promise<string> {
  const parsed = sampleRoundInputSchema.parse(round);
  const docId = sampleRoundDocId(parsed.itemId, parsed.roundNo);
  const db = getAdminDb();
  const roundRef = db
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("sampleRounds")
    .doc(docId);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(roundRef);
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
  });

  return docId;
}

export async function updateSampleRound(
  dealId: string,
  roundId: string,
  patch: Partial<SampleRoundInput>,
  _actor: AdminIdentity
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("sampleRounds")
    .doc(roundId)
    .update({
      ...stripUndefined(patch),
      updatedAt: now,
    });
}

export async function upsertShipment(
  dealId: string,
  shipment: ShipmentInput | Partial<ShipmentInput>,
  _actor: AdminIdentity,
  shipmentId?: string
): Promise<string> {
  const now = new Date().toISOString();
  const colRef = getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection("shipments");

  if (shipmentId) {
    await colRef.doc(shipmentId).update({
      ...stripUndefined(shipment),
      updatedAt: now,
    });
    return shipmentId;
  } else {
    const parsed = shipmentInputSchema.parse(shipment as ShipmentInput);
    const ref = await colRef.add(
      stripUndefined({
        ...parsed,
        createdAt: now,
        updatedAt: now,
      })
    );
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
