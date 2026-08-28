import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractionSchema,
  extractionBuyerSchema,
  extractionItemSchema,
  extractionFormulaSchema,
  extractionPackagingSchema,
  extractionCertificationsSchema,
  extractionTimelineSchema,
  extractionShippingSchema,
  confidenceMapSchema,
  parseModelOutput,
} from "../src/lib/schemas/extraction.ts";

// ============================================================================
// 1. extractionSchema 기본 검증
// ============================================================================

test("빈 객체 {}도 통과한다 (아무것도 못 뽑은 경우)", () => {
  const result = extractionSchema.safeParse({});
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {});
  }
});

test("정상 입력 데이터를 파싱한다", () => {
  const input = {
    buyer: {
      name: "Alice Smith",
      email: "alice@example.com",
      brandName: "GlowLab",
      country: "US",
    },
    items: [
      {
        productName: "Calming Serum",
        variantName: "Standard",
        category: "Serum",
        volume: "50ml",
        expectedQty: "5,000 pcs",
        formula: {
          formulaType: "Gel",
          keyIngredients: "Centella Asiatica, Niacinamide",
          excludedIngredients: "Parabens",
          notes: "Soothing finish",
        },
        packaging: {
          containerType: "Dropper bottle",
          material: "Glass",
          outerBox: "Paper box with FSC cert",
          notes: "Matte coating",
        },
      },
    ],
    certifications: {
      requiredCerts: ["ISO 22716", "Vegan"],
    },
    timeline: {
      sampleTargetDate: "2026-09-15",
      targetLaunchDate: "2026-12-01",
    },
    shipping: {
      country: "US",
      city: "Los Angeles",
    },
  };

  const result = extractionSchema.safeParse(input);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.buyer?.name, "Alice Smith");
    assert.equal(result.data.items?.[0]?.productName, "Calming Serum");
    assert.equal(result.data.items?.[0]?.formula?.keyIngredients, "Centella Asiatica, Niacinamide");
    assert.equal(result.data.items?.[0]?.packaging?.material, "Glass");
    assert.deepEqual(result.data.certifications?.requiredCerts, ["ISO 22716", "Vegan"]);
    assert.equal(result.data.timeline?.sampleTargetDate, "2026-09-15");
    assert.equal(result.data.shipping?.city, "Los Angeles");
  }
});

test("알 수 없는 여분 키가 주어졌을 때 에러 없이 제거하고 통과한다 (.strict 미사용)", () => {
  const input = {
    buyer: {
      name: "Bob",
      randomExtraKey: "should be stripped",
    },
    unknownTopLevel: 12345,
    anotherRandomField: { foo: "bar" },
    items: [
      {
        productName: "Sunscreen",
        itemExtra: "strip this too",
      },
    ],
  };

  const result = extractionSchema.safeParse(input);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.buyer?.name, "Bob");
    assert.equal((result.data.buyer as Record<string, unknown>).randomExtraKey, undefined);
    assert.equal((result.data as Record<string, unknown>).unknownTopLevel, undefined);
    assert.equal((result.data as Record<string, unknown>).anotherRandomField, undefined);
    assert.equal(result.data.items?.[0]?.productName, "Sunscreen");
    assert.equal((result.data.items?.[0] as Record<string, unknown>).itemExtra, undefined);
  }
});

test("원가 및 재무 키워드가 주어져도 스키마에서 보존되지 않고 제거된다", () => {
  const input = {
    buyer: { name: "Carol" },
    unitCost: 1500,
    supplierCost: 1200,
    margin: 0.25,
    items: [
      {
        productName: "Moisturizer",
        unitCost: 1000,
        supplierCost: 800,
        margin: 0.2,
      },
    ],
  };

  const result = extractionSchema.safeParse(input);
  assert.equal(result.success, true);
  if (result.success) {
    const data = result.data as Record<string, unknown>;
    assert.equal(data.unitCost, undefined);
    assert.equal(data.supplierCost, undefined);
    assert.equal(data.margin, undefined);

    const item = result.data.items?.[0] as Record<string, unknown>;
    assert.equal(item.unitCost, undefined);
    assert.equal(item.supplierCost, undefined);
    assert.equal(item.margin, undefined);
  }
});

