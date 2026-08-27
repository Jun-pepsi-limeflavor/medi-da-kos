import { z } from "zod";

const trimmed = z.string().transform((s) => s.trim());
const required = trimmed.refine((s) => s.length > 0, { message: "필수 항목입니다" });
const email = trimmed
  .transform((s) => s.toLowerCase())
  .refine((s) => s.includes("@") && s.length >= 5, { message: "이메일 형식이 아닙니다" });

const contactSchema = z.object({
  name: required,
  title: trimmed.default(""),
  email,
  phone: trimmed.default(""),
  channel: z.enum(["email", "phone", "kakao", "other"]),
});

const supplierBaseSchema = z.object({
  companyName: required,
  contacts: z.array(contactSchema).min(1),
  capabilities: z.array(z.enum([
    "formulation", "packaging", "filling", "testing", "logistics",
  ])).min(1),
  productionModels: z.array(z.enum([
    "OEM", "ODM", "private_label", "tech_transfer",
  ])).default([]),
  supportedCerts: z.array(trimmed).default([]),
});

export const supplierInputSchema = supplierBaseSchema.transform((input) => ({
  ...input,
  contactEmails: [...new Set(input.contacts.map((c) => c.email))],
}));

export type SupplierInput = z.infer<typeof supplierInputSchema>;

export type Supplier = SupplierInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
