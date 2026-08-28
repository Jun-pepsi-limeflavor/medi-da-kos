import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import {
  dealFinanceInputSchema,
  type DealFinance,
  type DealFinanceInput,
} from "@/lib/schemas/deal-finance";
import { stripUndefined } from "@/lib/firestore-sanitize";

const DEALS_COLLECTION = "deals";
const PRIVATE_SUBCOLLECTION = "private";
const FINANCE_DOC_ID = "finance";

export async function getDealFinance(dealId: string): Promise<DealFinance | null> {
  const doc = await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection(PRIVATE_SUBCOLLECTION)
    .doc(FINANCE_DOC_ID)
    .get();

  return doc.exists ? (doc.data() as DealFinance) : null;
}

export async function updateDealFinance(
  dealId: string,
  finance: DealFinanceInput,
  actor: AdminIdentity
): Promise<void> {
  const parsed = dealFinanceInputSchema.parse(finance);
  const now = new Date().toISOString();
  const record: DealFinance = {
    ...parsed,
    updatedAt: now,
    updatedBy: actor.email,
  };

  await getAdminDb()
    .collection(DEALS_COLLECTION)
    .doc(dealId)
    .collection(PRIVATE_SUBCOLLECTION)
    .doc(FINANCE_DOC_ID)
    .set(stripUndefined(record), { merge: true });
}
