export function trackConversionEvent(
  conversionEvent: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", conversionEvent, params ?? {});
}

export function trackBriefStep(step: number, stepLabel?: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "brief_step_changed", {
    brief_step: step,
    ...(stepLabel ? { brief_step_label: stepLabel } : {}),
  });
}
