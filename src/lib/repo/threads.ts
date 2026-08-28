import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import { DealNotFoundError } from "@/lib/repo/deals";
import { sideSchema, type Message } from "@/lib/schemas/message";
import {
  appendSideCorrection,
  extractCounterpartyAddress,
  needsReply,
  resolveAddressMatchSide,
  threadLinkInputSchema,
  threadStatePatchSchema,
  type Thread,
} from "@/lib/schemas/thread";
import { findBuyerByEmail } from "@/lib/repo/buyers";
import { findSupplierByEmail } from "@/lib/repo/suppliers";
import { ConversationNotFoundError } from "@/lib/repo/conversations";
import type { Buyer } from "@/lib/schemas/buyer";
import type { Supplier } from "@/lib/schemas/supplier";

const COLLECTION = "threads";

export type ThreadFilters = Partial<{
  readState: Thread["readState"];
  triageState: Thread["triageState"];
  linkState: Thread["linkState"];
  side: Thread["side"];
  channel: Thread["channel"];
  needsReply: boolean;
  direction: "in" | "out";
}>;

const DEFAULT_LIMIT = 300;

export class ThreadNotFoundError extends Error {
  constructor(threadKey: string) {
    super(`thread not found: ${threadKey}`);
  }
}

export class ThreadNotConnectedError extends Error {
  constructor() {
    super("thread is not connected to a conversation");
    this.name = "ThreadNotConnectedError";
  }
}

function toThread(id: string, data: FirebaseFirestore.DocumentData): Thread {
  return { threadKey: id, ...data } as Thread;
}

/**
 * ponytail: 최근 n개(기본 300)를 읽어 메모리에서 필터한다. 지금 규모에 필터
 * 조합별 복합 인덱스를 만들지 않는다. 스레드 수가 늘거나 필터가 인덱스 없이
 * 놓치는 스레드가 생기면 그때 인덱스를 추가한다.
 */
export async function listThreads(filters: ThreadFilters = {}, limit = DEFAULT_LIMIT): Promise<Thread[]> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .orderBy("lastMessageAt", "desc")
    .limit(limit)
    .get();
  const threads = snap.docs.map((d) => toThread(d.id, d.data()));
  return threads.filter((t) => {
    if (filters.readState && t.readState !== filters.readState) return false;
    if (filters.triageState && t.triageState !== filters.triageState) return false;
    if (filters.linkState && t.linkState !== filters.linkState) return false;
    if (filters.side && t.side !== filters.side) return false;
    if (filters.channel && t.channel !== filters.channel) return false;
    if (filters.needsReply !== undefined && needsReply(t) !== filters.needsReply) return false;
    if (filters.direction && t.lastDirection !== filters.direction) return false;
    return true;
  });
}

export async function getThread(threadKey: string): Promise<Thread | null> {
  const doc = await getAdminDb().collection(COLLECTION).doc(threadKey).get();
  return doc.exists ? toThread(doc.id, doc.data()!) : null;
}

/** Marks the observed inbound work complete without changing provider records. */
export async function markThreadHandled(threadKey: string, actor: AdminIdentity): Promise<void> {
  const db = getAdminDb();
  const threadRef = db.collection(COLLECTION).doc(threadKey);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const threadDoc = await tx.get(threadRef);
    if (!threadDoc.exists) throw new ThreadNotFoundError(threadKey);
    const thread = toThread(threadDoc.id, threadDoc.data()!);
    if (!thread.conversationId) throw new ThreadNotConnectedError();
    const conversationRef = db.collection("conversations").doc(thread.conversationId);
    const conversation = await tx.get(conversationRef);
    if (!conversation.exists) throw new ConversationNotFoundError();

    tx.update(threadRef, { handledThroughAt: now });
    tx.set(conversationRef.collection("events").doc(), {
      action: "thread_handled",
      actorEmail: actor.email,
      at: now,
      threadKey,
      handledThroughAt: now,
    });
  });
}

export async function setThreadState(
  threadKey: string,
  patch: unknown,
  actor: AdminIdentity,
): Promise<void> {
  const parsed = threadStatePatchSchema.parse(patch);
  await getAdminDb().collection(COLLECTION).doc(threadKey).update({
    ...parsed,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email,
  });
}

