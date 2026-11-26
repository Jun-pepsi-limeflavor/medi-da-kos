// 쿠키 동의 서버 증빙(cookieConsentLogs/{eventId}) — 검증·문서 생성·응답 판정(순수 함수, 라우트는 연결만).
// - 받는 것: 브라우저가 만든 eventId·consentId(UUIDv4)·유형·Analytics/Marketing 선택·정책 버전·고지 해시·출처·브라우저 저장 시각
// - 서버가 정하는 것: 기록 시각(serverTimestamp, 라우트), 선택 유효기간 만료(+6개월), 보관 만료 deleteAt(+18개월, TTL 필드),
//   GPC(Sec-GPC 헤더), 배포 SHA·환경. 이름·이메일·UID·GA client id·IP·User-Agent는 받지도 저장하지도 않는다
// - fail-closed: Admin SDK 서비스 계정 project_id = 클라이언트 NEXT_PUBLIC_FIREBASE_PROJECT_ID = 환경별 기대값
//   (VERCEL_ENV=production → medidakos, 그 밖 → dev-medidakos-b9b4f)이 아니면 기록하지 않는다
// - 같은 eventId는 한 번만 기록(create, 이미 있으면 중복 성공). 기록을 고치거나 지우는 경로는 없다
import { addMonths, CONSENT_RETENTION_MONTHS, isUuidV4, POLICY_VERSION } from "@/lib/cookie-consent/policy";
import { NOTICE_HASH } from "@/lib/cookie-consent/notice";

export const CONSENT_LOG_COLLECTION = "cookieConsentLogs";
/** Server evidence retention (decided 2026-11-23): 18 months from the record, deleted by a Firestore TTL policy on deleteAt. */
export const CONSENT_LOG_RETENTION_MONTHS = 18;
export const MAX_BODY_BYTES = 2048;

export const PRODUCTION_FIREBASE_PROJECT = "medidakos";
export const DEVELOPMENT_FIREBASE_PROJECT = "dev-medidakos-b9b4f";

export const CONSENT_ACTIONS = ["consent", "reject", "update", "withdraw"] as const;
export const CONSENT_SOURCES = ["banner", "settings"] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/** What the browser sends (also what it keeps in its outbox until the server confirms). */
export type ConsentEventInput = {
  eventId: string;
  consentId: string;
  action: ConsentAction;
  analytics: boolean;
  marketing: boolean;
  policyVersion: number;
  noticeHash: string;
  source: ConsentSource;
  clientSavedAt: string;
};

const INPUT_KEYS = ["eventId", "consentId", "action", "analytics", "marketing", "policyVersion", "noticeHash", "source", "clientSavedAt"];

export function expectedFirebaseProject(vercelEnv: string | undefined): string {
  return vercelEnv === "production" ? PRODUCTION_FIREBASE_PROJECT : DEVELOPMENT_FIREBASE_PROJECT;
}

export type ProjectCheck = { ok: boolean; environment: string; expected: string; admin: string | null; client: string | null };

/** All three must agree. Equal admin/client IDs alone are not enough: they must also be this environment's project. */
export function checkFirebaseProject(input: { vercelEnv?: string; adminProjectId: string | null; clientProjectId?: string }): ProjectCheck {
  const expected = expectedFirebaseProject(input.vercelEnv);
  const admin = input.adminProjectId || null;
  const client = input.clientProjectId?.trim() || null;
  return { ok: admin === expected && client === expected, environment: input.vercelEnv || "local", expected, admin, client };
}

type Parsed = { ok: true; event: ConsentEventInput } | { ok: false; status: 400 | 409; error: string };

