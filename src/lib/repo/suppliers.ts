import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import type { Supplier, SupplierInput } from "@/lib/schemas/supplier";

const COLLECTION = "suppliers";

export async function listSuppliers(): Promise<Supplier[]> {
  const snap = await getAdminDb().collection(COLLECTION).orderBy("companyName").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
}

export async function findSupplierByName(companyName: string): Promise<Supplier | null> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("companyName", "==", companyName)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as Supplier) : null;
}

export async function findSupplierByEmail(rawEmail: string): Promise<Supplier | null> {
  const email = rawEmail.trim().toLowerCase();
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("contactEmails", "array-contains", email)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  return doc ? ({ id: doc.id, ...doc.data() } as Supplier) : null;
}

export async function createSupplier(
  input: SupplierInput,
  actor: AdminIdentity,
): Promise<string> {
  const existing = await findSupplierByName(input.companyName);
  if (existing) {
    throw new DuplicateSupplierError(input.companyName);
  }
  const now = new Date().toISOString();
  const ref = await getAdminDb().collection(COLLECTION).add({
    ...input,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.email,
  });
  return ref.id;
}

export async function updateSupplier(
  id: string,
  input: SupplierInput,
  actor: AdminIdentity,
): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(id).update({
    ...input,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email,
  });
}

export class DuplicateSupplierError extends Error {
  constructor(companyName: string) {
    super(`supplier already exists: ${companyName}`);
  }
}
