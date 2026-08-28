import { z } from "zod";

export const intakeSourceSchema = z.enum([
  "order", "sampleRequest", "contact", "koreaLead", "landingRequest", "message",
]);

export const intakeReviewInputSchema = z.object({
  source: intakeSourceSchema,
  externalId: z.string().trim().min(1),
  sourceRef: z.string().trim().min(1),
  status: z.enum(["raw", "qualified", "rejected"]),
  reason: z.string().trim().default(""),
  isTest: z.boolean(),
  isTestReason: z.string().trim().default(""),
  dealId: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.status !== "raw" && !value.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "판정 사유가 필요합니다" });
  }
  if (value.isTest && !value.isTestReason) {
    ctx.addIssue({ code: "custom", path: ["isTestReason"], message: "테스트 근거가 필요합니다" });
  }
});

export type IntakeReviewInput = z.infer<typeof intakeReviewInputSchema>;
export type IntakeReview = IntakeReviewInput & {
  reviewedBy: string;
  reviewedAt: string;
};

export function intakeReviewId(source: string, externalId: string): string {
  return Buffer.from(`${source}\0${externalId}`, "utf8").toString("base64url");
}

/** 판정이 없으면 raw다 — 필드 부재를 고객·테스트로 추측하지 않는다. */
export function isQualifiedIntake(
  review: Pick<IntakeReview, "status" | "isTest"> | undefined,
): boolean {
  if (!review) return false;
  return review.status === "qualified" && !review.isTest;
}
