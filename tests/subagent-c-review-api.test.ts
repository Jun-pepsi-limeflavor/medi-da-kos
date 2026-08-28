import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);
const { extractionSchema } = await import("../src/lib/schemas/extraction.ts");
const { fallbackExtract, runMessageExtraction } = await import("../src/lib/extractor.ts");

describe("Subagent C (검토 화면 UI 및 확정 API) 단위 검증", () => {
  test("fallbackExtract: 메일 발신자, 제목, 본문에서 바이어 및 제품 정보 안전 추출", () => {
    const from = "Sarah Connor <sarah@cyberdynebeauty.com>";
    const subject = "RFQ: Niacinamide Calming Cream 50ml";
    const body = `
Hi Medidakos team,
We are Cyberdyne Beauty in USA.
We need 5,000 pcs of Niacinamide Calming Cream in 50ml container.
Required Certifications: FDA, CPNP, Vegan.
Target sample date: 2026-09-30.
Please confirm lead time.
    `.trim();

    const result = fallbackExtract(body, subject, from);

    // 1. extractionSchema 검증 통과
    const schemaResult = extractionSchema.safeParse(result.extraction);
    assert.equal(schemaResult.success, true);

    // 2. 바이어 정보 추출 검증
    assert.equal(result.extraction.buyer?.name, "Sarah Connor");
    assert.equal(result.extraction.buyer?.email, "sarah@cyberdynebeauty.com");
    assert.equal(result.extraction.buyer?.brandName, "Cyberdyne Beauty");
    assert.equal(result.extraction.buyer?.country, "미국 (USA)");

    // 3. 제품 정보 추출 검증
    assert.equal(result.extraction.items?.length, 1);
    const item = result.extraction.items?.[0];
    assert.equal(item?.category, "Cream");
    assert.equal(item?.volume, "50ml");
    assert.equal(item?.expectedQty, "5,000 pcs");

    // 4. 인증 및 일정
    assert.deepEqual(result.extraction.certifications?.requiredCerts, [
      "CPNP",
      "FDA",
      "Vegan",
    ]);
    assert.equal(result.extraction.timeline?.sampleTargetDate, "2026-09-30");

    // 5. 확신도 맵 검증
    assert.ok(typeof result.confidence["buyer.email"] === "number");
    assert.ok(result.confidence["buyer.email"] >= 0.7);
  });

  test("fallbackExtract: 원가/마진 관련 키워드는 추출되지 않고 철저히 배제됨", () => {
    const from = "test@example.com";
    const subject = "Inquiry with pricing";
    const body = `
Unit cost: $3.50, supplier price $2.80, target margin 35%.
Product: Hydrating Toner 150ml, quantity: 3,000 pcs.
    `.trim();

    const result = fallbackExtract(body, subject, from);
    const serialized = JSON.stringify(result.extraction);

    assert.equal(serialized.includes("cost"), false);
    assert.equal(serialized.includes("margin"), false);
    assert.equal(serialized.includes("price"), false);
  });

  test("runMessageExtraction: 모델 호출 실패 시에도 안전하게 fallbackExtract로 추출값 반환", async () => {
    const result = await runMessageExtraction(
      "Looking for 2,000 pcs of Tea Tree Mist 100ml. Thanks, James.",
      "Mist Inquiry",
      "James <james@test.com>",
    );

    assert.ok(result.extraction);
    assert.ok(result.confidence);
    assert.equal(result.extraction.buyer?.name, "James");
    assert.equal(result.extraction.buyer?.email, "james@test.com");
    assert.equal(result.extraction.items?.[0]?.category, "Mist");
  });

  test("accept 검증: extractionSchema 규격에 맞지 않는 잘못된 데이터는 거부", () => {
    const invalidData = {
      buyer: {
        name: 12345, // string이어야 함
      },
    };

    const parsed = extractionSchema.safeParse(invalidData);
    assert.equal(parsed.success, false);
  });

  test("accept 검증: 정상적인 Extraction 객체는 safeParse 성공", () => {
    const validData = {
      buyer: {
        name: "Alice",
        email: "alice@example.com",
        brandName: "Alice Skin",
        country: "France",
      },
      items: [
        {
          productName: "Alice Sun Cream",
          category: "Cream",
          volume: "50ml",
          expectedQty: "10,000 pcs",
        },
      ],
      certifications: {
        requiredCerts: ["CPNP"],
      },
    };

    const parsed = extractionSchema.safeParse(validData);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.buyer?.name, "Alice");
    assert.equal(parsed.data.items?.[0]?.productName, "Alice Sun Cream");
  });

  test("runMessageExtraction: MOCK_MODEL_OUTPUT 환경에서 모델 출력 파싱", async () => {
    process.env.MOCK_MODEL_OUTPUT = JSON.stringify({
      buyer: { name: "Mock Buyer", brandName: "Mock Brand" },
      items: [
        {
          productName: "Mock Cream",
          category: "Cream",
          volume: "50ml",
          expectedQty: "3,000 pcs",
        },
      ],
      confidence: { "buyer.name": 0.95 },
    });

    try {
      const res = await runMessageExtraction(
        "Some text",
        "Subject",
        "sender@test.com",
      );
      assert.equal(res.extraction.buyer?.name, "Mock Buyer");
      assert.equal(res.extraction.items?.[0]?.productName, "Mock Cream");
      assert.equal(res.confidence["buyer.name"], 0.95);
    } finally {
      delete process.env.MOCK_MODEL_OUTPUT;
    }
  });
});

