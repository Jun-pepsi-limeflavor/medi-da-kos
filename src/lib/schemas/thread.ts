import { z } from "zod";
import { channelSchema, directionSchema, sideSchema, sideSourceSchema, type Message } from "./message.ts";

export const readStateSchema = z.enum(["unread", "read"]);
export const triageStateSchema = z.enum(["open", "archived", "ignored"]);
export const linkStateSchema = z.enum(["unlinked", "linked"]);

const sideHistoryEntrySchema = z.object({
  from: sideSchema,
  to: sideSchema,
  reason: z.string(),
  actor: z.string(),
  at: z.string(),
});

export const threadSchema = z.object({
  channel: channelSchema,
  sourceAccount: z.string(),
  providerThreadId: z.string(),
  readState: readStateSchema,
  triageState: triageStateSchema,
  linkState: linkStateSchema,
  side: sideSchema,
  sideSource: sideSourceSchema,
  sideHistory: z.array(sideHistoryEntrySchema).default([]),
  lastMessageAt: z.string(),
  lastDirection: directionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  // 계획의 Task 3(발신자 연결)이 채운다. 지금 수집기는 쓰지 않는다.
  buyerId: z.string().trim().min(1).optional(),
  supplierId: z.string().trim().min(1).optional(),
  dealId: z.string().trim().min(1).optional(),
  linkedBy: z.string().trim().min(1).optional(),
  linkedAt: z.string().optional(),
});

// threadKey는 문서 ID이지 저장 필드가 아니다 — store.js가 만든 문서를 보면 안 들어 있다.
export type Thread = z.infer<typeof threadSchema> & { threadKey: string };

/** Global Constraints: threadKey는 {channel}:{sourceAccount}:{providerThreadId}다. */
export function buildThreadKey(channel: string, sourceAccount: string, providerThreadId: string): string {
  return `${channel}:${sourceAccount}:${providerThreadId}`;
}

/** 이 화면의 존재 이유 — 마지막이 받은 메일이면 아직 답장하지 않은 것이다. */
export function needsReply(thread: Pick<Thread, "lastDirection">): boolean {
  return thread.lastDirection === "in";
}

/**
 * 자동 side 판정(수집기의 account_rule, Task 3의 address_match)을 적용할지 정한다.
 * sideSource가 manual이면 사람이 이미 고친 것이므로 절대 덮지 않는다.
 */
export function nextAutoSide(
  current: Pick<Thread, "side" | "sideSource">,
  proposed: { side: Thread["side"]; sideSource: Exclude<Thread["sideSource"], "manual"> },
): Pick<Thread, "side" | "sideSource"> {
  if (current.sideSource === "manual") {
    return { side: current.side, sideSource: current.sideSource };
  }
  return proposed;
}

/**
 * Task 3 Step 1 — 스레드의 마지막 메시지에서 상대(카운터파티) 주소를 뽑는다.
 * 인바운드는 from, 아웃바운드는 우리 주소(ourAddress = thread.sourceAccount)를
 * 제외한 to[]의 첫 주소를 쓴다. 아웃바운드인데 상대 주소가 없으면(우리끼리만
 * 주고받은 경우 등) null이다.
 */
export function extractCounterpartyAddress(
  messages: Pick<Message, "direction" | "from" | "to">[],
  ourAddress: string,
): string | null {
  const latest = messages[messages.length - 1];
  if (!latest) return null;

  if (latest.direction === "in") {
    const from = latest.from.trim().toLowerCase();
    return from || null;
  }

  const our = ourAddress.trim().toLowerCase();
  const candidate = latest.to.find((addr) => addr.trim().toLowerCase() !== our);
  return candidate ? candidate.trim().toLowerCase() : null;
}

/**
 * Task 3 Step 1 — 주소 매칭 결과로 side를 고칠지 정한다. sideSource='manual'은
 * nextAutoSide()가 그대로 막는다.
 *
 * - side='unknown'일 때: 양쪽 중 정확히 하나만 매칭되면 그 side로 올린다.
 *   둘 다 매칭되거나 아무 데도 없으면 unknown을 유지한다.
 * - side가 이미 brand/factory일 때: 반대쪽에서만 매칭되면(=메일함 기본값과
 *   모순되는 증거) 그 반대쪽으로 고친다. 같은 쪽이 확인되거나 증거가 없으면
 *   기존 값을 그대로 둔다 — 등록된 상대가 아직 없다고 계정 기본값을 지우지 않는다.
 */
export function resolveAddressMatchSide(
  current: Pick<Thread, "side" | "sideSource">,
  match: { buyer: boolean; supplier: boolean },
): Pick<Thread, "side" | "sideSource"> {
  const onlyBuyer = match.buyer && !match.supplier;
  const onlySupplier = match.supplier && !match.buyer;

  let proposed: { side: Thread["side"]; sideSource: "address_match" } | null = null;
  if (current.side === "unknown") {
    if (onlyBuyer) proposed = { side: "brand", sideSource: "address_match" };
    else if (onlySupplier) proposed = { side: "factory", sideSource: "address_match" };
  } else if (current.side === "brand" && onlySupplier) {
    proposed = { side: "factory", sideSource: "address_match" };
  } else if (current.side === "factory" && onlyBuyer) {
    proposed = { side: "brand", sideSource: "address_match" };
  }

  if (!proposed) return { side: current.side, sideSource: current.sideSource };
  return nextAutoSide(current, proposed);
}

/**
 * correctThreadSide()의 순수 부분 — 새 side·sideHistory를 계산한다.
 * 공백뿐인 사유는 거부한다. 기존 sideHistory는 지우지 않고 뒤에 이어붙인다.
 */
export function appendSideCorrection(
  current: Pick<Thread, "side" | "sideHistory">,
  next: { side: Thread["side"]; reason: string; actor: string; at: string },
): Pick<Thread, "side" | "sideSource" | "sideHistory"> {
  const reason = next.reason.trim();
  if (!reason) {
    throw new Error("정정 사유가 필요합니다");
  }
  return {
    side: next.side,
    sideSource: "manual",
    sideHistory: [
      ...current.sideHistory,
      { from: current.side, to: next.side, reason, actor: next.actor, at: next.at },
    ],
  };
}

export const threadStatePatchSchema = z.object({
  readState: readStateSchema.optional(),
  triageState: triageStateSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "변경할 필드가 없습니다" });

export type ThreadStatePatch = z.infer<typeof threadStatePatchSchema>;

export const threadLinkInputSchema = z
  .object({
    buyerId: z.string().trim().min(1).optional(),
    supplierId: z.string().trim().min(1).optional(),
    dealId: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (v) => (v.buyerId ? 1 : 0) + (v.supplierId ? 1 : 0) <= 1,
    { message: "buyerId와 supplierId는 동시에 지정할 수 없습니다" }
  )
  .refine(
    (v) => (v.buyerId ? 1 : 0) + (v.supplierId ? 1 : 0) + (v.dealId !== undefined ? 1 : 0) >= 1,
    { message: "연결할 대상(buyerId, supplierId, dealId)을 최소 하나 지정해야 합니다" }
  );

export type ThreadLinkInput = z.infer<typeof threadLinkInputSchema>;
