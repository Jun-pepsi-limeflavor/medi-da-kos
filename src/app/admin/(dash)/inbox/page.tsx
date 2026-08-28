import Link from "next/link";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Filter,
  Forward,
  Inbox,
  Link2,
  Paperclip,
  Search,
  Users,
} from "lucide-react";
import { listThreadMessages } from "@/lib/repo/messages";
import { listThreads, type ThreadFilters } from "@/lib/repo/threads";
import { getCleanSnippet } from "@/lib/email-body";
import {
  isInternalStaffThread,
  isForwardedSubject,
} from "@/lib/internal-staff";
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

const SIDE_LABELS: Record<string, string> = {
  brand: "바이어",
  factory: "제조사",
  internal: "직원 (포워딩)",
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

function getSideBadgeStyle(side: string): string {
  if (side === "brand") return "border-sky-800/80 bg-sky-950/60 text-sky-300";
  if (side === "factory") return "border-emerald-800/80 bg-emerald-950/60 text-emerald-300";
  if (side === "internal") return "border-purple-800/80 bg-purple-950/60 text-purple-300";
  return "border-amber-800/80 bg-amber-950/60 text-amber-300";
}

function getInitial(name: string): string {
  const clean = name.replace(/^To:\s*/i, "").trim();
  return clean.charAt(0).toUpperCase() || "?";
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
  activeTab,
}: {
  values: Record<string, string | undefined>;
  activeTab: string;
}) {
  return (
    <form method="get" className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
      <input type="hidden" name="tab" value={activeTab} />
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-neutral-200">
        <Filter className="h-3.5 w-3.5 text-indigo-400" />
        상세 필터
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <FilterSelect
          name="channel"
          label="채널"
          value={values.channel}
          options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
        />
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
          label="딜 연결"
          value={values.linkState}
          options={Object.entries(LINK_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          name="side"
          label="상대 구분"
          value={values.side}
          options={Object.entries(SIDE_LABELS).map(([value, label]) => ({ value, label }))}
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
            href={`/admin/inbox?tab=${activeTab}`}
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
  const isOutbound = thread.lastDirection === "out";
  const counterparty = thread.senderName || thread.sourceAccount;
  const linkedLabel = thread.dealId ? `딜 ${thread.dealId.slice(0, 8)}` : null;

  const isInternal = isInternalStaffThread(thread, {
    from: thread.senderName,
    senderName: thread.senderName,
    subject: thread.subject,
  });
  const displaySide = isInternal ? "internal" : thread.side;
  const displaySideLabel = isInternal
    ? isForwardedSubject(thread.subject)
      ? "포워딩"
      : "직원"
    : SIDE_LABELS[thread.side] || "미분류";

  return (
    <Link
      href={`/admin/inbox/${encodeURIComponent(thread.threadKey)}`}
      className="group block border-b border-neutral-900/90 px-3 py-3.5 transition-colors first:rounded-t-xl hover:bg-neutral-800/80 focus-visible:bg-neutral-800/80 focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 shrink-0">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${
              isInternal
                ? "border-purple-800/70 bg-purple-950/60 text-purple-300"
                : isOutbound
                  ? "border-indigo-800/70 bg-indigo-950/60 text-indigo-300"
                  : "border-neutral-700 bg-neutral-800 text-neutral-200"
            }`}
          >
            {getInitial(counterparty)}
          </div>
          <span
            aria-label={replyNeeded ? "답장 필요" : isUnread ? "읽지 않음" : "읽음"}
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 ${
              replyNeeded ? "bg-amber-400" : isUnread ? "bg-indigo-400" : "bg-neutral-600"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                isUnread ? "font-semibold text-white" : "font-medium text-neutral-200"
              }`}
            >
              {counterparty}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-500">
              {formatRelativeTime(new Date(thread.lastMessageAt))}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-500">
            {isOutbound ? (
              <span className="inline-flex items-center gap-0.5 rounded-md border border-indigo-800/80 bg-indigo-950/60 px-1.5 py-0.5 font-medium text-indigo-300">
                <ArrowUpRight className="h-3 w-3" /> 발신
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-800/80 bg-amber-950/60 px-1.5 py-0.5 font-medium text-amber-300">
                <ArrowDownLeft className="h-3 w-3" /> 수신
              </span>
            )}
            <span className={`rounded-md border px-1.5 py-0.5 ${getSideBadgeStyle(displaySide)}`}>
              {displaySideLabel}
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
  const tabParam = typeof params.tab === "string" ? params.tab : undefined;
  // 기본 탭은 "in" (수신함)!
  const activeTab: "in" | "out" | "needsReply" | "forwarding" | "all" =
    tabParam === "out" ||
    tabParam === "needsReply" ||
    tabParam === "forwarding" ||
    tabParam === "all"
      ? tabParam
      : "in";

  const values = {
    readState: typeof params.readState === "string" ? params.readState : undefined,
    triageState: typeof params.triageState === "string" ? params.triageState : undefined,
    linkState: typeof params.linkState === "string" ? params.linkState : undefined,
    side: typeof params.side === "string" ? params.side : undefined,
    channel: typeof params.channel === "string" ? params.channel : undefined,
  };

  // 1. 전체 스레드 및 요약 정보 로드
  const allThreads = await listThreads({}, 1000);
  const allThreadsWithSummary: ThreadWithSummary[] = await Promise.all(
    allThreads.map(async (thread) => {
      const messages = await listThreadMessages(thread.threadKey);
      const latest = messages[messages.length - 1];
      const isOutbound = thread.lastDirection === "out";

      let displayName = "";
      if (isOutbound) {
        const toAddress = latest?.to?.[0];
        displayName = toAddress ? `To: ${toAddress}` : thread.sourceAccount;
      } else {
        displayName = latest?.fromName || latest?.from || thread.sourceAccount;
      }

      return {
        ...thread,
        hasAttachments: messages.some((message) => message.attachments.length > 0),
        senderName: displayName,
        subject: latest?.subject ?? "",
        bodySnippet: getCleanSnippet(latest?.bodyText ?? "", 100),
      };
    }),
  );

  const totalCount = allThreadsWithSummary.length;
  const inCount = allThreadsWithSummary.filter((t) => t.lastDirection === "in").length;
  const outCount = allThreadsWithSummary.filter((t) => t.lastDirection === "out").length;
  const needsReplyCount = allThreadsWithSummary.filter(needsReply).length;
  const forwardingCount = allThreadsWithSummary.filter((t) =>
    isInternalStaffThread(t, {
      from: t.senderName,
      senderName: t.senderName,
      subject: t.subject,
    }),
  ).length;

  // 2. 현재 선택된 탭 및 상세 필터 적용
  const filteredThreads = allThreadsWithSummary.filter((t) => {
    const isInternal = isInternalStaffThread(t, {
      from: t.senderName,
      senderName: t.senderName,
      subject: t.subject,
    });

    if (activeTab === "in") {
      if (t.lastDirection !== "in") return false;
    } else if (activeTab === "out") {
      if (t.lastDirection !== "out") return false;
    } else if (activeTab === "needsReply") {
      if (!needsReply(t)) return false;
    } else if (activeTab === "forwarding") {
      if (!isInternal) return false;
    }

    if (values.readState && t.readState !== values.readState) return false;
    if (values.triageState && t.triageState !== values.triageState) return false;
    if (values.linkState && t.linkState !== values.linkState) return false;
    if (values.channel && t.channel !== values.channel) return false;

    if (values.side) {
      if (values.side === "internal" && !isInternal) return false;
      if (values.side === "brand" && (t.side !== "brand" || isInternal)) return false;
      if (values.side === "factory" && (t.side !== "factory" || isInternal)) return false;
      if (values.side === "unknown" && (t.side !== "unknown" || isInternal)) return false;
    }

    return true;
  });

  const threadsWithSummary = filteredThreads.slice(0, 100);

  const getTabUrl = (tab: string) => {
    const p = new URLSearchParams();
    p.set("tab", tab);
    for (const [k, v] of Object.entries(values)) {
      if (v) p.set(k, v);
    }
    return `/admin/inbox?${p.toString()}`;
  };

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
      </div>

      {/* 수신함 / 답장필요 / 발신함 / 포워딩(직원) / 전체 탭 컨트롤 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-800 pb-2">
        <Link
          href={getTabUrl("in")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "in"
              ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <ArrowDownLeft className="h-3.5 w-3.5 text-amber-400" />
          <span>수신함 (받은 대화)</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              activeTab === "in" ? "bg-neutral-950 text-white" : "bg-neutral-900 text-neutral-500"
            }`}
          >
            {inCount}
          </span>
        </Link>
        <Link
          href={getTabUrl("needsReply")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "needsReply"
              ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <span>답장 필요</span>
          <span className="rounded-full border border-amber-800/80 bg-amber-950/60 px-2 py-0.5 text-[11px] font-bold text-amber-300">
            {needsReplyCount}
          </span>
        </Link>
        <Link
          href={getTabUrl("out")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "out"
              ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />
          <span>발신함 (보낸 대화)</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              activeTab === "out" ? "bg-neutral-950 text-white" : "bg-neutral-900 text-neutral-500"
            }`}
          >
            {outCount}
          </span>
        </Link>
        <Link
          href={getTabUrl("forwarding")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "forwarding"
              ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <Forward className="h-3.5 w-3.5 text-purple-400" />
          <span>포워딩 (직원 대화)</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
              activeTab === "forwarding"
                ? "border-purple-700 bg-purple-950 text-purple-200"
                : "border-neutral-800 bg-neutral-900 text-neutral-400"
            }`}
          >
            {forwardingCount}
          </span>
        </Link>
        <Link
          href={getTabUrl("all")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "all"
              ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <span>전체</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              activeTab === "all" ? "bg-neutral-950 text-white" : "bg-neutral-900 text-neutral-500"
            }`}
          >
            {totalCount}
          </span>
        </Link>
      </div>

      <InboxFilters values={values} activeTab={activeTab} />

      <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 shadow-2xl shadow-black/10">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">
              {activeTab === "in"
                ? "수신 대화 목록"
                : activeTab === "out"
                  ? "발신 대화 목록"
                  : activeTab === "needsReply"
                    ? "답장 필요 목록"
                    : "전체 대화 목록"}
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {filteredThreads.length}건 중 {threadsWithSummary.length}건 표시 (선택 시 상세 및 원문 확인)
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <ArrowDownLeft className="h-3 w-3 text-amber-400" />수신
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-indigo-400" />발신
            </span>
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />첨부
            </span>
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
              {threadsWithSummary.map((thread) => (
                <ConversationRow key={thread.threadKey} thread={thread} />
              ))}
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
