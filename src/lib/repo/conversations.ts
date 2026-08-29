import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import type { AdminIdentity } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { messageSchema } from "@/lib/schemas/message";
import { conversationIdentitySchema, type ConversationIdentity } from "@/lib/schemas/conversation-identity";
import {
  conversationPatchSchema,
  conversationRollupSchema,
  conversationSchema,
  type Conversation,
  type ConversationPatch,
  type ConversationRollup,
} from "@/lib/schemas/conversation";
import { threadSchema, type Thread } from "@/lib/schemas/thread";

const CONVERSATIONS = "conversations";
const IDENTITIES = "conversationIdentities";
const THREADS = "threads";
const MESSAGES = "messages";

const idSchema = z.string().trim().min(1);
const reasonSchema = z.string().trim().min(1).max(1_000);

export const identityClassificationInputSchema = z.discriminatedUnion("classification", [
  z.object({
    classification: z.literal("buyer"),
    buyerId: idSchema,
    conversationId: idSchema,
    reason: reasonSchema,
  }).strict(),
  z.object({
    classification: z.literal("supplier"),
    supplierId: idSchema,
    conversationId: idSchema,
    reason: reasonSchema,
  }).strict(),
  z.object({
    classification: z.enum(["unclassified", "internal", "advertising"]),
    reason: reasonSchema,
  }).strict(),
]);

type IdentityClassificationInput = z.infer<typeof identityClassificationInputSchema>;

const CONVERSATION_FIELDS = [
  "buyerId", "supplierId", "identityIds", "mergedConversationIds", "ownerEmail", "collaboratorEmails",
  "workflowState", "nextAction", "dueAt", "defaultOutboundAccount", "counterpartyLabel", "lastSubject",
  "lastSnippet", "providerLabels", "lastActivityAt", "oldestUnansweredAt", "unansweredThreadCount",
  "threadCount", "createdAt", "updatedAt",
] as const;
const ROLLUP_FIELDS = [
  "buyerId", "supplierId", "identityIds", "ownerEmail", "workflowState", "nextAction", "dueAt",
  "counterpartyLabel", "lastSubject", "lastSnippet", "providerLabels", "lastActivityAt",
  "oldestUnansweredAt", "unansweredThreadCount", "threadCount",
] as const;
const IDENTITY_FIELDS = [
  "kind", "value", "classification", "conversationId", "buyerId", "supplierId", "createdAt", "updatedAt",
] as const;
const THREAD_FIELDS = [
  "channel", "sourceAccount", "providerThreadId", "readState", "triageState", "linkState", "side",
  "sideSource", "sideHistory", "lastMessageAt", "lastDirection", "createdAt", "updatedAt", "buyerId",
  "supplierId", "dealId", "linkedBy", "linkedAt", "identityId", "classification", "conversationId",
  "lastInboundAt", "lastOutboundAt", "handledThroughAt",
] as const;
export const conversationMessageSchema = messageSchema.pick({
  channel: true,
  sourceAccount: true,
  providerThreadId: true,
  threadKey: true,
  direction: true,
  from: true,
  fromName: true,
  to: true,
  subject: true,
  sentAt: true,
}).strict();

export type ConversationMessage = z.infer<typeof conversationMessageSchema> & { id: string };

export class ConversationNotFoundError extends Error {
  constructor() {
    super("conversation not found");
    this.name = "ConversationNotFoundError";
  }
}

export class ConversationIdentityNotFoundError extends Error {
  constructor() {
    super("conversation identity not found");
    this.name = "ConversationIdentityNotFoundError";
  }
}

export class ConversationRelationConflictError extends Error {
  constructor() {
    super("conversation relation conflict");
    this.name = "ConversationRelationConflictError";
  }
}

export class ConversationEntityNotFoundError extends Error {
  constructor() {
    super("linked entity not found");
    this.name = "ConversationEntityNotFoundError";
  }
}

function pickFields(data: FirebaseFirestore.DocumentData, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.flatMap((field) => field in data ? [[field, data[field]]] : []));
}

export function projectConversation(id: string, data: FirebaseFirestore.DocumentData): Conversation {
  return { id, ...conversationSchema.parse(pickFields(data, CONVERSATION_FIELDS)) };
}

export function projectConversationRollup(id: string, data: FirebaseFirestore.DocumentData): ConversationRollup {
  return { id, ...conversationRollupSchema.parse(pickFields(data, ROLLUP_FIELDS)) };
}

