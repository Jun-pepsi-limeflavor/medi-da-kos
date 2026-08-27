import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import type { Buyer, BuyerInput } from "@/lib/schemas/buyer";

const COLLECTION = "buyers";

export async function listBuyers(): Promise<Buyer[]> {
  const snap = await getAdminDb().collection(COLLECTION).orderBy("name").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Buyer);
}

/** 수집기가 발신자 주소로 바이어를 찾을 때 쓴다. */
export async function findBuyerByEmail(email: string): Promise<Buyer | null> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("emails", "array-contains", email.trim().toLowerCase())
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as Buyer) : null;
}

export class EmailTakenError extends Error {
  constructor(public email: string) {
    super(`email already on another buyer: ${email}`);
  }
}

async function assertEmailsFree(emails: string[], exceptId?: string) {
  for (const email of emails) {
    const found = await findBuyerByEmail(email);
    if (found && found.id !== exceptId) throw new EmailTakenError(email);
  }
}

export async function createBuyer(
  input: BuyerInput,
  actor: AdminIdentity,
): Promise<string> {
  await assertEmailsFree(input.emails);
  const now = new Date().toISOString();
  const ref = await getAdminDb().collection(COLLECTION).add({
    ...input,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.email,
  });
  return ref.id;
}

export async function updateBuyer(
  id: string,
  input: BuyerInput,
  actor: AdminIdentity,
): Promise<void> {
  await assertEmailsFree(input.emails, id);
  await getAdminDb().collection(COLLECTION).doc(id).update({
    ...input,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email,
  });
}
