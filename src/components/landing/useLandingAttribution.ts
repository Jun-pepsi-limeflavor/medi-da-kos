"use client";

import { useEffect, useMemo, useState } from "react";
import type { LandingRequestContext } from "../../lib/landing/types";

export function parseLandingAttribution(url: string): LandingRequestContext {
  const parsed = new URL(url);
  const value = (key: string) => parsed.searchParams.get(key) || undefined;
  const attribution: LandingRequestContext = { pageUrl: parsed.toString() };
  const utms: Array<[keyof Pick<LandingRequestContext, "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "utmTerm">, string | undefined]> = [["utmSource", value("utm_source")], ["utmMedium", value("utm_medium")], ["utmCampaign", value("utm_campaign")], ["utmContent", value("utm_content")], ["utmTerm", value("utm_term")]];
  for (const [key, field] of utms) if (field !== undefined) attribution[key] = field;
  return attribution;
}

export function useLandingAttribution(): LandingRequestContext {
  const base = useMemo(() => {
    if (typeof window === "undefined") return { pageUrl: "" };
    return { ...parseLandingAttribution(window.location.href), userAgent: navigator.userAgent };
  }, []);
  const [gaClientId, setGaClientId] = useState<string | undefined>();
  useEffect(() => { void import("../../lib/ga-client-id").then(({ getGaClientId }) => getGaClientId().then((id) => setGaClientId(id ?? undefined))); }, []);
  return { ...base, gaClientId };
}
