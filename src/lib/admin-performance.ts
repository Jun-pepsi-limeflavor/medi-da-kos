import "server-only";

export type AdminPerformanceOperation =
  | "admin.auth"
  | "inbox.queue"
  | "inbox.detail"
  | "deal.board"
  | "intake.load";

export type AdminPerformanceEvent = {
  event: "admin_performance";
  operation: AdminPerformanceOperation;
  durationMs: number;
  counts: Record<string, number>;
};

function safeCounts(counts: unknown): Record<string, number> {
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) return {};

  return Object.fromEntries(
    Object.entries(counts).filter(([, value]) =>
      typeof value === "number" && Number.isFinite(value),
    ),
  );
}

export function adminPerformanceEvent(
  operation: AdminPerformanceOperation,
  durationMs: number,
  counts?: unknown,
): AdminPerformanceEvent {
  return {
    event: "admin_performance",
    operation,
    durationMs: Math.max(0, Math.round(durationMs)),
    counts: safeCounts(counts),
  };
}

export async function measureAdminOperation<T>(
  operation: AdminPerformanceOperation,
  load: () => Promise<T>,
  counts: (value: T) => Record<string, number> = () => ({}),
): Promise<T> {
  const startedAt = performance.now();
  const value = await load();
  console.info(adminPerformanceEvent(operation, performance.now() - startedAt, counts(value)));
  return value;
}
