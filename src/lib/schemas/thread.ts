import { z } from "zod";
import { channelSchema, directionSchema, sideSchema, sideSourceSchema } from "./message.ts";

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

export const threadLinkInputSchema = z.object({
  buyerId: z.string().trim().min(1).optional(),
  supplierId: z.string().trim().min(1).optional(),
}).refine((v) => (v.buyerId ? 1 : 0) + (v.supplierId ? 1 : 0) === 1, {
  message: "buyerId 또는 supplierId 중 하나만 지정합니다",
});

export type ThreadLinkInput = z.infer<typeof threadLinkInputSchema>;
