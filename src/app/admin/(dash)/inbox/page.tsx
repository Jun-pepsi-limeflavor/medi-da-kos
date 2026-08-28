import Link from "next/link";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Filter,
  Inbox,
  Link2,
  Paperclip,
  Search,
  Users,
} from "lucide-react";
import { listThreadMessages } from "@/lib/repo/messages";
import { listThreads, type ThreadFilters } from "@/lib/repo/threads";
import type { Thread } from "@/lib/schemas/thread";
import { needsReply } from "@/lib/schemas/thread";

export const dynamic = "force-dynamic";

const CHANNEL_LABELS: Record<Thread["channel"], string> = {
  gmail_thomas: "Gmail · Thomas",
  gmail_hally: "Gmail · Hally",
  gmail_rheekw: "Gmail · Rheekw",
  gmail_songjh: "Gmail · Songjh",
  gmail_kimhs: "Gmail · Kimhs",
  gmail_parkjy: "Gmail · Parkjy",
  outlook_support: "Outlook · Support",
  channeltalk: "Channel Talk",
  web: "웹 문의",
};

const SIDE_LABELS: Record<Thread["side"], string> = {
  brand: "바이어",
  factory: "제조사",
  unknown: "판정 필요",
};

const READ_LABELS: Record<Thread["readState"], string> = {
  unread: "읽지 않음",
  read: "읽음",
};

const TRIAGE_LABELS: Record<Thread["triageState"], string> = {
  open: "열림",
  archived: "보관됨",
  ignored: "무시됨",
};

const LINK_LABELS: Record<Thread["linkState"], string> = {
  unlinked: "미연결",
  linked: "연결됨",
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR");
}

