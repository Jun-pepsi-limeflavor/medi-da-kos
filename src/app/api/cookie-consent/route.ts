import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getServiceAccountProjectId } from "@/lib/firebase/admin";
import { CONSENT_LOG_COLLECTION, handleConsentLog } from "@/lib/cookie-consent/consent-log";

// 쿠키 동의 이벤트 1건을 cookieConsentLogs/{eventId}에 남긴다(인증 없음, 서버 검증·fail-closed). 판정은 handleConsentLog.
// 프로젝트 확인 결과(프로젝트 ID와 일치 여부만)는 인스턴스당 첫 요청과 불일치 때 로그에 남긴다 — 키·Secret은 남기지 않는다.
let projectLogged = false;

export async function POST(request: Request) {
  const result = await handleConsentLog({
    rawBody: await request.text(),
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    secGpc: request.headers.get("sec-gpc"),
    env: {
      vercelEnv: process.env.VERCEL_ENV,
      clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      deploymentSha: process.env.VERCEL_GIT_COMMIT_SHA,
    },
    adminProjectId: getServiceAccountProjectId,
    create: async (eventId, doc) => {
      try {
        await getAdminDb()
          .collection(CONSENT_LOG_COLLECTION)
          .doc(eventId)
          .create({ ...doc, recordedAt: FieldValue.serverTimestamp() });
        return "created";
      } catch (error) {
        // gRPC 6 = ALREADY_EXISTS: the same event was recorded by an earlier (retried) request.
        if ((error as { code?: unknown })?.code === 6) return "exists";
        throw error;
      }
    },
    log: (message, detail) => {
      const mismatch = "ok" in detail && detail.ok === false;
      if (message.includes("project check") && projectLogged && !mismatch) return;
      if (message.includes("project check")) projectLogged = true;
      (mismatch || message.includes("failed") ? console.error : console.info)(message, detail);
    },
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
