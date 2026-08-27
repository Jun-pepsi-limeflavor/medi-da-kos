import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import type { CMBrief } from "../src/lib/types.ts";

try {
  register("./esm-alias-loader.mjs", import.meta.url);
} catch {
  // 이미 --loader로 등록된 경우 무시
}

const { normalizeBriefForStorage } = await import("../src/lib/brief-normalization.ts");

function createMockBrief(overrides?: Partial<CMBrief>): CMBrief {
  return {
    uid: "user-123",
    currentStep: 4,
    requestType: "custom",
    step1: { selection: "skincare" },
    step4: {
      volume: "50",
      unit: "ml",
      orderQuantity: "5000",
      orderQuantityTbd: false,
      sampleRequestDate: "2026-09-01",
      targetLaunchDate: "2026-12-01",
    },
    status: "draft",
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

test("수량 TBD이면 숨은 확정 수량과 moq를 저장하지 않는다 (orderQuantity, moq 삭제)", () => {
  const brief = createMockBrief({
    step4: {
      volume: "50",
      unit: "ml",
      orderQuantity: "5000",
      orderQuantityTbd: true,
      moq: "3000",
      sampleRequestDate: "2026-09-01",
      targetLaunchDate: "2026-12-01",
    },
  });

  const normalized = normalizeBriefForStorage(brief);

  assert.equal(normalized.step4?.orderQuantityTbd, true);
  assert.equal(normalized.step4?.orderQuantity, undefined);
  assert.equal(normalized.step4?.moq, undefined);
  assert.equal("orderQuantity" in (normalized.step4 ?? {}), false);
  assert.equal("moq" in (normalized.step4 ?? {}), false);
  assert.equal(normalized.step4?.volume, "50");

  // 원본 brief가 mutate되지 않았는지 확인
  assert.equal(brief.step4?.orderQuantity, "5000");
  assert.equal(brief.step4?.moq, "3000");
});

test("수량이 확정이면 숫자 문자열을 보존한다 (orderQuantity 유지)", () => {
  const brief = createMockBrief({
    step4: {
      volume: "100",
      unit: "g",
      orderQuantity: "10000",
      orderQuantityTbd: false,
      sampleRequestDate: "2026-09-01",
      targetLaunchDate: "2026-12-01",
    },
  });

  const normalized = normalizeBriefForStorage(brief);

  assert.equal(normalized.step4?.orderQuantityTbd, false);
  assert.equal(normalized.step4?.orderQuantity, "10000");
  assert.equal(normalized.step4?.volume, "100");
});

test("orderQuantityTbd가 없거나 false일 때 orderQuantity 보존", () => {
  const brief = createMockBrief({
    step4: {
      volume: "30",
      unit: "ml",
      orderQuantity: "3000",
      sampleRequestDate: "2026-09-01",
      targetLaunchDate: "2026-12-01",
    },
  });

  const normalized = normalizeBriefForStorage(brief);

  assert.equal(normalized.step4?.orderQuantity, "3000");
});

test("step4가 없는 경우 에러 없이 그대로 반환한다", () => {
  const brief = createMockBrief({ step4: undefined });
  const normalized = normalizeBriefForStorage(brief);
  assert.equal(normalized.step4, undefined);
});
