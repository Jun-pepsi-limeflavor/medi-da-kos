"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

const UTM_STORAGE_KEY = "medidakos_utm_params";

export interface UtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

function readStoredUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UtmParams;
  } catch {
    return {};
  }
}

function storeUtmParams(params: UtmParams) {
  if (typeof window === "undefined") return;
  const hasValue = Object.values(params).some(Boolean);
  if (!hasValue) return;
  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // ignore storage failures
  }
}

function parseUtmFromSearchParams(
  searchParams: URLSearchParams,
): UtmParams {
  return {
    utmSource: searchParams.get("utm_source") ?? undefined,
    utmMedium: searchParams.get("utm_medium") ?? undefined,
    utmCampaign: searchParams.get("utm_campaign") ?? undefined,
    utmContent: searchParams.get("utm_content") ?? undefined,
    utmTerm: searchParams.get("utm_term") ?? undefined,
  };
}

/**
 * Reads UTM params from the URL on first visit and persists them in sessionStorage
 * so attribution survives in-page navigation before form submit.
 */
export function useUtmParams(): UtmParams {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const fromUrl = parseUtmFromSearchParams(searchParams);
    const hasUrlParams = Object.values(fromUrl).some(Boolean);

    if (hasUrlParams) {
      storeUtmParams(fromUrl);
      return fromUrl;
    }

    return readStoredUtmParams();
  }, [searchParams]);
}
