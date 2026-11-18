const GA_CLIENT_ID_STORAGE_KEY = "medidakos_ga_client_id";

function readGaCookieClientId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )_ga=GA1\.1\.([^;]+)/);
  if (!match?.[1]) return null;
  return match[1];
}

function cacheGaClientId(clientId: string) {
  try {
    sessionStorage.setItem(GA_CLIENT_ID_STORAGE_KEY, clientId);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

function readCachedGaClientId(): string | null {
  try {
    return sessionStorage.getItem(GA_CLIENT_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Returns the GA4 client_id used by gtag/Analytics.
 * Shared with Channel Talk profile for anonymous visitor correlation.
 */
export function getGaClientId(gaId?: string): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const cached = readCachedGaClientId();
  if (cached) return Promise.resolve(cached);

  const cookieFallback = readGaCookieClientId();
  if (cookieFallback) {
    cacheGaClientId(cookieFallback);
    return Promise.resolve(cookieFallback);
  }

  if (!gaId || typeof window.gtag !== "function") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (clientId: string | null) => {
      if (settled) return;
      settled = true;
      if (clientId) cacheGaClientId(clientId);
      resolve(clientId);
    };

    window.gtag("get", gaId, "client_id", (clientId: string) => {
      finish(clientId || readGaCookieClientId());
    });

    window.setTimeout(() => {
      finish(readGaCookieClientId() ?? readCachedGaClientId());
    }, 2500);
  });
}