function getSideBadgeStyle(side: Thread["side"]): string {
  if (side === "brand") return "border-sky-800/80 bg-sky-950/60 text-sky-300";
  if (side === "factory") return "border-emerald-800/80 bg-emerald-950/60 text-emerald-300";
  return "border-amber-800/80 bg-amber-950/60 text-amber-300";
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

interface ThreadWithSummary extends Thread {
  hasAttachments: boolean;
  senderName: string;
  subject: string;
  bodySnippet: string;
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500 sm:min-w-[120px]">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-9 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 text-xs font-normal normal-case tracking-normal text-neutral-200 outline-none transition-colors focus:border-indigo-500"
      >
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InboxFilters({
  values,
}: {
  values: Record<string, string | undefined>;
}) {
  return (
    <form method="get" className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-neutral-200">
        <Filter className="h-3.5 w-3.5 text-indigo-400" />
        보기 필터
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <FilterSelect
          name="readState"
          label="읽음"
          value={values.readState}
          options={Object.entries(READ_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          name="triageState"
          label="처리"
          value={values.triageState}
          options={Object.entries(TRIAGE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          name="linkState"
          label="연결"
          value={values.linkState}
          options={Object.entries(LINK_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          name="side"
          label="상대"
          value={values.side}
          options={Object.entries(SIDE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          name="channel"
          label="채널"
          value={values.channel}
          options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          name="needsReply"
          label="답장"
          value={values.needsReply}
          options={[{ value: "true", label: "답장 필요" }]}
        />
        <div className="flex items-end gap-2 sm:ml-auto">
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            <Search className="h-3.5 w-3.5" />
            적용
          </button>
          <Link
            href="/admin/inbox"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-800 px-3 text-xs text-neutral-400 transition-colors hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200"
          >
            초기화
          </Link>
        </div>
      </div>
    </form>
  );
}

function ConversationRow({ thread }: { thread: ThreadWithSummary }) {
  const isUnread = thread.readState === "unread";
  const replyNeeded = needsReply(thread);
  const sender = thread.senderName || thread.sourceAccount;
  const linkedLabel = thread.dealId ? `딜 ${thread.dealId.slice(0, 8)}` : null;

  return (
    <Link
      href={`/admin/inbox/${encodeURIComponent(thread.threadKey)}`}
      className="group block border-b border-neutral-900/90 px-3 py-3.5 transition-colors first:rounded-t-xl hover:bg-neutral-800/80 focus-visible:bg-neutral-800/80 focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-200">
            {getInitial(sender)}
          </div>
          <span
            aria-label={replyNeeded ? "답장 필요" : isUnread ? "읽지 않음" : "읽음"}
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 ${replyNeeded ? "bg-amber-400" : isUnread ? "bg-indigo-400" : "bg-neutral-600"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-sm ${isUnread ? "font-semibold text-white" : "font-medium text-neutral-200"}`}>
              {sender}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-500">
              {formatRelativeTime(new Date(thread.lastMessageAt))}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className={`rounded-md border px-1.5 py-0.5 ${getSideBadgeStyle(thread.side)}`}>
              {SIDE_LABELS[thread.side]}
            </span>
            <span className="truncate">{CHANNEL_LABELS[thread.channel]}</span>
            {thread.hasAttachments && <Paperclip className="h-3 w-3 shrink-0 text-neutral-500" />}
            {linkedLabel && <span className="truncate text-indigo-300">· {linkedLabel}</span>}
          </div>
          <p className="mt-2 truncate text-xs font-medium text-neutral-300">
            {thread.subject || "제목 없음"}
          </p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {thread.bodySnippet || "본문 미리보기 없음"}
          </p>
        </div>
        <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-neutral-700 transition-colors group-hover:text-neutral-400" />
      </div>
    </Link>
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const values = {
    readState: typeof params.readState === "string" ? params.readState : undefined,
    triageState: typeof params.triageState === "string" ? params.triageState : undefined,
    linkState: typeof params.linkState === "string" ? params.linkState : undefined,
    side: typeof params.side === "string" ? params.side : undefined,
    channel: typeof params.channel === "string" ? params.channel : undefined,
    needsReply: typeof params.needsReply === "string" ? params.needsReply : undefined,
  };

  const filters: ThreadFilters = {};
  if (values.readState) filters.readState = values.readState as Thread["readState"];
  if (values.triageState) filters.triageState = values.triageState as Thread["triageState"];
  if (values.linkState) filters.linkState = values.linkState as Thread["linkState"];
  if (values.side) filters.side = values.side as Thread["side"];
  if (values.channel) filters.channel = values.channel as Thread["channel"];
  if (values.needsReply === "true") filters.needsReply = true;

  const threads = await listThreads(filters);
  const threadsWithSummary: ThreadWithSummary[] = await Promise.all(
    threads.map(async (thread) => {
      const messages = await listThreadMessages(thread.threadKey);
      const latest = messages[messages.length - 1];
      return {
        ...thread,
        hasAttachments: messages.some((message) => message.attachments.length > 0),
        senderName: latest?.fromName || latest?.from || thread.sourceAccount,
        subject: latest?.subject ?? "",
        bodySnippet: (latest?.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 100),
      };
    }),
  );

  const needsReplyCount = threadsWithSummary.filter(needsReply).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-indigo-300">
            <Inbox className="h-4 w-4" />
            Unified inbox
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">대화 인테이크</h1>
          <p className="mt-1 text-xs text-neutral-400">
            바이어와 제조사의 원문 대화를 한곳에서 확인하고 딜에 연결합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5">
            전체 <strong className="ml-1 text-neutral-100">{threadsWithSummary.length}</strong>
          </span>
          <span className="rounded-full border border-amber-900/70 bg-amber-950/30 px-3 py-1.5 text-amber-300">
            답장 필요 <strong className="ml-1">{needsReplyCount}</strong>
          </span>
        </div>
      </div>

      <InboxFilters values={values} />

      <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 shadow-2xl shadow-black/10">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">최근 대화</h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">선택하면 원문과 처리 상태를 확인할 수 있습니다.</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="hidden items-center gap-1 sm:flex"><ArrowDownLeft className="h-3 w-3 text-amber-400" />수신</span>
            <span className="hidden items-center gap-1 sm:flex"><ArrowUpRight className="h-3 w-3 text-indigo-400" />발신</span>
            <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />첨부</span>
          </div>
        </div>

        {threadsWithSummary.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-600">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-300">조건에 맞는 대화가 없습니다.</p>
              <p className="mt-1 text-xs text-neutral-500">필터를 초기화하거나 수집 상태를 확인해 주세요.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)]">
            <div className="max-h-[min(680px,calc(100vh-330px))] overflow-y-auto border-neutral-800 lg:border-r">
              {threadsWithSummary.map((thread) => <ConversationRow key={thread.threadKey} thread={thread} />)}
            </div>
            <div className="hidden min-h-[420px] items-center justify-center bg-neutral-950/20 px-8 text-center lg:flex">
              <div className="max-w-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-600">
                  <Users className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-medium text-neutral-300">대화를 선택하세요</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  바이어·제조사 메시지와 첨부파일, 딜 연결 상태가 대화 상세에 표시됩니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-neutral-600">
        <Archive className="h-3 w-3" /> 보관한 대화도 필터를 바꾸면 다시 확인할 수 있습니다.
        <Link2 className="ml-2 h-3 w-3" /> 원문 메시지는 수정되지 않습니다.
      </p>
    </div>
  );
}
