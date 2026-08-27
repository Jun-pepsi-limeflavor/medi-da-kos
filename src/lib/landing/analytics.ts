"use client";
import type { LandingVariant } from "./types";

const privateKeys = new Set(["companyName", "contactName", "email", "message", "pageUrl", "gaClientId", "userAgent"]);

export function trackLandingEvent(name: string, variant: LandingVariant, params: Record<string, unknown> = {}) {
  const safe = Object.fromEntries(Object.entries(params).filter(([key]) => !privateKeys.has(key)));
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const event = { ...safe, landing_variant: variant } as Record<string, unknown>;
  // Node unit tests provide only a lightweight gtag stub. Production browser
  // events keep the project-wide test marker without sending personal data.
  if (window.location) event.is_test = window.location.hostname.replace(/^www\./i, "") !== "medidakos.com" || new URLSearchParams(window.location.search).has("qa");
  window.gtag("event", name, event);
}