export function projectConversationIdentity(id: string, data: FirebaseFirestore.DocumentData): ConversationIdentity {
  return { id, ...conversationIdentitySchema.parse(pickFields(data, IDENTITY_FIELDS)) };
}

export function projectConversationThread(id: string, data: FirebaseFirestore.DocumentData): Thread {
  return { threadKey: id, ...threadSchema.parse(pickFields(data, THREAD_FIELDS)) };
}

export function projectConversationMessage(id: string, data: FirebaseFirestore.DocumentData): ConversationMessage {
  return { id, ...conversationMessageSchema.parse(pickFields(data, Object.keys(conversationMessageSchema.shape))) };
}

function compareRollups(now: string, a: ConversationRollup, b: ConversationRollup): number {
  const overdue = (conversation: ConversationRollup) =>
    conversation.workflowState !== "done" && !!conversation.dueAt && conversation.dueAt < now;
  const unanswered = (conversation: ConversationRollup) => conversation.oldestUnansweredAt ?? "\uffff";

  return Number(overdue(b)) - Number(overdue(a))
    || unanswered(a).localeCompare(unanswered(b))
    || Number(!b.ownerEmail) - Number(!a.ownerEmail)
    || b.lastActivityAt.localeCompare(a.lastActivityAt);
}

/** The customer-work queue is read solely from its server-maintained rollups. */
export async function listConversationRollups(_queue: "customer-work" = "customer-work"): Promise<ConversationRollup[]> {
  void _queue;
  const snap = await getAdminDb().collection(CONVERSATIONS).get();
  const now = new Date().toISOString();
  return snap.docs
    .map((doc) => projectConversationRollup(doc.id, doc.data()))
    .sort((a, b) => compareRollups(now, a, b));
}

export type ConversationEvent = {
  id: string;
  action: string;
  actorEmail?: string;
  at: string;
  reason?: string;
  fields?: string[];
  [key: string]: unknown;
};

export type ConversationDetail = {
  conversation: Conversation;
  identities: ConversationIdentity[];
  threads: Thread[];
  messages: ConversationMessage[];
  events: ConversationEvent[];
};

/** Detail-only reads are server-only; message reads never occur in the list path. */
export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  const db = getAdminDb();
  const conversationRef = db.collection(CONVERSATIONS).doc(id);
  const conversationDoc = await conversationRef.get();
  if (!conversationDoc.exists) return null;

  const [identitySnap, threadSnap, eventSnap] = await Promise.all([
    db.collection(IDENTITIES).where("conversationId", "==", id).get(),
    db.collection(THREADS).where("conversationId", "==", id).get(),
    conversationRef.collection("events").orderBy("at", "desc").limit(30).get(),
  ]);
  const threads = threadSnap.docs.map((doc) => projectConversationThread(doc.id, doc.data()));
  const messageSnaps = await Promise.all(
    threads.map((thread) => db.collection(MESSAGES).where("threadKey", "==", thread.threadKey).get()),
  );
  const events: ConversationEvent[] = eventSnap.docs.map((doc) => ({
    id: doc.id,
    action: String(doc.data().action || "unknown"),
    actorEmail: typeof doc.data().actorEmail === "string" ? doc.data().actorEmail : undefined,
    at: String(doc.data().at || ""),
    reason: typeof doc.data().reason === "string" ? doc.data().reason : undefined,
    fields: Array.isArray(doc.data().fields) ? doc.data().fields : undefined,
    ...doc.data(),
  }));

  return {
    conversation: projectConversation(conversationDoc.id, conversationDoc.data()!),
    identities: identitySnap.docs.map((doc) => projectConversationIdentity(doc.id, doc.data())),
    threads,
    messages: messageSnaps.flatMap((snap) => snap.docs.map((doc) => projectConversationMessage(doc.id, doc.data())))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    events,
  };
}

export interface ReviewIdentityItem {
  identity: ConversationIdentity;
  threadCount: number;
  latestThread?: Thread;
  latestMessageSnippet?: string;
  channels: string[];
}

export type ReviewQueueFilter = "unclassified" | "supplier" | "internal" | "advertising" | "all_review";

