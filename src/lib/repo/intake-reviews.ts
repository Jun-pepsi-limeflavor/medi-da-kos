import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import {
  intakeReviewId,
  intakeReviewInputSchema,
  type IntakeReview,
} from "@/lib/schemas/intake-review";

const COLLECTION = "intakeReviews";

export async function getIntakeReview(
  source: string,
  externalId: string,
): Promise<IntakeReview | null> {
  const doc = await getAdminDb().collection(COLLECTION).doc(intakeReviewId(source, externalId)).get();
  return doc.exists ? (doc.data() as IntakeReview) : null;
}

/** /admin/intakes가 원천 네 컬렉션과 한 번에 조인할 때 쓴다 — 문서마다 개별 조회하지 않는다. */
export async function listIntakeReviews(): Promise<Map<string, IntakeReview>> {
  const snap = await getAdminDb().collection(COLLECTION).get();
  return new Map(snap.docs.map((d) => [d.id, d.data() as IntakeReview]));
}

/**
 * URL의 source·externalId가 body 값보다 우선한다. 검증 실패 시 z.ZodError를 던진다 —
 * 호출자(route handler)가 이를 잡아 400으로 옮긴다.
 */
export async function setIntakeReview(
  source: string,
  externalId: string,
  input: unknown,
  actor: AdminIdentity,
): Promise<IntakeReview> {
  const body = typeof input === "object" && input !== null ? input : {};
  const parsed = intakeReviewInputSchema.parse({ ...body, source, externalId });
  const record: IntakeReview = {
    ...parsed,
    reviewedBy: actor.email,
    reviewedAt: new Date().toISOString(),
  };
  await getAdminDb()
    .collection(COLLECTION)
    .doc(intakeReviewId(source, externalId))
    .set(record, { merge: true });
  return record;
}

export type QualifiedIntakeWithBuyer = {
  id: string;
  source: string;
  externalId: string;
  email?: string;
  companyName?: string;
  contactName?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

/**
 * 승인된(qualified) 인테이크 목록의 원천 문서(orders, sampleRequests, contact, koreaLeads, messages)와
 * users 컬렉션을 조회하여 문의자의 이메일 및 바이어 정보를 연결한다.
 */
export async function resolveQualifiedIntakeDetails(
  qualified: Array<{
    id: string;
    source: string;
    externalId: string;
    reviewedBy?: string;
    reviewedAt?: string;
  }>,
): Promise<QualifiedIntakeWithBuyer[]> {
  if (qualified.length === 0) return [];

  const db = getAdminDb();
  const docRefs: FirebaseFirestore.DocumentReference[] = [];
  const sourceKeyMap = new Map<string, { source: string; externalId: string }>();
  const messageThreadKeys: string[] = [];

  for (const item of qualified) {
    if (item.source === "order") {
      const ref = db.collection("orders").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "sampleRequest") {
      const ref = db.collection("sampleRequests").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "contact") {
      const ref = db.collection("contact").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "koreaLead") {
      const ref = db.collection("koreaLeads").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "landingRequest") {
      const ref = db.collection("landingRequests").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "message") {
      messageThreadKeys.push(item.externalId);
    }
  }

  const sourceDocs = docRefs.length > 0 ? await db.getAll(...docRefs) : [];
  const dataBySourceKey = new Map<string, FirebaseFirestore.DocumentData>();
  const uids = new Set<string>();

  for (const doc of sourceDocs) {
    if (doc.exists) {
      const info = sourceKeyMap.get(doc.ref.path);
      if (info) {
        const data = doc.data()!;
        dataBySourceKey.set(`${info.source}:${info.externalId}`, data);
        if (data.uid && typeof data.uid === "string") {
          uids.add(data.uid);
        }
      }
    }
  }

  const userDocs = uids.size > 0
    ? await db.getAll(...[...uids].map((uid) => db.collection("users").doc(uid)))
    : [];
  const userByUid = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of userDocs) {
    if (doc.exists) {
      userByUid.set(doc.id, doc.data()!);
    }
  }

  const messageEmailByKey = new Map<string, string>();
  if (messageThreadKeys.length > 0) {
    await Promise.all(
      messageThreadKeys.map(async (threadKey) => {
        try {
          const msgSnap = await db
            .collection("messages")
            .where("threadKey", "==", threadKey)
            .get();
          if (!msgSnap.empty) {
            const msgs = msgSnap.docs.map((d) => d.data());
            msgs.sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
            const m = msgs[0];
            const email =
              (m.accepted?.buyer?.email as string) ||
              (m.extraction?.buyer?.email as string) ||
              (m.direction === "in" ? (m.from as string) : (m.to?.[0] as string)) ||
              "";
            if (email) {
              messageEmailByKey.set(threadKey, email);
              return;
            }
          }
          const threadDoc = await db.collection("threads").doc(threadKey).get();
          if (threadDoc.exists) {
            const tData = threadDoc.data();
            if (tData?.buyerId && typeof tData.buyerId === "string" && tData.buyerId.includes("@")) {
              messageEmailByKey.set(threadKey, tData.buyerId);
            }
          }
        } catch {
          // ignore error and proceed
        }
      }),
    );
  }

  return qualified.map((item) => {
    let email: string | undefined;
    let companyName: string | undefined;
    let contactName: string | undefined;

    if (item.source === "order" || item.source === "sampleRequest") {
      const data = dataBySourceKey.get(`${item.source}:${item.externalId}`);
      if (data) {
        const user = data.uid ? userByUid.get(data.uid) : undefined;
        email = (user?.email as string) || (data.email as string) || (data.buyerEmail as string) || undefined;
        companyName = (user?.companyName as string) || (data.companyName as string) || undefined;
        contactName =
          (user?.displayName as string) ||
          (data.shippingAddress?.recipientName as string) ||
          (data.recipientName as string) ||
          undefined;
      }
    } else if (item.source === "contact" || item.source === "koreaLead") {
      const data = dataBySourceKey.get(`${item.source}:${item.externalId}`);
      if (data) {
        email = (data.email as string) || undefined;
        companyName = (data.companyName as string) || undefined;
        contactName = (data.name as string) || (data.contactName as string) || undefined;
      }
    } else if (item.source === "message") {
      email = messageEmailByKey.get(item.externalId);
    }

    return {
      ...item,
      email: email?.trim() || undefined,
      companyName: companyName?.trim() || undefined,
      contactName: contactName?.trim() || undefined,
    };
  });
}
