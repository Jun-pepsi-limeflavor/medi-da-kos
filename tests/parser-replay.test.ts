import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseModelOutput,
  extractionSchema,
  type Extraction,
} from "../src/lib/schemas/extraction.ts";
import { compareMessageFields } from "../scripts/eval.mjs";

// ============================================================================
// 사내 3대 케이스 리플레이 데이터 (Inbound Email Mock & Saved Model Responses)
// 라이브 LLM(Bedrock)을 부르지 않고, 고정된 모델 응답을 기반으로 회귀 검증한다.
// ============================================================================

/**
 * Case 1: Division Twenty (미국)
 * 특징:
 * - 처방 상세 내역(전성분, 점도, 유효 성분 함량 등)이 본문에 없고 첨부 파일에만 존재함.
 * - 본문에는 제품명(GHK-Cu Peptide Serum), 용량(30ml), 수량(5,000 units), 배송지(Los Angeles)만 언급됨.
 * 핵심 회귀 검증:
 * - 모델이 본문에 없는 처방/성분을 임의로 지어내지 않고(No Hallucination), formula 객체가 비어있거나
 *   keyIngredients가 누락/빈 값으로 안전하게 파싱되어야 함.
 */
export const DIVISION_TWENTY_MOCK = {
  email: {
    from: "Alex Turner <alex@divisiontwenty.com>",
    subject: "Inquiry: GHK-Cu 1% Serum 30ml Bulk/OEM",
    bodyText: `
Hi Medidakos team,

This is Alex Turner from Division Twenty.
We are looking to develop our GHK-Cu Peptide Serum in 30ml volume with a target order quantity of 5,000 units.
Our exact formula breakdown, target viscosity, and active concentrations are listed in the attached spreadsheet (GHK-Cu_Serum_Spec_v2.xlsx).
Please review our requirements and confirm your MOQ and target quotation for shipping to Los Angeles, USA.

Best regards,
Alex Turner
Division Twenty
    `.trim(),
    attachments: [
      {
        filename: "GHK-Cu_Serum_Spec_v2.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 45210,
      },
    ],
  },
  savedModelOutput: JSON.stringify({
    buyer: {
      name: "Alex Turner",
      email: "alex@divisiontwenty.com",
      brandName: "Division Twenty",
      country: "USA",
    },
    items: [
      {
        productName: "GHK-Cu Peptide Serum",
        category: "Serum",
        volume: "30ml",
        expectedQty: "5,000 units",
        formula: {
          formulaType: "OEM",
          // keyIngredients는 첨부에만 있고 본문엔 없으므로 비워둠 (지어내지 않음)
        },
      },
    ],
    shipping: {
      country: "USA",
      city: "Los Angeles",
    },
    confidence: {
      "buyer.name": 0.95,
      "buyer.brandName": 0.95,
      "items[0].productName": 0.95,
      "items[0].volume": 0.9,
      "items[0].expectedQty": 0.9,
      "shipping.country": 0.95,
    },
  }, null, 2),
  acceptedGroundTruth: {
    buyer: {
      name: "Alex Turner",
      email: "alex@divisiontwenty.com",
      brandName: "Division Twenty",
      country: "USA",
    },
    items: [
      {
        productName: "GHK-Cu Peptide Serum",
        category: "Serum",
        volume: "30ml",
        expectedQty: "5,000 units",
        formula: {
          formulaType: "OEM",
        },
      },
    ],
    shipping: {
      country: "USA",
      city: "Los Angeles",
    },
  },
};

/**
 * Case 2: Charity (Charity Fragrance Co. / Candy Kobia, 영국)
 * 특징:
 * - 1통의 메일 안에 남성용/여성용 2종 향수(Oud & Bergamot vs Rose & Vanilla)가 혼합 문의됨.
 * 핵심 회귀 검증:
 * - 두 제품을 하나의 제품으로 뭉개지 않고, items[] 배열 내 2개의 독립 항목으로 분리 파싱되어야 함.
 * - 마크다운 코드 블록(```json ... ```)으로 래핑된 모델 응답도 정상 디코딩되어야 함.
 */
