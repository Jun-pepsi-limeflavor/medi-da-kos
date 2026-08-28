import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Message, parseStatusSchema } from "@/lib/schemas/message";
import type { Extraction, ConfidenceMap } from "@/lib/schemas/extraction";
import { z } from "zod";

type ParseStatus = z.infer<typeof parseStatusSchema>;

const COLLECTION = "messages";

/** 메시지 단일 조회 — 문서 ID로 메시지를 가져온다. */
export async function getMessage(id: string): Promise<Message | null> {
  const doc = await getAdminDb().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Message;
}

/** 스레드 상세 화면 — 한 threadKey에 속한 원문 메시지를 시간순으로 읽는다. */
export async function listThreadMessages(threadKey: string): Promise<Message[]> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("threadKey", "==", threadKey)
    .get();
  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message);
  return messages.sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""));
}

/** 메시지 추출 결과 확정 저장 */
export async function acceptMessageExtraction(
  id: string,
  accepted: Extraction,
  actorEmail: string,
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(COLLECTION)
    .doc(id)
    .update({
      accepted,
      parseStatus: "completed",
      acceptedBy: actorEmail,
      acceptedAt: now,
      sourceUpdatedAt: now,
    });
}

/** 메시지 재추출 결과 갱신 */
export async function updateMessageExtraction(
  id: string,
  extraction: Extraction,
  confidence: ConfidenceMap,
  parseStatus: ParseStatus = "completed",
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(COLLECTION)
    .doc(id)
    .update({
      extraction,
      confidence,
      parseStatus,
      sourceUpdatedAt: now,
    });
}

/** 메시지 파싱 상태 갱신 (예: 무시 처리 시 'skipped') */
export async function setMessageParseStatus(
  id: string,
  parseStatus: ParseStatus,
): Promise<void> {
  const now = new Date().toISOString();
  await getAdminDb()
    .collection(COLLECTION)
    .doc(id)
    .update({
      parseStatus,
      sourceUpdatedAt: now,
    });
}

