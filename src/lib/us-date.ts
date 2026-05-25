/** US Eastern — used for sample / launch date minimums */
const US_TIMEZONE = "America/New_York";

/** YYYY-MM-DD for date inputs (min/max), based on US Eastern calendar day */
export function getUSDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: US_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getUSDatePlusDays(days: number): string {
  const [y, m, d] = getUSDateString().split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function getUSDatePlusWeeks(weeks: number): string {
  return getUSDatePlusDays(weeks * 7);
}

export function minSampleRequestDate(): string {
  return getUSDatePlusWeeks(2);
}

export function minTargetLaunchDate(): string {
  return getUSDatePlusWeeks(6);
}