export const CHARITY_MOCK = {
  email: {
    from: "Candy Kobia <candy@example.com>",
    subject: "New Brand Launch: Custom EDP Perfumes",
    bodyText: `
Hello Thomas,

We are Charity Fragrance Co. based in London, UK. We are launching a premium fragrance line and require manufacturing quotes for 2 distinct Eau de Parfum products:

1) Oud & Bergamot EDP (Men's variant): 50ml heavy-base glass bottle, initial production 3,000 pcs. Key notes: Oud Accord, Bergamot, Cedarwood.
2) Rose & Vanilla EDP (Women's variant): 50ml heavy-base glass bottle, initial production 2,000 pcs. Key notes: Damask Rose, Bourbon Vanilla, White Musk.

We need samples by September 2026 and target product launch in November 2026.
Delivery destination is London, UK.

Regards,
Candy Kobia
Charity Fragrance Co.
    `.trim(),
  },
  savedModelOutput: `\`\`\`json
{
  "buyer": {
    "name": "Candy Kobia",
    "email": "candy@example.com",
    "brandName": "Charity Fragrance Co.",
    "country": "UK"
  },
  "items": [
    {
      "productName": "Oud & Bergamot EDP",
      "variantName": "Men",
      "category": "Perfume",
      "volume": "50ml",
      "expectedQty": "3,000 pcs",
      "formula": {
        "keyIngredients": "Oud Accord, Bergamot, Cedarwood"
      },
      "packaging": {
        "containerType": "heavy-base glass bottle"
      }
    },
    {
      "productName": "Rose & Vanilla EDP",
      "variantName": "Women",
      "category": "Perfume",
      "volume": "50ml",
      "expectedQty": "2,000 pcs",
      "formula": {
        "keyIngredients": "Damask Rose, Bourbon Vanilla, White Musk"
      },
      "packaging": {
        "containerType": "heavy-base glass bottle"
      }
    }
  ],
  "timeline": {
    "sampleTargetDate": "September 2026",
    "targetLaunchDate": "November 2026"
  },
  "shipping": {
    "country": "UK",
    "city": "London"
  },
  "confidence": {
    "buyer.name": 0.95,
    "buyer.brandName": 0.95,
    "items[0].productName": 0.95,
    "items[0].variantName": 0.9,
    "items[1].productName": 0.95,
    "items[1].variantName": 0.9,
    "timeline.targetLaunchDate": 0.9
  }
}
\`\`\``,
  acceptedGroundTruth: {
    buyer: {
      name: "Candy Kobia",
      email: "candy@example.com",
      brandName: "Charity Fragrance Co.",
      country: "UK",
    },
    items: [
      {
        productName: "Oud & Bergamot EDP",
        variantName: "Men",
        category: "Perfume",
        volume: "50ml",
        expectedQty: "3,000 pcs",
        formula: { keyIngredients: "Oud Accord, Bergamot, Cedarwood" },
      },
      {
        productName: "Rose & Vanilla EDP",
        variantName: "Women",
        category: "Perfume",
        volume: "50ml",
        expectedQty: "2,000 pcs",
        formula: { keyIngredients: "Damask Rose, Bourbon Vanilla, White Musk" },
      },
    ],
    timeline: { targetLaunchDate: "November 2026" },
    shipping: { country: "UK", city: "London" },
  },
};

/**
 * Case 3: Nowel (Lumina Skincare, 싱가포르)
 * 특징:
 * - 단일 제품(Daily Sun Essence)에 대해 복수의 용량 및 MOQ 조건(50ml 5,000개 vs 100ml 3,000개)을 제시.
 * 핵심 회귀 검증:
 * - 하나의 조건만 임의 선택하거나 수치를 섞지 않고, items[]에 두 조건을 다제품/다옵션 구조로 온전히 보존.
 * - 모델이 앞뒤 설명 문구를 붙여 반환하는 경우에도 JSON 슬라이서가 정상 작동해야 함.
 */