export async function linkThread(
  threadKey: string,
  link: unknown,
  actor: AdminIdentity,
): Promise<void> {
  const parsed = threadLinkInputSchema.parse(link);
  const now = new Date().toISOString();

  if (typeof parsed.dealId === "string") {
    const dealDoc = await getAdminDb().collection("deals").doc(parsed.dealId).get();
    if (!dealDoc.exists) {
      throw new DealNotFoundError(parsed.dealId);
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: now,
  };

  if (parsed.buyerId !== undefined) {
    updateData.buyerId = parsed.buyerId;
    updateData.linkState = "linked";
    updateData.linkedBy = actor.email;
    updateData.linkedAt = now;
  }
  if (parsed.supplierId !== undefined) {
    updateData.supplierId = parsed.supplierId;
    updateData.linkState = "linked";
    updateData.linkedBy = actor.email;
    updateData.linkedAt = now;
  }
  if (parsed.dealId !== undefined) {
    if (parsed.dealId === null) {
      updateData.dealId = FieldValue.delete();
    } else {
      updateData.dealId = parsed.dealId;
      updateData.linkState = "linked";
      updateData.linkedBy = actor.email;
      updateData.linkedAt = now;
    }
  }

  await getAdminDb().collection(COLLECTION).doc(threadKey).update(updateData);
}

export async function getThreadsByDealId(dealId: string): Promise<Thread[]> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("dealId", "==", dealId)
    .get();
  return snap.docs.map((d) => toThread(d.id, d.data()));
}

export type AddressMatchResult = {
  thread: Thread;
  counterpartyEmail: string | null;
  buyerCandidate: Buyer | null;
  supplierCandidate: Supplier | null;
};

/**
 * Task 3 Step 1 — 스레드 상세를 열 때마다 부른다. 마지막 메시지의 상대 주소를
 * buyers·suppliers 양쪽에서 조회하고, resolveAddressMatchSide()가 side를 고치라고
 * 하면 Firestore에 반영한다. 원문 메시지는 건드리지 않는다. 사람이 아니라 이
 * 판정이 쓴 것이므로 updatedBy는 이메일이 아니라 "system:address-match"다.
 */
export async function applyAddressMatch(
  thread: Thread,
  messages: Pick<Message, "direction" | "from" | "to">[],
): Promise<AddressMatchResult> {
  if (thread.sideSource === "manual") {
    return { thread, counterpartyEmail: null, buyerCandidate: null, supplierCandidate: null };
  }

  const counterpartyEmail = extractCounterpartyAddress(messages, thread.sourceAccount);
  if (!counterpartyEmail) {
    return { thread, counterpartyEmail: null, buyerCandidate: null, supplierCandidate: null };
  }

  const [buyerCandidate, supplierCandidate] = await Promise.all([
    findBuyerByEmail(counterpartyEmail),
    findSupplierByEmail(counterpartyEmail),
  ]);

  const resolved = resolveAddressMatchSide(thread, {
    buyer: !!buyerCandidate,
    supplier: !!supplierCandidate,
  });

  if (resolved.side === thread.side && resolved.sideSource === thread.sideSource) {
    return { thread, counterpartyEmail, buyerCandidate, supplierCandidate };
  }

  const now = new Date().toISOString();
  await getAdminDb().collection(COLLECTION).doc(thread.threadKey).update({
    side: resolved.side,
    sideSource: resolved.sideSource,
    updatedAt: now,
    updatedBy: "system:address-match",
  });

  return {
    thread: { ...thread, side: resolved.side, sideSource: resolved.sideSource, updatedAt: now },
    counterpartyEmail,
    buyerCandidate,
    supplierCandidate,
  };
}

/** 사유 없는 정정은 threadStatePatchSchema와 같은 이유로 거부한다 — appendSideCorrection이 검사한다. */
export async function correctThreadSide(
  threadKey: string,
  correction: { side: unknown; reason: string },
  actor: AdminIdentity,
): Promise<void> {
  const nextSide = sideSchema.parse(correction.side);
  const ref = getAdminDb().collection(COLLECTION).doc(threadKey);
  await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ThreadNotFoundError(threadKey);
    const current = toThread(snap.id, snap.data()!);
    const now = new Date().toISOString();
    const update = appendSideCorrection(current, {
      side: nextSide,
      reason: correction.reason,
      actor: actor.email,
      at: now,
    });
    tx.update(ref, { ...update, updatedAt: now });
  });
}
