import { applyAddressMatch, getThread } from "@/lib/repo/threads";
import { listThreadMessages } from "@/lib/repo/messages";
import { getIntakeReview, setIntakeReview } from "@/lib/repo/intake-reviews";
import type { Message } from "@/lib/schemas/message";
import { requireAdminPage } from "@/lib/admin-page";
import ThreadActions from "../ThreadActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDatetime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ threadKey: string }>;
}) {
  const { threadKey } = await params;
  const decodedKey = decodeURIComponent(threadKey);

  const actor = await requireAdminPage();

  const rawThread = await getThread(decodedKey);
  if (!rawThread) {
    return (
      <div className="space-y-6">
        <Link href="/admin/inbox" className="text-xs text-neutral-400 hover:text-neutral-200">
          ← 돌아가기
        </Link>
        <p className="text-sm text-neutral-500">스레드를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const messages = await listThreadMessages(decodedKey);

  // Task 3 Step 1 — 열 때마다 상대 주소를 다시 대조한다. 나중에 바이어가
  // 등록되면 다음 열람에서 자동으로 side가 올라간다.
  const { thread, counterpartyEmail, buyerCandidate, supplierCandidate } =
    await applyAddressMatch(rawThread, messages);

  // Task 3 Step 4 — web 채널은 폼 제출 쪽 인테이크가 따로 있다. 메일함
  // 채널(gmail_*·outlook_*·channeltalk)로 들어온 스레드를 처음 열었을 때만
  // raw 판정을 만든다. 이미 있으면 손대지 않는다 — 상태를 덮지 않는다.
  if (thread.channel !== "web") {
    const existingReview = await getIntakeReview("message", decodedKey);
    if (!existingReview) {
      await setIntakeReview(
        "message",
        decodedKey,
        {
          sourceRef: `threads/${decodedKey}`,
          status: "raw",
          reason: "",
          isTest: false,
          isTestReason: "",
        },
        actor,
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <Link href="/admin/inbox" className="text-xs text-neutral-400 hover:text-neutral-200">
          ← 받은편지함
        </Link>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-neutral-500">채널:</span>
            <span className="ml-2 text-neutral-100">{thread.channel}</span>
          </div>
          <div>
            <span className="text-neutral-500">계정:</span>
            <span className="ml-2 text-neutral-100">{thread.sourceAccount}</span>
          </div>
          <div>
            <span className="text-neutral-500">Side:</span>
            <span className="ml-2 text-neutral-100">{thread.side}</span>
          </div>
          <div>
            <span className="text-neutral-500">읽음:</span>
            <span className="ml-2 text-neutral-100">{thread.readState}</span>
          </div>
          <div>
            <span className="text-neutral-500">보관:</span>
            <span className="ml-2 text-neutral-100">{thread.triageState}</span>
          </div>
          <div>
            <span className="text-neutral-500">연결:</span>
            <span className="ml-2 text-neutral-100">{thread.linkState}</span>
          </div>
        </div>
        <ThreadActions
          thread={thread}
          counterpartyEmail={counterpartyEmail}
          buyerCandidate={buyerCandidate ? { id: buyerCandidate.id, name: buyerCandidate.name } : null}
          supplierCandidate={supplierCandidate ? { id: supplierCandidate.id, companyName: supplierCandidate.companyName } : null}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-300">메시지 ({messages.length}개)</h2>
        {messages.length === 0 ? (
          <p className="text-xs text-neutral-500">메시지가 없습니다.</p>
        ) : (
          <div className="space-y-4 divide-y divide-neutral-800">
            {messages.map((msg: Message) => (
              <div key={msg.id} className="pt-4 first:pt-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-neutral-100">{msg.fromName || msg.from}</span>
                    <span className="text-xs text-neutral-500">({msg.from})</span>
                  </div>
                  <span className="text-xs text-neutral-500">{formatDatetime(msg.sentAt)}</span>
                </div>
                <div className="text-xs text-neutral-400 mb-2">{msg.subject}</div>
                <div className="bg-neutral-800 rounded p-3 text-sm text-neutral-200 whitespace-pre-wrap mb-2 break-words max-h-96 overflow-y-auto">
                  {msg.bodyText}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="text-xs text-neutral-400 space-y-1">
                    <div className="font-medium text-neutral-300">첨부 {msg.attachments.length}개:</div>
                    <ul className="list-disc list-inside">
                      {msg.attachments.map((att) => (
                        <li key={att.attachmentId} className="ml-2">
                          {att.filename} ({(att.size / 1024).toFixed(1)}KB)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
