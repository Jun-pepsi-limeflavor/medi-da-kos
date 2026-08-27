import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
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
}>;

const DEFAULT_LIMIT = 300;

export class ThreadNotFoundError extends Error {
  constructor(threadKey: string) {
    super(`thread not found: ${threadKey}`);
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
    return true;
  });
}

export async function getThread(threadKey: string): Promise<Thread | null> {
  const doc = await getAdminDb().collection(COLLECTION).doc(threadKey).get();
  return doc.exists ? toThread(doc.id, doc.data()!) : null;
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
  await getAdminDb().collection(COLLECTION).doc(threadKey).update({
    ...parsed,
    linkState: "linked",
    linkedBy: actor.email,
    linkedAt: now,
    updatedAt: now,
  });
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