test("문자열이 와야 할 자리에 객체나 배열이 오면 거부한다", () => {
  const invalidBuyerName = {
    buyer: {
      name: { first: "Invalid", last: "Object" },
    },
  };
  const result = extractionSchema.safeParse(invalidBuyerName);
  assert.equal(result.success, false);

  const invalidCert = {
    certifications: {
      requiredCerts: "This should be an array, not a string",
    },
  };
  const certResult = extractionSchema.safeParse(invalidCert);
  assert.equal(certResult.success, false);
});

// ============================================================================
// 2. confidenceMapSchema 유효성 검증
// ============================================================================

test("confidence 범위(0..1)가 유효한 경우 통과한다", () => {
  const valid = {
    "buyer.name": 0.95,
    "buyer.brandName": 1.0,
    "items[0].productName": 0.0,
    "items[0].volume": 0.85,
  };

  const result = confidenceMapSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data["buyer.name"], 0.95);
    assert.equal(result.data["buyer.brandName"], 1.0);
    assert.equal(result.data["items[0].productName"], 0.0);
  }
});

test("confidence가 0 미만이거나 1 초과하면 거부한다", () => {
  const tooLow = { "buyer.name": -0.1 };
  const lowResult = confidenceMapSchema.safeParse(tooLow);
  assert.equal(lowResult.success, false);

  const tooHigh = { "buyer.name": 1.05 };
  const highResult = confidenceMapSchema.safeParse(tooHigh);
  assert.equal(highResult.success, false);

  const notANumber = { "buyer.name": "high" };
  const nanResult = confidenceMapSchema.safeParse(notANumber);
  assert.equal(nanResult.success, false);
});

// ============================================================================
// 3. parseModelOutput 헬퍼 함수 검증
// ============================================================================

test("parseModelOutput: 빈 객체 {} JSON 문자열을 정상 파싱한다", () => {
  const { extraction, confidence } = parseModelOutput("{}");
  assert.deepEqual(extraction, {});
  assert.deepEqual(confidence, {});
});

test("parseModelOutput: 마크다운 코드 펜스(```json ... ```) 포함 텍스트를 정상 복구한다", () => {
  const raw = `
\`\`\`json
{
  "buyer": {
    "name": "David",
    "brandName": "Nordic Skincare"
  },
  "items": [
    {
      "productName": "Hydrating Mist",
      "volume": "100ml",
      "expectedQty": "2,000 pcs"
    }
  ],
  "confidence": {
    "buyer.name": 0.9,
    "buyer.brandName": 0.85,
    "items[0].productName": 0.95
  }
}
\`\`\`
`;

  const { extraction, confidence } = parseModelOutput(raw);
  assert.equal(extraction.buyer?.name, "David");
  assert.equal(extraction.buyer?.brandName, "Nordic Skincare");
  assert.equal(extraction.items?.[0]?.productName, "Hydrating Mist");
  assert.equal(extraction.items?.[0]?.volume, "100ml");
  assert.equal(confidence["buyer.name"], 0.9);
  assert.equal(confidence["items[0].productName"], 0.95);
});

test("parseModelOutput: 앞뒤 설명 문구가 붙은 JSON 문자열을 정상 슬라이싱 및 파싱한다", () => {
  const raw = `
Here is the extraction result based on the provided email:

{
  "buyer": {
    "name": "Elena",
    "country": "France"
  },
  "shipping": {
    "country": "France",
    "city": "Paris"
  },
  "confidence": {
    "buyer.name": 0.8,
    "buyer.country": 0.9
  }
}

Please let me know if you need anything else!
`;

  const { extraction, confidence } = parseModelOutput(raw);
  assert.equal(extraction.buyer?.name, "Elena");
  assert.equal(extraction.buyer?.country, "France");
  assert.equal(extraction.shipping?.city, "Paris");
  assert.equal(confidence["buyer.name"], 0.8);
});

