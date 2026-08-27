import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";

export interface IngestState {
  account: string;
  lastEpochSeconds: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  processedCount: number;
  updatedAt: string;
}

const COLLECTION = "ingestState";

export async function listIngestState(): Promise<IngestState[]> {
  const snap = await getAdminDb().collection(COLLECTION).orderBy("account").get();
  return snap.docs.map((d) => ({ account: d.id, ...d.data() } as IngestState));
}
