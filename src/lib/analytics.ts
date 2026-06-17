export function trackConversionEvent(
  conversionEvent: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", conversionEvent, params ?? {});
}
