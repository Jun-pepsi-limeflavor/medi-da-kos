import { z } from "zod";

// ============================================================================
// 추출 스키마 (메일/메시지 본문에서 LLM이 추출한 딜 제안 데이터)
//
// 주의: 원가/마진/재무 데이터는 절대 여기에 포함하지 않는다.
// 모든 필드는 optional이며, 모델이 지어내지 않도록 강제 필드를 두지 않는다.
// .strict()를 사용하지 않아 모델의 여분 키는 Zod 기본 동작으로 자연스럽게 제거된다.
// ============================================================================

export const extractionBuyerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  brandName: z.string().optional(),
  country: z.string().optional(),
});

export const extractionFormulaSchema = z.object({
  formulaType: z.string().optional(),
  keyIngredients: z.string().optional(),
  excludedIngredients: z.string().optional(),
  notes: z.string().optional(),
});

export const extractionPackagingSchema = z.object({
  containerType: z.string().optional(),
  material: z.string().optional(),
  outerBox: z.string().optional(),
  notes: z.string().optional(),
});

export const extractionItemSchema = z.object({
  productName: z.string().optional(),
  variantName: z.string().optional(),
  category: z.string().optional(),
  volume: z.string().optional(),
  expectedQty: z.union([z.string(), z.number().transform(String)]).optional(),
  formula: extractionFormulaSchema.optional(),
  packaging: extractionPackagingSchema.optional(),
});

export const extractionCertificationsSchema = z.object({
  requiredCerts: z.array(z.string()).optional(),
});

export const extractionTimelineSchema = z.object({
  sampleTargetDate: z.string().optional(),
  targetLaunchDate: z.string().optional(),
});

export const extractionShippingSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
});

export const extractionSchema = z.object({
  buyer: extractionBuyerSchema.optional(),
  items: z.array(extractionItemSchema).optional(),
  certifications: extractionCertificationsSchema.optional(),
  timeline: extractionTimelineSchema.optional(),
  shipping: extractionShippingSchema.optional(),
});

export const confidenceMapSchema = z.record(
  z.string(),
  z.number().min(0).max(1),
);

export type ExtractionBuyer = z.infer<typeof extractionBuyerSchema>;
export type ExtractionFormula = z.infer<typeof extractionFormulaSchema>;
export type ExtractionPackaging = z.infer<typeof extractionPackagingSchema>;
export type ExtractionItem = z.infer<typeof extractionItemSchema>;
export type ExtractionCertifications = z.infer<typeof extractionCertificationsSchema>;
export type ExtractionTimeline = z.infer<typeof extractionTimelineSchema>;
export type ExtractionShipping = z.infer<typeof extractionShippingSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type ConfidenceMap = z.infer<typeof confidenceMapSchema>;

/**
 * 모델 출력 문자열에서 JSON을 복구하여 스키마 검증을 거친 후 추출값과 확신도 맵을 반환한다.
 * - 마크다운 코드 블록(```json ... ```) 제거
 * - 첫번째 '{'부터 마지막 '}'까지 슬라이스
 * - extractionSchema.safeParse 및 confidenceMapSchema.safeParse 수행
 * - 파싱 실패 시 빈 객체 `{}` 및 빈 confidence `{}` 반환
 */
export function parseModelOutput(rawText: string): {
  extraction: Extraction;
  confidence: ConfidenceMap;
} {
  const fallback = { extraction: {} as Extraction, confidence: {} as ConfidenceMap };

  if (!rawText || typeof rawText !== "string") {
    return fallback;
  }

  try {
    let text = rawText.trim();

    // 1. 마크다운 코드 블록 (```json ... ``` 또는 ``` ... ```) 추출
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
    }

    // 2. 첫번째 '{'부터 마지막 '}'까지 슬라이스
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      return fallback;
    }

    const jsonStr = text.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }

    // { extraction: { ... }, confidence: { ... } } 구조와
    // 최상위에 { buyer, items, ..., confidence } 가 있는 구조 둘 다 지원
    const rawExtraction =
      parsed.extraction && typeof parsed.extraction === "object" && !Array.isArray(parsed.extraction)
        ? parsed.extraction
        : parsed;

    const extractionResult = extractionSchema.safeParse(rawExtraction);
    if (!extractionResult.success) {
      return fallback;
    }

    let confidence: ConfidenceMap = {};
    if (parsed.confidence && typeof parsed.confidence === "object" && !Array.isArray(parsed.confidence)) {
      const confResult = confidenceMapSchema.safeParse(parsed.confidence);
      if (confResult.success) {
        confidence = confResult.data;
      }
    }

    return {
      extraction: extractionResult.data,
      confidence,
    };
  } catch {
    return fallback;
  }
}
