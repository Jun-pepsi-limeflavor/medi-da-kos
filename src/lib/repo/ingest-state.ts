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

/**
 * "account"는 저장된 필드가 아니라 문서 ID다 (functions-ingest/store.js의
 * setIngestState 참고) — orderBy("account")는 그 필드가 없는 문서를 전부
 * 걸러내 목록이 항상 비어 보이게 만든다. 계정이 한 자릿수 규모라 정렬은
 * 메모리에서 한다.
 */
export async function listIngestState(): Promise<IngestState[]> {
  const snap = await getAdminDb().collection(COLLECTION).get();
  return snap.docs
    .map((d) => ({ account: d.id, ...d.data() }) as IngestState)
    .sort((a, b) => a.account.localeCompare(b.account));
}