export const NOWEL_MOCK = {
  email: {
    from: "Nowel <nowel@luminaskincare.com>",
    subject: "RFQ: Daily Sun Essence SPF 50+ (Dual Option Inquiry)",
    bodyText: `
Dear Medidakos Partners,

This is Nowel from Lumina Skincare.
We are requesting quotations for our upcoming Daily Sun Essence (SPF 50+ PA++++, Centella Asiatica base).
Because we are currently deciding on our bottle sizing strategy, please provide pricing for two separate options:
- Option 1: 50ml bottle with 5,000 pcs MOQ
- Option 2: 100ml bottle with 3,000 pcs MOQ

Target launch date: 2026-10-01.
Please send quotation terms to our office in Singapore.

Warm regards,
Nowel
    `.trim(),
  },
  savedModelOutput: `
Here is the extracted information from the inquiry email:
{
  "buyer": {
    "name": "Nowel",
    "email": "nowel@luminaskincare.com",
    "brandName": "Lumina Skincare"
  },
  "items": [
    {
      "productName": "Daily Sun Essence",
      "variantName": "Option 1 (50ml)",
      "category": "Sunscreen",
      "volume": "50ml",
      "expectedQty": "5,000 pcs",
      "formula": {
        "keyIngredients": "Centella Asiatica"
      }
    },
    {
      "productName": "Daily Sun Essence",
      "variantName": "Option 2 (100ml)",
      "category": "Sunscreen",
      "volume": "100ml",
      "expectedQty": "3,000 pcs",
      "formula": {
        "keyIngredients": "Centella Asiatica"
      }
    }
  ],
  "timeline": {
    "targetLaunchDate": "2026-10-01"
  },
  "shipping": {
    "country": "Singapore"
  },
  "confidence": {
    "buyer.name": 0.95,
    "buyer.brandName": 0.9,
    "items[0].productName": 0.95,
    "items[0].volume": 0.95,
    "items[1].productName": 0.95,
    "items[1].volume": 0.95,
    "items[0].expectedQty": 0.9,
    "items[1].expectedQty": 0.9
  }
}
Please review and confirm.
  `.trim(),
  acceptedGroundTruth: {
    buyer: {
      name: "Nowel",
      email: "nowel@luminaskincare.com",
      brandName: "Lumina Skincare",
    },
    items: [
      {
        productName: "Daily Sun Essence",
        variantName: "Option 1 (50ml)",
        category: "Sunscreen",
        volume: "50ml",
        expectedQty: "5,000 pcs",
        formula: { keyIngredients: "Centella Asiatica" },
      },
      {
        productName: "Daily Sun Essence",
        variantName: "Option 2 (100ml)",
        category: "Sunscreen",
        volume: "100ml",
        expectedQty: "3,000 pcs",
        formula: { keyIngredients: "Centella Asiatica" },
      },
    ],
    timeline: { targetLaunchDate: "2026-10-01" },
    shipping: { country: "Singapore" },
  },
};

// ============================================================================
// 테스트 스위트
// ============================================================================