export async function listReviewIdentities(
  filter: ReviewQueueFilter = "unclassified",
): Promise<ReviewIdentityItem[]> {
  const db = getAdminDb();
  let snap: FirebaseFirestore.QuerySnapshot;
  if (filter === "all_review") {
    snap = await db.collection(IDENTITIES)
      .where("classification", "in", ["unclassified", "internal", "advertising"])
      .get();
  } else {
    snap = await db.collection(IDENTITIES)
      .where("classification", "==", filter)
      .get();
  }
  const identities = snap.docs.map((doc) => projectConversationIdentity(doc.id, doc.data()));
  if (identities.length === 0) return [];

  // Bulk query all threads to avoid 1,000+ individual roundtrips
  const threadSnap = await db.collection(THREADS).get();
  const threadsByIdentity = new Map<string, Thread[]>();
  for (const doc of threadSnap.docs) {
    const data = doc.data();
    const id = data.identityId as string | undefined;
    if (id) {
      if (!threadsByIdentity.has(id)) threadsByIdentity.set(id, []);
      threadsByIdentity.get(id)!.push(projectConversationThread(doc.id, data));
    }
  }

  const items: ReviewIdentityItem[] = identities.map((identity) => {
    const threads = threadsByIdentity.get(identity.id) || [];
    threads.sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
    const latestThread = threads[0];
    const channels = Array.from(new Set(threads.map((t) => t.channel)));

    return {
      identity,
      threadCount: threads.length,
      latestThread,
      latestMessageSnippet: undefined,
      channels,
    };
  });

  items.sort((a, b) => {
    const timeA = a.latestThread?.lastMessageAt || a.identity.updatedAt || "";
    const timeB = b.latestThread?.lastMessageAt || b.identity.updatedAt || "";
    return timeB.localeCompare(timeA);
  });

  return items;
}

export type ReviewIdentityDetail = {
  identity: ConversationIdentity;
  threads: Thread[];
  messages: ConversationMessage[];
};

export async function getReviewIdentityDetail(identityId: string): Promise<ReviewIdentityDetail | null> {
  const db = getAdminDb();
  const identityDoc = await db.collection(IDENTITIES).doc(identityId).get();
  if (!identityDoc.exists) return null;

  const identity = projectConversationIdentity(identityDoc.id, identityDoc.data()!);
  const threadSnap = await db.collection(THREADS).where("identityId", "==", identityId).get();
  const threads = threadSnap.docs.map((doc) => projectConversationThread(doc.id, doc.data()));
  const messageSnaps = await Promise.all(
    threads.map((thread) => db.collection(MESSAGES).where("threadKey", "==", thread.threadKey).get()),
  );

  return {
    identity,
    threads,
    messages: messageSnaps
      .flatMap((snap) => snap.docs.map((doc) => projectConversationMessage(doc.id, doc.data())))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
  };
}

function patchData(patch: ConversationPatch): FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> {
  const data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {};
  for (const [key, value] of Object.entries(patch)) {
    data[key] = value === null ? FieldValue.delete() : value;
  }
  return data;
}

export async function patchConversation(
  id: string,
  patch: unknown,
  actor: AdminIdentity,
): Promise<void> {
  const parsed = conversationPatchSchema.parse(patch);
  const db = getAdminDb();
  const conversationRef = db.collection(CONVERSATIONS).doc(id);
  const eventRef = conversationRef.collection("events").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const conversation = await tx.get(conversationRef);
    if (!conversation.exists) throw new ConversationNotFoundError();
    tx.update(conversationRef, { ...patchData(parsed), updatedAt: now });
    tx.set(eventRef, {
      action: "conversation_patched",
      actorEmail: actor.email,
      at: now,
      fields: Object.keys(parsed),
    });
  });
}

function storedConversation(id: string, data: FirebaseFirestore.DocumentData): Conversation {
  return { id, ...data } as Conversation;
}

function storedIdentity(id: string, data: FirebaseFirestore.DocumentData): ConversationIdentity {
  return { id, ...data } as ConversationIdentity;
}

function storedThread(id: string, data: FirebaseFirestore.DocumentData): Thread {
  return { threadKey: id, ...data } as Thread;
}

export function identityClassificationEvent(input: {
  actorEmail: string;
  reason: string;
  at: string;
  identityId: string;
  classification: IdentityClassificationInput["classification"];
  previousClassification: ConversationIdentity["classification"];
}) {
  return {
    action: "identity_classified",
    ...input,
  };
}

function assertLegacyLinks(threads: Thread[], input: IdentityClassificationInput): void {
  for (const thread of threads) {
    if (input.classification === "buyer" && (thread.supplierId || (thread.buyerId && thread.buyerId !== input.buyerId))) {
      throw new ConversationRelationConflictError();
    }
    if (input.classification === "supplier" && (thread.buyerId || (thread.supplierId && thread.supplierId !== input.supplierId))) {
      throw new ConversationRelationConflictError();
    }
  }
}

