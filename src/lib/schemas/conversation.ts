import { z } from "zod";

export const workflowStateSchema = z.enum(["active", "waiting_customer", "done"]);

const isoTimestampSchema = z.iso.datetime();
const idSchema = z.string().trim().min(1);
const emailSchema = z.string().trim().toLowerCase().min(1);

const conversationDocumentSchema = z.object({
  buyerId: idSchema.optional(),
  supplierId: idSchema.optional(),
  identityIds: z.array(idSchema).min(1),
  mergedConversationIds: z.array(idSchema).default([]),
  ownerEmail: emailSchema.optional(),
  collaboratorEmails: z.array(emailSchema).default([]),
  workflowState: workflowStateSchema,
  nextAction: z.string().trim().min(1).optional(),
  dueAt: isoTimestampSchema.optional(),
  defaultOutboundAccount: emailSchema.optional(),
  counterpartyLabel: z.string().trim().min(1).optional(),
  lastSubject: z.string().trim().min(1).optional(),
  lastSnippet: z.string().trim().min(1).optional(),
  providerLabels: z.array(z.string().trim().min(1)).default([]),
  lastActivityAt: isoTimestampSchema,
  oldestUnansweredAt: isoTimestampSchema.optional(),
  unansweredThreadCount: z.number().int().nonnegative(),
  threadCount: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict().superRefine((conversation, ctx) => {
  if (conversation.buyerId && conversation.supplierId) {
    ctx.addIssue({ code: "custom", message: "buyerId and supplierId cannot both be set" });
  }
});

/** Server-maintained customer-work record. It intentionally excludes finance and raw message bodies. */
export const conversationSchema = conversationDocumentSchema;

/** Fields an administrator may change after the server has created the conversation. */
export const conversationPatchSchema = z.object({
  ownerEmail: emailSchema.nullable().optional(),
  collaboratorEmails: z.array(emailSchema).optional(),
  workflowState: workflowStateSchema.optional(),
  nextAction: z.string().trim().min(1).nullable().optional(),
  dueAt: isoTimestampSchema.nullable().optional(),
  defaultOutboundAccount: emailSchema.nullable().optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, {
  message: "변경할 필드가 없습니다",
});

export const conversationRollupSchema = conversationDocumentSchema.pick({
  buyerId: true,
  supplierId: true,
  identityIds: true,
  ownerEmail: true,
  workflowState: true,
  nextAction: true,
  dueAt: true,
  counterpartyLabel: true,
  lastSubject: true,
  lastSnippet: true,
  providerLabels: true,
  lastActivityAt: true,
  oldestUnansweredAt: true,
  unansweredThreadCount: true,
  threadCount: true,
});

export type Conversation = z.infer<typeof conversationSchema> & { id: string };
export type ConversationPatch = z.infer<typeof conversationPatchSchema>;
export type ConversationRollup = z.infer<typeof conversationRollupSchema> & { id: string };