test("parseModelOutput: 마크다운 코드 블록과 앞뒤 설명 문구가 모두 있을 때 정상 파싱한다", () => {
  const raw = `
Sure! Below is the requested JSON format:

\`\`\`
{
  "items": [
    {
      "productName": "Lip Gloss",
      "variantName": "Berry Red",
      "expectedQty": "10,000"
    }
  ],
  "confidence": {
    "items[0].productName": 0.9
  }
}
\`\`\`

Note: Packaging was not mentioned in the email.
`;

  const { extraction, confidence } = parseModelOutput(raw);
  assert.equal(extraction.items?.[0]?.productName, "Lip Gloss");
  assert.equal(extraction.items?.[0]?.variantName, "Berry Red");
  assert.equal(extraction.items?.[0]?.expectedQty, "10,000");
  assert.equal(confidence["items[0].productName"], 0.9);
});

test("parseModelOutput: { extraction: { ... }, confidence: { ... } } 래핑 형태도 정상 파싱한다", () => {
  const raw = JSON.stringify({
    extraction: {
      buyer: { brandName: "Aura Botanica" },
      items: [{ productName: "Face Oil", category: "Oil" }],
    },
    confidence: {
      "buyer.brandName": 0.92,
    },
  });

  const { extraction, confidence } = parseModelOutput(raw);
  assert.equal(extraction.buyer?.brandName, "Aura Botanica");
  assert.equal(extraction.items?.[0]?.productName, "Face Oil");
  assert.equal(confidence["buyer.brandName"], 0.92);
});

test("parseModelOutput: 파싱할 수 없는 문자열이나 깨진 JSON은 빈 객체 {}를 반환한다", () => {
  const invalidInputs = [
    "",
    "   ",
    "This is completely unstructured text without any json brackets",
    "{ broken json: missing closing brace",
    "```json\n[1, 2, 3]\n```", // 배열 최상위는 fallback
  ];

  for (const input of invalidInputs) {
    const { extraction, confidence } = parseModelOutput(input);
    assert.deepEqual(extraction, {});
    assert.deepEqual(confidence, {});
  }
});

// ============================================================================
// 4. extractFromMessageText 연동 검증
// ============================================================================

// CommonJS 모듈 import
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { extractFromMessageText } = require("../functions-ingest/extract.js");
const { setMockHandler } = require("../functions-ingest/model.js");

test("extractFromMessageText: 모델 출력을 올바르게 파싱하여 extraction과 confidence를 반환한다", async () => {
  setMockHandler(async ({ system, user }: { system?: string; user: string }) => {
    // 프롬프트 인젝션 방어 태그가 포함되어 있는지 검증
    assert.match(user, /<message_metadata>/);
    assert.match(user, /<message_body>/);
    assert.ok(system);
    assert.match(system, /없으면 비워라/);

    return {
      text: JSON.stringify({
        buyer: { name: "Frank", brandName: "Frank Beauty" },
        items: [
          {
            productName: "Toner",
            category: "Toner",
            volume: "150ml",
            expectedQty: "4,000 pcs",
          },
        ],
        confidence: {
          "buyer.name": 0.9,
          "items[0].productName": 0.95,
        },
      }),
      usage: { input_tokens: 120, output_tokens: 80 },
    };
  });

  const res = await extractFromMessageText(
    "Hi, we need 4,000 pcs of 150ml Toner. Thanks, Frank from Frank Beauty.",
    "Inquiry for Toner",
    "frank@frankbeauty.com",
  );

  assert.equal(res.extraction.buyer?.name, "Frank");
  assert.equal(res.extraction.buyer?.brandName, "Frank Beauty");
  assert.equal(res.extraction.items?.[0]?.productName, "Toner");
  assert.equal(res.confidence["buyer.name"], 0.9);
  assert.equal(res.confidence["items[0].productName"], 0.95);

  // 핸들러 초기화
  setMockHandler(null);
});

