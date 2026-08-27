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
