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
import type { Extraction } from "@/lib/schemas/extraction";

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

    let threadRef: FirebaseFirestore.DocumentReference | null = null;
    let threadExists = false;
    if (intakeData?.source === "message" && intakeData?.externalId) {
      threadRef = db.collection("threads").doc(intakeData.externalId);
      const threadSnap = await tx.get(threadRef);
      threadExists = threadSnap.exists;
    }

    const { items = [], ...dealWithoutItems } = parsed;
    const dealData = stripUndefined({
      ...dealWithoutItems,
      stageBrand: 1,
      supplierIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor.email,
      updatedBy: actor.email,
    });

    tx.set(newDealRef, dealData);

    // Save initial items if provided
    if (items.length > 0) {
      for (const item of items) {
        const itemRef = newDealRef.collection("items").doc();
        tx.set(
          itemRef,
          stripUndefined({
            ...item,
            id: itemRef.id,
            createdAt: now,
            updatedAt: now,
          })
        );
      }
    }

    tx.update(intakeReviewRef, { dealId: newDealRef.id });

    if (threadRef && threadExists) {
      tx.update(threadRef, {
        dealId: newDealRef.id,
        linkState: "linked",
        linkedBy: actor.email,
        linkedAt: now,
        updatedAt: now,
      });
    }

    const sourceRefs = parsed.sourceRefs ? [...parsed.sourceRefs] : [];
    if (intakeData?.source === "message" && intakeData?.externalId) {
      const threadSourceRef = `threads/${intakeData.externalId}`;
      if (!sourceRefs.includes(threadSourceRef)) {
        sourceRefs.push(threadSourceRef);
      }
    }

    tx.set(
      eventRef,
      stripUndefined({
        type: "stage",
        to: 1,
        actor: actor.email,
        at: now,
        body: "딜 생성",
        sourceRefs,
      })
    );
  });

  return newDealRef.id;
}

/**
 * 과거 데이터 동기화:
 * message 소스의 intakeReviews 중 dealId가 등록되어 있으나 대응 threads 문서에 dealId가 누락된 경우 동기화한다.
 */
