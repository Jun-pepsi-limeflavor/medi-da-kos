import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Message } from "@/lib/schemas/message";

const COLLECTION = "messages";

/** 스레드 상세 화면 — 한 threadKey에 속한 원문 메시지를 시간순으로 읽는다. */
export async function listThreadMessages(threadKey: string): Promise<Message[]> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("threadKey", "==", threadKey)
    .orderBy("sentAt")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message);
}
