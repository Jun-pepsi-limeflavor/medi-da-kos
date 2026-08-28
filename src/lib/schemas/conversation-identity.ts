import { z } from "zod";

export const conversationIdentityKindSchema = z.enum(["email", "channeltalk"]);
export const conversationClassificationSchema = z.enum([
  "unclassified",
  "buyer",
  "supplier",
  "internal",
  "advertising",
]);

const isoTimestampSchema = z.iso.datetime();
const nonEmptyIdSchema = z.string().trim().min(1);

/** The only email normalization permitted for identity matching. */
export function normalizeEmailIdentity(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Firestore-safe, deterministic identity document IDs. Channel Talk callers
 * provide its source account and visitor/user ID separately to avoid mixing
 * similarly named users across desks.
 */
export function conversationIdentityId(
  kind: z.infer<typeof conversationIdentityKindSchema>,
  value: string,
  channelTalkUserId?: string,
): string {
  if (kind === "email") {
    const normalized = normalizeEmailIdentity(value);
    if (!normalized) throw new Error("email identity is required");
    return `email:${normalized}`;
  }

  const account = value.trim();
  const userId = channelTalkUserId?.trim();
  const normalized = userId === undefined ? account : `${account}:${userId}`;
  if (!account || !normalized || normalized.endsWith(":")) throw new Error("Channel Talk identity is required");
  return `channeltalk:${normalized}`;
}

export const conversationIdentitySchema = z.object({
  kind: conversationIdentityKindSchema,
  value: z.string().trim().min(1),
  classification: conversationClassificationSchema,
  conversationId: nonEmptyIdSchema.optional(),
  buyerId: nonEmptyIdSchema.optional(),
  supplierId: nonEmptyIdSchema.optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict().superRefine((identity, ctx) => {
  if (identity.kind === "email" && identity.value !== normalizeEmailIdentity(identity.value)) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "email identity must be normalized",
    });
  }

  if (identity.buyerId && identity.supplierId) {
    ctx.addIssue({ code: "custom", message: "buyerId and supplierId cannot both be set" });
  }

  const isReview = ["unclassified", "internal", "advertising"].includes(identity.classification);
  if (isReview && (identity.conversationId || identity.buyerId || identity.supplierId)) {
    ctx.addIssue({ code: "custom", message: "review identities cannot be linked to an entity or conversation" });
  }

  if (identity.classification === "buyer" && (!identity.buyerId || !identity.conversationId || identity.supplierId)) {
    ctx.addIssue({ code: "custom", message: "buyer identities require buyerId and conversationId" });
  }
  if (identity.classification === "supplier" && (!identity.supplierId || !identity.conversationId || identity.buyerId)) {
    ctx.addIssue({ code: "custom", message: "supplier identities require supplierId and conversationId" });
  }
});

export type ConversationIdentity = z.infer<typeof conversationIdentitySchema> & { id: string };
