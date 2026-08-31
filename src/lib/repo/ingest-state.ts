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

export interface IngestHealthWarning {
  account: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  reason: string;
}

export interface IngestHealthSummary {
  healthy: boolean;
  warnings: IngestHealthWarning[];
  checkedAt: string;
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

/**
 * Reports enabled providers whose last success is older than 15 minutes or
 * whose last error is present. Does not manufacture provider status.
 */
export async function ingestHealthSummary(nowIso = new Date().toISOString()): Promise<IngestHealthSummary> {
  const states = await listIngestState();
  const nowMs = Date.parse(nowIso);
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  const warnings: IngestHealthWarning[] = [];

  for (const state of states) {
    let reason: string | null = null;
    if (state.lastError) {
      reason = `수집 오류: ${state.lastError}`;
    } else if (!state.lastSuccessAt) {
      reason = "성공 이력 없음";
    } else {
      const successMs = Date.parse(state.lastSuccessAt);
      if (Number.isNaN(successMs) || nowMs - successMs > FIFTEEN_MINUTES_MS) {
        reason = "15분 이상 수집 기록 없음";
      }
    }

    if (reason) {
      warnings.push({
        account: state.account,
        lastSuccessAt: state.lastSuccessAt,
        lastError: state.lastError,
        reason,
      });
    }
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    checkedAt: nowIso,
  };
}
