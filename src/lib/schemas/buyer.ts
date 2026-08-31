import { z } from "zod";

const trimmed = z.string().transform((s) => s.trim());
const required = trimmed.refine((s) => s.length > 0, { message: "필수 항목입니다" });

export const INFLOW_CHANNELS = [
  "gmail_thomas", "gmail_hally", "support", "outlook", "website",
  "channel_talk", "coldmail", "manual",
] as const;

export const buyerInputSchema = z.object({
  name: required,
  emails: z
    .array(trimmed.transform((s) => s.toLowerCase()))
    .transform((list) => [...new Set(list.filter((e) => e.includes("@")))])
    .refine((list) => list.length > 0, { message: "이메일이 최소 하나 필요합니다" }),
  inflowChannel: z.enum(INFLOW_CHANNELS),
  brandName: trimmed.default(""),
  country: trimmed.default(""),
  phone: trimmed.default(""),
});

export type BuyerInput = z.infer<typeof buyerInputSchema>;

export type Buyer = BuyerInput & {
  id: string;
  firebaseUid?: string;
  lastContactAt?: string;
  createdAt: string;
  updatedAt: string;
};
