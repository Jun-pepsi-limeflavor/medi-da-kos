import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Message } from "@/lib/schemas/message";

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
    .orderBy("sentAt")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message);
}
