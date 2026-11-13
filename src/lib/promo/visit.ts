// Promotion 팝업 노출 판정(Figma 'Overlay · Promotion Popup — Final Design' 335:911 노출 규칙).
// - 새 방문: 이 탭(sessionStorage)에 활동 기록이 없거나, 마지막 활동 후 30분 이상 지나 외부에서 다시 들어온 경우
//   (Referer가 같은 사이트면 내부 이동으로 보고 새 방문이 아님 — Referer는 보조 신호, 빈 Referer는 외부로 취급)
// - 문서를 열 때 한 번만 판정하고(새로고침·뒤로가기는 활동 기록이 남아 있어 새 방문 아님) 이후 페이지 이동마다 활동 시각을 갱신
// - 자동 노출: 새 방문의 첫 페이지가 Home(/)일 때만, 방문당 1회(promoSeen = 방문 ID). 프로모션 기간 외·봇·같은 세션에서
//   공지 바 링크를 누른 경우는 노출하지 않음. 7일/30일 장기 숨김은 없음
import { PROMO_BAR_CLICKED_KEY } from "@/lib/config/promo";

export const LAST_ACTIVITY_KEY = "mdk:last-activity";
export const VISIT_ID_KEY = "mdk:visit-id";
export const PROMO_SEEN_KEY = "mdk:promo-seen";
/** Inactivity after which an entry from outside counts as a new visit (Figma: 30 minutes, "기준 시간 TBD"). */
export const NEW_VISIT_AFTER_MS = 30 * 60 * 1000;

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|headless/i;

/** Pure rule for a document load: is this the start of a new visit? */
export function isNewVisit({ lastActivity, now, sameOriginReferrer }: { lastActivity: number | null; now: number; sameOriginReferrer: boolean }): boolean {
  if (lastActivity === null) return true;
  return now - lastActivity >= NEW_VISIT_AFTER_MS && !sameOriginReferrer;
}

export type Visit = { id: string; isNew: boolean; landingPath: string };

/** Pure rule: open the popup automatically on this Home render? */
export function shouldAutoOpenPromo(input: {
  visit: Visit;
  pathname: string;
  promoActive: boolean;
  barClicked: boolean;
  seenVisitId: string | null;
  isBot: boolean;
}): boolean {
  const { visit, pathname, promoActive, barClicked, seenVisitId, isBot } = input;
  return promoActive && !isBot && !barClicked && pathname === "/" && visit.landingPath === "/" && visit.isNew && seenVisitId !== visit.id;
}

// ---------- Browser state ----------

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: treated as a new visit each load (the popup may show again).
  }
}

let current: Visit | null = null;

/** This document's visit, decided once from the state left by earlier pages in this tab. */
export function getVisit(): Visit {
  if (current) return current;
  const now = Date.now();
  const last = Number(read(LAST_ACTIVITY_KEY));
  let sameOriginReferrer = false;
  try {
    sameOriginReferrer = !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {
    // Malformed referrer: treat as external.
  }
  const isNew = isNewVisit({ lastActivity: Number.isFinite(last) && last > 0 ? last : null, now, sameOriginReferrer });
  const id = isNew ? String(now) : (read(VISIT_ID_KEY) ?? String(now));
  if (isNew) write(VISIT_ID_KEY, id);
  current = { id, isNew, landingPath: location.pathname };
  return current;
}

export function markActivity() {
  getVisit();
  write(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function isBotVisitor(): boolean {
  return BOT_PATTERN.test(navigator.userAgent);
}

export function promoBarClicked(): boolean {
  return read(PROMO_BAR_CLICKED_KEY) === "1";
}

export function readSeenVisit(): string | null {
  return read(PROMO_SEEN_KEY);
}

export function markPromoSeen(visit: Visit) {
  write(PROMO_SEEN_KEY, visit.id);
}