export async function classifyIdentity(
  identityId: string,
  input: unknown,
  actor: AdminIdentity,
): Promise<void> {
  const parsed = identityClassificationInputSchema.parse(input);
  const db = getAdminDb();
  const identityRef = db.collection(IDENTITIES).doc(identityId);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const identityDoc = await tx.get(identityRef);
    if (!identityDoc.exists) throw new ConversationIdentityNotFoundError();
    const identity = storedIdentity(identityDoc.id, identityDoc.data()!);
    const oldConversationRef = identity.conversationId
      ? db.collection(CONVERSATIONS).doc(identity.conversationId)
      : null;
    const targetConversationRef = "conversationId" in parsed
      ? db.collection(CONVERSATIONS).doc(parsed.conversationId)
      : null;
    const entityRef = parsed.classification === "buyer"
      ? db.collection("buyers").doc(parsed.buyerId)
      : parsed.classification === "supplier"
        ? db.collection("suppliers").doc(parsed.supplierId)
        : null;
    const threadsQuery = db.collection(THREADS).where("identityId", "==", identityId);
    const [oldConversation, targetConversation, entity, threadSnap] = await Promise.all([
      oldConversationRef ? tx.get(oldConversationRef) : Promise.resolve(null),
      targetConversationRef ? tx.get(targetConversationRef) : Promise.resolve(null),
      entityRef ? tx.get(entityRef) : Promise.resolve(null),
      tx.get(threadsQuery),
    ]);

    if (targetConversationRef && !targetConversation?.exists) throw new ConversationNotFoundError();
    if (entityRef && !entity?.exists) throw new ConversationEntityNotFoundError();
    const threads = threadSnap.docs.map((doc) => storedThread(doc.id, doc.data()));
    assertLegacyLinks(threads, parsed);

    if (parsed.classification === "buyer" || parsed.classification === "supplier") {
      const target = storedConversation(targetConversation!.id, targetConversation!.data()!);
      const entityKey = parsed.classification === "buyer" ? "buyerId" : "supplierId";
      const entityId = parsed.classification === "buyer" ? parsed.buyerId : parsed.supplierId;
      const otherKey = parsed.classification === "buyer" ? "supplierId" : "buyerId";
      if ((target[entityKey] && target[entityKey] !== entityId) || target[otherKey]) {
        throw new ConversationRelationConflictError();
      }

      tx.update(identityRef, {
        classification: parsed.classification,
        [entityKey]: entityId,
        [otherKey]: FieldValue.delete(),
        conversationId: targetConversationRef!.id,
        updatedAt: now,
      });
      tx.update(targetConversationRef!, {
        [entityKey]: entityId,
        identityIds: FieldValue.arrayUnion(identityId),
        updatedAt: now,
      });
      for (const thread of threads) {
        tx.update(db.collection(THREADS).doc(thread.threadKey), {
          identityId,
          classification: parsed.classification,
          conversationId: targetConversationRef!.id,
          updatedAt: now,
        });
      }
      tx.set(targetConversationRef!.collection("events").doc(), identityClassificationEvent({
        actorEmail: actor.email,
        reason: parsed.reason,
        at: now,
        identityId,
        classification: parsed.classification,
        previousClassification: identity.classification,
      }));
    } else {
      tx.update(identityRef, {
        classification: parsed.classification,
        buyerId: FieldValue.delete(),
        supplierId: FieldValue.delete(),
        conversationId: FieldValue.delete(),
        updatedAt: now,
      });
      for (const thread of threads) {
        tx.update(db.collection(THREADS).doc(thread.threadKey), {
          classification: parsed.classification,
          conversationId: FieldValue.delete(),
          updatedAt: now,
        });
      }
      tx.set(identityRef.collection("events").doc(), identityClassificationEvent({
        actorEmail: actor.email,
        reason: parsed.reason,
        at: now,
        identityId,
        classification: parsed.classification,
        previousClassification: identity.classification,
      }));
    }

    if (oldConversationRef && oldConversationRef.path !== targetConversationRef?.path && oldConversation?.exists) {
      tx.update(oldConversationRef, { identityIds: FieldValue.arrayRemove(identityId), updatedAt: now });
      tx.set(oldConversationRef.collection("events").doc(), {
        action: "identity_reclassified",
        actorEmail: actor.email,
        reason: parsed.reason,
        at: now,
        identityId,
      });
    }
  });
}
