import type { CMBriefStep4 } from "./types";

/** Minimum order quantity we advertise per SKU. */
export const MOQ_PER_SKU = 3000;
/** Hard floor — briefs below this cannot be submitted. */
export const MIN_SUBMITTABLE_QUANTITY = 1000;

export type OrderQuantityIssue =
  | "missing"
  | "invalid"
  | "below-min"
  | "below-moq";

/** Reads the order quantity, falling back to the legacy `moq` field. */
export function getOrderQuantity(step4?: CMBriefStep4): string {
  if (!step4) return "";
  return step4.orderQuantity ?? step4.moq ?? "";
}

/** Parses "5,000 units" → 5000. Returns null when there is no usable number. */
export function parseOrderQuantity(raw?: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[,\s]/g, "").replace(/units?$/i, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Blocking (`missing`, `invalid`, `below-min`) or advisory (`below-moq`)
 * problem with the entered quantity. The TBD checkbox is the only way to
 * skip entering a quantity.
 */
export function orderQuantityIssue(
  step4?: CMBriefStep4,
): OrderQuantityIssue | null {
  if (step4?.orderQuantityTbd) return null;
  const raw = getOrderQuantity(step4).trim();
  if (!raw) return "missing";
  const n = parseOrderQuantity(raw);
  if (n === null) return "invalid";
  if (n < MIN_SUBMITTABLE_QUANTITY) return "below-min";
  if (n < MOQ_PER_SKU) return "below-moq";
  return null;
}

export function isBlockingQuantityIssue(
  issue: OrderQuantityIssue | null,
): boolean {
  return issue === "missing" || issue === "invalid" || issue === "below-min";
}