export async function backfillDealThreads(): Promise<{ updatedCount: number; scannedCount: number }> {
  const db = getAdminDb();
  const snap = await db.collection(INTAKE_REVIEWS_COLLECTION).where("source", "==", "message").get();
  let updatedCount = 0;
  let scannedCount = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.dealId && data.externalId) {
      scannedCount++;
      const threadRef = db.collection("threads").doc(data.externalId);
      const threadSnap = await threadRef.get();
      if (threadSnap.exists && threadSnap.data()?.dealId !== data.dealId) {
        await threadRef.update({
          dealId: data.dealId,
          linkState: "linked",
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      }
    }
  }
  return { updatedCount, scannedCount };
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

/**
 * 인박스에서 제안 확정 시 연결된 딜에 제품, 바이어, 배송, 일정 정보를 동기화.
 */
export async function syncDealFromAcceptedExtraction(
  dealId: string,
  accepted: Extraction,
  actorEmail: string,
  messageId: string,
  threadKey: string,
): Promise<{ deal: Deal; itemsAddedCount: number }> {
  const db = getAdminDb();
  const dealRef = db.collection(DEALS_COLLECTION).doc(dealId);
  const now = new Date().toISOString();

  const dealDoc = await dealRef.get();
  if (!dealDoc.exists) {
    throw new DealNotFoundError(dealId);
  }

  const currentDeal = { id: dealDoc.id, ...dealDoc.data() } as Deal;

  // 1. Core Deal Data Update
  const updatedBuyerInfo = { ...currentDeal.buyerInfo };
  if (accepted.buyer?.brandName) updatedBuyerInfo.companyName = accepted.buyer.brandName;
  if (accepted.buyer?.name) updatedBuyerInfo.contactName = accepted.buyer.name;
  if (accepted.buyer?.email) updatedBuyerInfo.email = accepted.buyer.email.toLowerCase();
  if (accepted.buyer?.country) updatedBuyerInfo.country = accepted.buyer.country;

  const updatedShippingInfo = { ...currentDeal.shippingInfo };
  if (accepted.shipping?.country) updatedShippingInfo.country = accepted.shipping.country;
  if (accepted.shipping?.city) updatedShippingInfo.city = accepted.shipping.city;
  if (accepted.buyer?.name && !updatedShippingInfo.recipientName) {
    updatedShippingInfo.recipientName = accepted.buyer.name;
  }

  const updatedTimeline = { ...currentDeal.timeline };
  if (accepted.timeline?.sampleTargetDate) {
    updatedTimeline.targetSampleDate = accepted.timeline.sampleTargetDate;
  }
  if (accepted.timeline?.targetLaunchDate) {
    updatedTimeline.targetDeliveryDate = accepted.timeline.targetLaunchDate;
  }

  // Certifications union
  const mergedCerts = Array.from(
    new Set([
      ...(currentDeal.certifications || []),
      ...(accepted.certifications?.requiredCerts || []),
    ]),
  );

  // Update Deal document
  await dealRef.update(
    stripUndefined({
      buyerInfo: updatedBuyerInfo,
      shippingInfo: updatedShippingInfo,
      timeline: updatedTimeline,
      certifications: mergedCerts,
      updatedAt: now,
      updatedBy: actorEmail,
    }),
  );

  // 2. Sync Items into deals/{dealId}/items
  let itemsAddedCount = 0;
  if (accepted.items && accepted.items.length > 0) {
    const itemsColRef = dealRef.collection("items");
    const existingItemsSnap = await itemsColRef.get();
    const existingItems = existingItemsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as DealItem,
    );

    for (const extItem of accepted.items) {
      const pType = extItem.productName || extItem.category || "화장품";
      const vName = extItem.variantName || extItem.category || "";
      const vol = extItem.volume || "";

      let parsedQty = 1000;
      if (typeof extItem.expectedQty === "number") {
        parsedQty = extItem.expectedQty > 0 ? Math.floor(extItem.expectedQty) : 1000;
      } else if (typeof extItem.expectedQty === "string") {
        const num = parseInt(extItem.expectedQty.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(num) && num > 0) parsedQty = num;
      }

      const existing = existingItems.find(
        (it) =>
          it.productType.toLowerCase() === pType.toLowerCase() &&
          (it.variantName || "").toLowerCase() === vName.toLowerCase(),
      );

      if (existing) {
        await itemsColRef.doc(existing.id).update(
          stripUndefined({
            volume: vol || existing.volume,
            quantity: parsedQty || existing.quantity,
            formulaSpec: {
              targetTexture: extItem.formula?.notes || extItem.formula?.formulaType || existing.formulaSpec?.targetTexture,
              keyIngredients: extItem.formula?.keyIngredients || existing.formulaSpec?.keyIngredients,
            },
            packagingSpec: {
              containerType: extItem.packaging?.containerType || existing.packagingSpec?.containerType,
              material: extItem.packaging?.material || existing.packagingSpec?.material,
              closure: extItem.packaging?.outerBox || existing.packagingSpec?.closure,
            },
            updatedAt: now,
          }),
        );
      } else {
        await itemsColRef.add(
          stripUndefined({
            productType: pType,
            variantName: vName,
            volume: vol,
            quantity: parsedQty,
            formulaSpec: {
              targetTexture: extItem.formula?.notes || extItem.formula?.formulaType || "",
              keyIngredients: extItem.formula?.keyIngredients || "",
            },
            packagingSpec: {
              containerType: extItem.packaging?.containerType || "",
              material: extItem.packaging?.material || "",
              closure: extItem.packaging?.outerBox || "",
            },
            createdAt: now,
            updatedAt: now,
          }),
        );
        itemsAddedCount++;
      }
    }
  }

  // 3. Append Event Log
  await dealRef.collection("events").add(
    stripUndefined({
      type: "note",
      actor: actorEmail,
      at: now,
      body: "인박스 제안 확정 데이터가 딜 정보에 자동 동기화되었습니다.",
      sourceRefs: [`messages/${messageId}`, `threads/${threadKey}`],
    }),
  );

  const finalDoc = await dealRef.get();
  return {
    deal: { id: finalDoc.id, ...finalDoc.data() } as Deal,
    itemsAddedCount,
  };
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
