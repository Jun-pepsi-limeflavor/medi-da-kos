// 동의가 없거나 철회된 카테고리의 브라우저 저장소 정리(쿠키·sessionStorage·localStorage).
// - Analytics: GA4 쿠키(_ga, _ga_*, _gid, _gat*), GA client id 캐시, Contact용 UTM 캐시
// - Marketing: Meta 쿠키(_fbp, _fbc)와 Meta Pixel의 localStorage(lastExternalReferrer*, P1 실험으로 Meta 생성 확인)
// - Google Ads(_gcl_* 쿠키, _gcl_ls localStorage)는 두 카테고리 모두에서 지운다: GA4 태그가 Analytics·Marketing 동의가 모두 있을 때만
//   만들고 읽으므로, 하나라도 빠지면 쓰이지 않는 광고 클릭 정보를 남기지 않는다(2026-11-26 결정). Cookie Details에서는 Marketing 행
// - Essential(로그인·Channel Talk 상담·동의 기록·프로모션 상태)은 건드리지 않는다
// - 쿠키는 설정한 도메인을 알 수 없어 호스트 전용·현재 호스트·상위 도메인(.medidakos.com 등)으로 모두 지운다

export type StorageCategory = "analytics" | "marketing";

const GOOGLE_ADS_COOKIES = [/^_gcl_/];
const GOOGLE_ADS_LOCAL_KEYS = ["_gcl_ls"];

const COOKIE_PATTERNS: Record<StorageCategory, readonly RegExp[]> = {
  analytics: [/^_ga$/, /^_ga_/, /^_gid$/, /^_gat/, ...GOOGLE_ADS_COOKIES],
  marketing: [/^_fbp$/, /^_fbc$/, ...GOOGLE_ADS_COOKIES],
};

const SESSION_KEYS: Record<StorageCategory, readonly string[]> = {
  analytics: ["medidakos_ga_client_id", "medidakos_utm_params"],
  marketing: [],
};

const LOCAL_KEYS: Record<StorageCategory, readonly string[]> = {
  analytics: [...GOOGLE_ADS_LOCAL_KEYS],
  marketing: ["lastExternalReferrer", "lastExternalReferrerTime", ...GOOGLE_ADS_LOCAL_KEYS],
};

/** localStorage and sessionStorage keys the category's cleanup removes (Cookie Details consistency test). */
export function storageKeysFor(category: StorageCategory): { local: readonly string[]; session: readonly string[] } {
  return { local: LOCAL_KEYS[category], session: SESSION_KEYS[category] };
}

/** Cookie names in a `document.cookie` string that belong to the category. */
export function cookieNamesFor(category: StorageCategory, cookieString: string): string[] {
  const names = cookieString
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(names.filter((name) => COOKIE_PATTERNS[category].some((re) => re.test(name))))];
}

/**
 * Domain attributes to try when deleting: host-only (undefined), the host, and each parent domain with a dot
 * (www.medidakos.com → www.medidakos.com, .www.medidakos.com, .medidakos.com). Never a bare TLD; IPs and
 * single-label hosts (localhost) get host-only.
 */
export function cookieDomainsFor(hostname: string): (string | undefined)[] {
  const host = hostname.toLowerCase();
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return [undefined];
  const labels = host.split(".");
  const domains: (string | undefined)[] = [undefined, host];
  for (let i = 0; i < labels.length - 1; i++) domains.push(`.${labels.slice(i).join(".")}`);
  return [...new Set(domains)];
}

function expireCookie(name: string, domain: string | undefined) {
  document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
}

function removeKeys(storage: () => Storage, keys: readonly string[]) {
  try {
    const target = storage();
    keys.forEach((key) => target.removeItem(key));
  } catch {
    // Storage blocked: nothing to remove.
  }
}

/** Removes the category's cookies and cached values from this browser. Safe to call repeatedly. */
export function clearCategoryStorage(category: StorageCategory): void {
  if (typeof document === "undefined") return;
  const domains = cookieDomainsFor(window.location.hostname);
  for (const name of cookieNamesFor(category, document.cookie)) {
    domains.forEach((domain) => expireCookie(name, domain));
  }
  removeKeys(() => window.sessionStorage, SESSION_KEYS[category]);
  removeKeys(() => window.localStorage, LOCAL_KEYS[category]);
}