describe("사내 3대 케이스 리플레이 회귀 테스트 (tests/parser-replay.test.ts)", () => {
  // --------------------------------------------------------------------------
  // Case 1: Division Twenty
  // --------------------------------------------------------------------------
  test("Case 1 (Division Twenty): 본문에 처방이 없고 첨부에 있는 경우 -> formula 빈 값 정상 처리 검증 (지어내지 않음)", () => {
    const { extraction, confidence } = parseModelOutput(DIVISION_TWENTY_MOCK.savedModelOutput);

    // 1. Zod 스키마 safeParse 검증 통과 확인
    const parseResult = extractionSchema.safeParse(extraction);
    assert.equal(parseResult.success, true, "extractionSchema 검증에 통과해야 한다");

    // 2. 바이어 기본 정보 매핑 확인
    assert.equal(extraction.buyer?.name, "Alex Turner");
    assert.equal(extraction.buyer?.email, "alex@divisiontwenty.com");
    assert.equal(extraction.buyer?.brandName, "Division Twenty");
    assert.equal(extraction.buyer?.country, "USA");

    // 3. 단일 제품 정보 정상 추출 확인
    assert.equal(extraction.items?.length, 1);
    const item = extraction.items?.[0];
    assert.equal(item?.productName, "GHK-Cu Peptide Serum");
    assert.equal(item?.category, "Serum");
    assert.equal(item?.volume, "30ml");
    assert.equal(item?.expectedQty, "5,000 units");

    // 4. 핵심 회귀 조건: 본문에 없는 처방 성분을 환각(Hallucination)으로 지어내지 않았는지 검증
    // 첨부 파일에만 있으므로 keyIngredients는 정의되지 않았거나 빈 값이어야 함
    assert.equal(
      item?.formula?.keyIngredients,
      undefined,
      "첨부에만 있는 처방 성분을 모델이 지어내면 안 된다 (keyIngredients는 undefined여야 함)"
    );
    assert.equal(
      item?.formula?.excludedIngredients,
      undefined,
      "제외 성분도 본문에 없으므로 undefined여야 함"
    );

    // 5. 배송 정보 확인
    assert.equal(extraction.shipping?.country, "USA");
    assert.equal(extraction.shipping?.city, "Los Angeles");

    // 6. 확신도 매핑 확인
    assert.equal(confidence["buyer.brandName"], 0.95);
    assert.equal(confidence["items[0].productName"], 0.95);

    // 7. eval 정답 대조: 정답과 100% 일치해야 함
    const comparison = compareMessageFields(extraction, DIVISION_TWENTY_MOCK.acceptedGroundTruth);
    for (const [field, outcomes] of Object.entries(comparison)) {
      for (const outcome of outcomes) {
        assert.equal(outcome, "match", `필드 ${field}는 정답과 일치해야 함`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Case 2: Charity
  // --------------------------------------------------------------------------
  test("Case 2 (Charity): 2종 혼합 문의 -> items[] 2개로 분리 정상 파싱 검증", () => {
    const { extraction, confidence } = parseModelOutput(CHARITY_MOCK.savedModelOutput);

    // 1. Zod 스키마 검증 통과 확인
    const parseResult = extractionSchema.safeParse(extraction);
    assert.equal(parseResult.success, true, "extractionSchema 검증에 통과해야 한다");

    // 2. 바이어 기본 정보 확인
    assert.equal(extraction.buyer?.name, "Candy Kobia");
    assert.equal(extraction.buyer?.brandName, "Charity Fragrance Co.");
    assert.equal(extraction.buyer?.country, "UK");

    // 3. 핵심 회귀 조건: 2종 제품이 items[] 2개로 분리되었는지 검증 (단일 제품으로 뭉개지 않음)
    assert.equal(extraction.items?.length, 2, "2종 향수 문의는 items 배열 길이가 정확히 2여야 한다");

    const [menItem, womenItem] = extraction.items!;

    // 첫 번째 아이템 (남성용)
    assert.equal(menItem.productName, "Oud & Bergamot EDP");
    assert.equal(menItem.variantName, "Men");
    assert.equal(menItem.category, "Perfume");
    assert.equal(menItem.volume, "50ml");
    assert.equal(menItem.expectedQty, "3,000 pcs");
    assert.equal(menItem.formula?.keyIngredients, "Oud Accord, Bergamot, Cedarwood");
    assert.equal(menItem.packaging?.containerType, "heavy-base glass bottle");

    // 두 번째 아이템 (여성용)
    assert.equal(womenItem.productName, "Rose & Vanilla EDP");
    assert.equal(womenItem.variantName, "Women");
    assert.equal(womenItem.category, "Perfume");
    assert.equal(womenItem.volume, "50ml");
    assert.equal(womenItem.expectedQty, "2,000 pcs");
    assert.equal(womenItem.formula?.keyIngredients, "Damask Rose, Bourbon Vanilla, White Musk");
    assert.equal(womenItem.packaging?.containerType, "heavy-base glass bottle");

    // 4. 일정 및 배송 정보
    assert.equal(extraction.timeline?.targetLaunchDate, "November 2026");
    assert.equal(extraction.shipping?.city, "London");

    // 5. eval 정답 대조
    const comparison = compareMessageFields(extraction, CHARITY_MOCK.acceptedGroundTruth);
    for (const [field, outcomes] of Object.entries(comparison)) {
      for (const outcome of outcomes) {
        assert.equal(outcome, "match", `필드 ${field}는 정답과 일치해야 함`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // Case 3: Nowel
  // --------------------------------------------------------------------------
  test("Case 3 (Nowel): 복수 수량/용량 조건 -> items[] 다제품 구조 정상 보존 검증", () => {
    const { extraction, confidence } = parseModelOutput(NOWEL_MOCK.savedModelOutput);

    // 1. Zod 스키마 검증 통과 확인
    const parseResult = extractionSchema.safeParse(extraction);
    assert.equal(parseResult.success, true, "extractionSchema 검증에 통과해야 한다");

    // 2. 바이어 기본 정보 확인
    assert.equal(extraction.buyer?.name, "Nowel");
    assert.equal(extraction.buyer?.brandName, "Lumina Skincare");

    // 3. 핵심 회귀 조건: 50ml/5,000개와 100ml/3,000개 두 조건이 items[]에 모두 보존되었는지 검증
    assert.equal(extraction.items?.length, 2, "이중 조건 문의는 items 배열에 2개 옵션이 모두 보존되어야 한다");

    const [option1, option2] = extraction.items!;

    // Option 1 검증
    assert.equal(option1.productName, "Daily Sun Essence");
    assert.equal(option1.variantName, "Option 1 (50ml)");
    assert.equal(option1.category, "Sunscreen");
    assert.equal(option1.volume, "50ml");
    assert.equal(option1.expectedQty, "5,000 pcs");
    assert.equal(option1.formula?.keyIngredients, "Centella Asiatica");

    // Option 2 검증
    assert.equal(option2.productName, "Daily Sun Essence");
    assert.equal(option2.variantName, "Option 2 (100ml)");
    assert.equal(option2.category, "Sunscreen");
    assert.equal(option2.volume, "100ml");
    assert.equal(option2.expectedQty, "3,000 pcs");
    assert.equal(option2.formula?.keyIngredients, "Centella Asiatica");

    // 4. 일정 및 배송 정보
    assert.equal(extraction.timeline?.targetLaunchDate, "2026-10-01");
    assert.equal(extraction.shipping?.country, "Singapore");

    // 5. eval 정답 대조
    const comparison = compareMessageFields(extraction, NOWEL_MOCK.acceptedGroundTruth);
    for (const [field, outcomes] of Object.entries(comparison)) {
      for (const outcome of outcomes) {
        assert.equal(outcome, "match", `필드 ${field}는 정답과 일치해야 함`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 공통 매핑/검증 견고성 회귀 테스트
  // --------------------------------------------------------------------------
  test("parseModelOutput 견고성: 마크다운 펜스 제거 및 설명 텍스트 분리 기능 검증", () => {
    // 마크다운 펜스가 포함된 Case 2 응답 검증
    const out2 = parseModelOutput(CHARITY_MOCK.savedModelOutput);
    assert.ok(out2.extraction.buyer);
    assert.equal(out2.extraction.items?.length, 2);

    // 앞뒤 설명 문구가 붙은 Case 3 응답 검증
    const out3 = parseModelOutput(NOWEL_MOCK.savedModelOutput);
    assert.ok(out3.extraction.buyer);
    assert.equal(out3.extraction.items?.length, 2);

    // 완전히 잘못된 JSON 텍스트 입력 시 빈 객체 폴백
    const broken = parseModelOutput("This is not a JSON output at all.");
    assert.deepEqual(broken.extraction, {});
    assert.deepEqual(broken.confidence, {});
  });
});
