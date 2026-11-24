// 쿠키 선택 저장 + 서버 증빙 전송(P2). 브라우저 상태(mdk:cookie-consent)와 전송 대기 이벤트(mdk:cookie-consent-outbox)를 나눠 둔다.
// - submitChoice: 선택을 즉시 저장한다. 줄인 항목은 confirmed에서도 바로 빼서(거부·철회 즉시 적용) 추적이 멈추고,
//   늘린 항목은 서버가 이벤트를 기록했다고 응답한 뒤에만 confirmed에 넣는다(그 전에는 추적하지 않음)
// - 이벤트는 outbox에 넣고 순서대로 /api/cookie-consent로 보낸다. 같은 eventId는 서버가 한 번만 기록하므로 재전송·다른 탭 중복은 안전
//   · 2xx: outbox에서 빼고 confirmed 반영 · 400/403/413: 고칠 수 없는 요청이라 버림
//   · 409(이 배포의 정책·고지와 다름 = 예전 화면): 버리고 그 선택이 현재 선택이면 만료 처리 → 배너가 다시 뜬다(Consent ID 유지)
//   · 그 밖(5xx·네트워크): 남겨 두고 5초 뒤 1회, 이후 페이지를 열 때마다 다시 보낸다. 선택 유효기간(6개월)이 지난 이벤트는 버린다
import {
  CONSENT_RETENTION_MONTHS,
  addMonths,
  applyGpc,
  createConsent,
  isGpcEnabled,
  POLICY_VERSION,
  readConsent,
  readPreviousConsentId,
  writeConsent,
  type CookieChoices,
} from "@/lib/cookie-consent/consent";
import type { ConsentAction, ConsentEventInput, ConsentSource } from "@/lib/cookie-consent/consent-log";
import { NOTICE_HASH } from "@/lib/cookie-consent/notice";

export const OUTBOX_STORAGE_KEY = "mdk:cookie-consent-outbox";
export const CONSENT_LOG_ENDPOINT = "/api/cookie-consent";
const MAX_OUTBOX = 20;
const RETRY_DELAY_MS = 5000;

/** First choice (or re-consent after expiry / policy change) → consent|reject; later: anything turned off → withdraw, else update. */
export function decideAction(previous: CookieChoices | null, next: CookieChoices): ConsentAction {
  if (!previous) return next.analytics || next.marketing ? "consent" : "reject";
  if ((previous.analytics && !next.analytics) || (previous.marketing && !next.marketing)) return "withdraw";
  return "update";
}

/** Narrowing applies immediately; a category stays confirmed only while it is still chosen. */
export function confirmedAfterChoice(previousConfirmed: CookieChoices | null, next: CookieChoices): CookieChoices {
  return {
    analytics: next.analytics && previousConfirmed?.analytics === true,
    marketing: next.marketing && previousConfirmed?.marketing === true,
  };
}

/** After the server recorded `event`: confirm what that event granted, never beyond the current choice. */
export function confirmedAfterAck(current: { analytics: boolean; marketing: boolean; confirmed: CookieChoices }, event: CookieChoices): CookieChoices {
  return {
    analytics: current.analytics && (current.confirmed.analytics || event.analytics),
    marketing: current.marketing && (current.confirmed.marketing || event.marketing),
  };
}

// ---------- Outbox ----------

export function readOutbox(): ConsentEventInput[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(OUTBOX_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? (value as ConsentEventInput[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(events: ConsentEventInput[]) {
  try {
    if (events.length) window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(events.slice(-MAX_OUTBOX)));
    else window.localStorage.removeItem(OUTBOX_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing is queued, so granted categories simply never start on this browser.
  }
}

function removeFromOutbox(eventId: string) {
  writeOutbox(readOutbox().filter((event) => event.eventId !== eventId));
}

// ---------- Choice ----------

/** Saves the visitor's choice (banner or Cookie Settings) and queues its server record. */
export function submitChoice(choices: CookieChoices, source: ConsentSource, now: Date = new Date()): ConsentEventInput {
  const next = applyGpc(choices, isGpcEnabled());
  const previous = readConsent();
  const consentId = previous?.consentId ?? readPreviousConsentId() ?? crypto.randomUUID();
  writeConsent(createConsent(next, now, { consentId, confirmed: confirmedAfterChoice(previous?.confirmed ?? null, next) }));

  const event: ConsentEventInput = {
    eventId: crypto.randomUUID(),
    consentId,
    action: decideAction(previous, next),
    analytics: next.analytics,
    marketing: next.marketing,
    policyVersion: POLICY_VERSION,
    noticeHash: NOTICE_HASH,
    source,
    clientSavedAt: now.toISOString(),
  };
  writeOutbox([...readOutbox(), event]);
  void flushConsentOutbox();
  return event;
}

function applyAck(event: ConsentEventInput) {
  const current = readConsent();
  if (!current || current.consentId !== event.consentId) return;
  const confirmed = confirmedAfterAck(current, event);
  if (confirmed.analytics !== current.confirmed.analytics || confirmed.marketing !== current.confirmed.marketing) {
    writeConsent({ ...current, confirmed });
  }
}

function expireIfCurrent(event: ConsentEventInput) {
  const current = readConsent();
  if (!current || current.consentId !== event.consentId || current.savedAt !== event.clientSavedAt) return;
  // Keep the record (and its Consent ID) but make it invalid, so the banner asks again with the current wording.
  writeConsent({ ...current, confirmed: { analytics: false, marketing: false }, expiresAt: new Date(0).toISOString() });
}

let flushing: Promise<void> | null = null;
let retryScheduled = false;

/** Sends queued events in order. Safe to call often (page load, after each choice). */
export function flushConsentOutbox(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const event of readOutbox()) {
      if (addMonths(new Date(event.clientSavedAt), CONSENT_RETENTION_MONTHS).getTime() <= Date.now()) {
        removeFromOutbox(event.eventId); // the choice itself has expired
        continue;
      }
      let status: number;
      try {
        const response = await fetchImpl(CONSENT_LOG_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
          keepalive: true,
          credentials: "same-origin",
        });
        status = response.status;
      } catch {
        status = 0;
      }
      if (status >= 200 && status < 300) {
        removeFromOutbox(event.eventId);
        applyAck(event);
      } else if (status === 409) {
        removeFromOutbox(event.eventId);
        expireIfCurrent(event);
      } else if (status === 400 || status === 403 || status === 413) {
        removeFromOutbox(event.eventId);
      } else {
        scheduleRetry(fetchImpl);
        break; // keep order: later events wait for this one
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** One in-page retry; after that every page load retries (ConsentEnforcer). */
function scheduleRetry(fetchImpl: typeof fetch) {
  if (retryScheduled || typeof window === "undefined") return;
  retryScheduled = true;
  setTimeout(() => void flushConsentOutbox(fetchImpl), RETRY_DELAY_MS);
}