export function parseConsentEvent(raw: unknown): Parsed {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, status: 400, error: "invalid_body" };
  const body = raw as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length !== INPUT_KEYS.length || !INPUT_KEYS.every((key) => keys.includes(key))) return { ok: false, status: 400, error: "invalid_fields" };
  if (!isUuidV4(body.eventId) || !isUuidV4(body.consentId)) return { ok: false, status: 400, error: "invalid_id" };
  if (!CONSENT_ACTIONS.includes(body.action as ConsentAction)) return { ok: false, status: 400, error: "invalid_action" };
  if (!CONSENT_SOURCES.includes(body.source as ConsentSource)) return { ok: false, status: 400, error: "invalid_source" };
  if (typeof body.analytics !== "boolean" || typeof body.marketing !== "boolean") return { ok: false, status: 400, error: "invalid_choice" };
  if (typeof body.clientSavedAt !== "string" || body.clientSavedAt.length > 40 || !Number.isFinite(Date.parse(body.clientSavedAt))) {
    return { ok: false, status: 400, error: "invalid_time" };
  }
  if (typeof body.policyVersion !== "number" || typeof body.noticeHash !== "string") return { ok: false, status: 400, error: "invalid_policy" };
  // Shown wording differs from what this deployment serves (old tab / old bundle): not evidence of this policy.
  if (body.policyVersion !== POLICY_VERSION || body.noticeHash !== NOTICE_HASH) return { ok: false, status: 409, error: "policy_mismatch" };
  return { ok: true, event: body as unknown as ConsentEventInput };
}

/** The stored document, minus recordedAt (the route adds the Firestore server timestamp). */
export function buildConsentLog(event: ConsentEventInput, ctx: { now: Date; gpc: boolean; deploymentSha?: string; environment: string }) {
  return {
    consentId: event.consentId,
    action: event.action,
    analytics: event.analytics,
    marketing: event.marketing,
    policyVersion: event.policyVersion,
    noticeHash: event.noticeHash,
    source: event.source,
    gpc: ctx.gpc,
    clientSavedAt: event.clientSavedAt,
    deploymentSha: ctx.deploymentSha || null,
    environment: ctx.environment,
    consentExpiresAt: addMonths(ctx.now, CONSENT_RETENTION_MONTHS),
    deleteAt: addMonths(ctx.now, CONSENT_LOG_RETENTION_MONTHS),
  };
}

export type ConsentLogDocument = ReturnType<typeof buildConsentLog>;

export type HandleInput = {
  rawBody: string;
  origin: string | null;
  host: string | null;
  secGpc: string | null;
  env: { vercelEnv?: string; clientProjectId?: string; deploymentSha?: string };
  adminProjectId: () => string | null;
  /** Creates the document; "exists" when that eventId was already recorded. */
  create: (eventId: string, doc: ConsentLogDocument) => Promise<"created" | "exists">;
  now?: Date;
  log?: (message: string, detail: object) => void;
};

export type HandleResult = { status: number; body: { ok: boolean; duplicate?: boolean; error?: string } };

export async function handleConsentLog(input: HandleInput): Promise<HandleResult> {
  const log = input.log ?? (() => {});
  if (!input.origin || !input.host || hostOf(input.origin) !== input.host.toLowerCase()) return { status: 403, body: { ok: false, error: "origin" } };
  if (Buffer.byteLength(input.rawBody, "utf8") > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: "too_large" } };

  let raw: unknown;
  try {
    raw = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }
  const parsed = parseConsentEvent(raw);
  if (!parsed.ok) return { status: parsed.status, body: { ok: false, error: parsed.error } };

  const check = checkFirebaseProject({ vercelEnv: input.env.vercelEnv, adminProjectId: input.adminProjectId(), clientProjectId: input.env.clientProjectId });
  log("[cookie-consent] firebase project check", check);
  if (!check.ok) return { status: 503, body: { ok: false, error: "project_mismatch" } };

  const doc = buildConsentLog(parsed.event, {
    now: input.now ?? new Date(),
    gpc: input.secGpc === "1",
    deploymentSha: input.env.deploymentSha,
    environment: check.environment,
  });
  try {
    const result = await input.create(parsed.event.eventId, doc);
    return result === "created" ? { status: 201, body: { ok: true } } : { status: 200, body: { ok: true, duplicate: true } };
  } catch (error) {
    log("[cookie-consent] write failed", { code: (error as { code?: unknown })?.code ?? null });
    return { status: 500, body: { ok: false, error: "write_failed" } };
  }
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}
