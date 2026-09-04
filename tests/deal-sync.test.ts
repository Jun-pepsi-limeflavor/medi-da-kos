import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import type { Extraction } from "../src/lib/schemas/extraction.ts";
import { extractionSchema } from "../src/lib/schemas/extraction.ts";
import type { Deal, DealItem, SupplierEngagement, SampleRound, DealTask } from "../src/lib/schemas/deal.ts";

register("./esm-alias-loader.mjs", import.meta.url);
const { assembleDealBoard } = await import("../src/lib/repo/deals.ts");

describe("딜 자동 동기화 데이터 매핑 및 스키마 검증 테스트", () => {
  test("보드 로더가 딜별로 제품·공급자 관계·샘플·태스크를 묶고 고아 문서를 제외함", () => {
    const deal = { id: "deal-1" } as unknown as Deal;
    const result = assembleDealBoard([deal], {
      items: [{ dealId: "deal-1", value: { id: "item-1" } as unknown as DealItem }],
      supplierEngagements: [{ dealId: "deal-1", value: { id: "eng-1" } as unknown as SupplierEngagement }],
      sampleRounds: [{ dealId: "deal-1", value: { id: "sample-1" } as unknown as SampleRound }],
      tasks: [
        { dealId: "deal-1", value: { id: "task-1" } as unknown as DealTask },
        { dealId: "missing", value: { id: "orphan-task" } as unknown as DealTask },
      ],
    });

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].items.map((item) => item.id), ["item-1"]);
    assert.deepEqual(result[0].supplierEngagements.map((item) => item.id), ["eng-1"]);
    assert.deepEqual(result[0].sampleRounds.map((item) => item.id), ["sample-1"]);
    assert.deepEqual(result[0].tasks.map((item) => item.id), ["task-1"]);
    assert.equal("shipments" in result[0], false);
    assert.equal("events" in result[0], false);
  });
  test("Extraction 데이터가 딜 규격에 맞게 정상 파싱됨", () => {
    const rawExtraction: Extraction = {
      buyer: {
        name: "Jade Davis",
        email: "jade@aussiebeauty.com.au",
        brandName: "Aussie Beauty Group",
        country: "호주 (Australia)",
      },
      items: [
        {
          productName: "Niacinamide Glow Serum 50ml",
          category: "Serum",
          volume: "50ml",
          expectedQty: 5000,
          targetTexture: "Lightweight watery gel",
          keyIngredients: "Niacinamide 10%, Zinc 1%",
          packagingType: "Glass dropper bottle",
        },
        {
          productName: "Ceramide Barrier Cream 100ml",
          category: "Cream",
          volume: "100ml",
          expectedQty: 3000,
          targetTexture: "Rich hydrating cream",
          keyIngredients: "5 Ceramide complex",
          packagingType: "Airless pump tube",
        },
      ],
      shipping: {
        country: "호주 (Australia)",
        city: "Sydney",
      },
      timeline: {
        sampleTargetDate: "2026-09-15",
        targetLaunchDate: "2026-11-30",
        notes: "Targeting holiday season launch",
      },
      certifications: {
        requiredCerts: ["CPNP", "TGA", "Vegan"],
      },
      additionalRequests: "Eco-friendly outer box packaging requested.",
    };

    const parsed = extractionSchema.safeParse(rawExtraction);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;

    // 1. 바이어 정보 검증
    assert.equal(parsed.data.buyer?.brandName, "Aussie Beauty Group");
    assert.equal(parsed.data.buyer?.name, "Jade Davis");
    assert.equal(parsed.data.buyer?.email, "jade@aussiebeauty.com.au");

    // 2. 다품목(Items) 개별 품목 분리 및 수량 검증
    assert.equal(parsed.data.items?.length, 2);
    assert.equal(parsed.data.items?.[0].expectedQty, "5000");
    assert.equal(parsed.data.items?.[0].volume, "50ml");
    assert.equal(parsed.data.items?.[1].expectedQty, "3000");
    assert.equal(parsed.data.items?.[1].volume, "100ml");

    // 3. 인증 및 일정 검증
    assert.deepEqual(parsed.data.certifications?.requiredCerts, ["CPNP", "TGA", "Vegan"]);
    assert.equal(parsed.data.timeline?.sampleTargetDate, "2026-09-15");
    assert.equal(parsed.data.timeline?.targetLaunchDate, "2026-11-30");
  });

  test("인증 목록 배열 병합(Union) 로직 검증", () => {
    const currentCerts = ["FDA", "CPNP"];
    const extractedCerts = ["CPNP", "Vegan", "Halal"];

    const merged = Array.from(new Set([...currentCerts, ...extractedCerts]));
    assert.deepEqual(merged, ["FDA", "CPNP", "Vegan", "Halal"]);
  });
});
