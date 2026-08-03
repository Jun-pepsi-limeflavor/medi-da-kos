export function trackConversionEvent(
  conversionEvent: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", conversionEvent, params ?? {});
}

/** GA4 event when the CM Wizard step changes (saved/navigated step, not field edits). */
export function trackBriefStep(step: number, stepLabel: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "brief_step_changed", {
    brief_step: step,
    brief_step_label: stepLabel,
  });
}
