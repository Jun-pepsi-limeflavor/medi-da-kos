import { applyAddressMatch, getThread } from "@/lib/repo/threads";
import { listThreadMessages } from "@/lib/repo/messages";
import { getIntakeReview, setIntakeReview } from "@/lib/repo/intake-reviews";
import type { Message } from "@/lib/schemas/message";
import type { IntakeReview } from "@/lib/schemas/intake-review";
import { requireAdminPage } from "@/lib/admin-page";
import ThreadActions from "../ThreadActions";
import ExtractionPanel from "./ExtractionPanel";
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

  // 최신 인바운드 메시지(앵커 메시지) 탐색
  const anchorMessage =
    [...messages].reverse().find((m) => m.direction === "in") ??
    messages[messages.length - 1] ??
    null;

  // Task 3 Step 4 — web 채널은 폼 제출 쪽 인테이크가 따로 있다. 메일함
  // 채널(gmail_*·outlook_*·channeltalk)로 들어온 스레드를 처음 열었을 때만
  // raw 판정을 만든다. 이미 있으면 손대지 않는다 — 상태를 덮지 않는다.
  let existingReview: IntakeReview | null = null;
  if (thread.channel !== "web") {
    existingReview = await getIntakeReview("message", decodedKey);
    if (!existingReview) {
      existingReview = await setIntakeReview(
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

      {/* 2-column or Side-by-Side: Left Messages, Right ExtractionPanel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: 메시지 목록 */}
        <div className="xl:col-span-6 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300">원문 대화 메시지 ({messages.length}개)</h2>
          {messages.length === 0 ? (
            <p className="text-xs text-neutral-500">메시지가 없습니다.</p>
          ) : (
            <div className="space-y-4 divide-y divide-neutral-800">
              {messages.map((msg: Message) => (
                <div key={msg.id} className="pt-4 first:pt-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-neutral-100">{msg.fromName || msg.from}</span>
                      <span className="text-xs text-neutral-500">({msg.from})</span>
                      {msg.direction === "in" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                          수신
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                          발신
                        </span>
                      )}
                      {anchorMessage && msg.id === anchorMessage.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                          추출 대상 (앵커)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500">{formatDatetime(msg.sentAt)}</span>
                  </div>
                  <div className="text-xs text-neutral-300 font-medium mb-2">{msg.subject}</div>
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

        {/* Right Column: AI 추출 패널 */}
        <div className="xl:col-span-6 xl:sticky xl:top-6">
          {anchorMessage ? (
            <ExtractionPanel
              anchorMessage={anchorMessage}
              threadKey={decodedKey}
              thread={thread}
              intakeReview={existingReview}
            />
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center text-neutral-500 text-sm">
              분석할 수신 메시지가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

