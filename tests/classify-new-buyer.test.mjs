import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);

const { identityClassificationInputSchema } = await import("../src/lib/repo/conversations.ts");

describe("identityClassificationInputSchema", () => {
  test("신규 바이어 등록 스키마 검증", () => {
    const validInput = {
      classification: "buyer",
      buyerMode: "new",
      buyer: {
        name: "John Doe",
        emails: ["johndoe@example.com"],
        inflowChannel: "gmail_hally",
        brandName: "Acme Beauty",
        country: "미국 (USA)",
        phone: "+1 234 567 890",
      },
      reason: "정상 바이어 문의 확인",
      autoExtractBrief: true,
    };

    const parsed = identityClassificationInputSchema.safeParse(validInput);
    assert.equal(parsed.success, true);
  });

  test("기존 바이어 연결 스키마 검증 (하위 호환)", () => {
    const legacyInput = {
      classification: "buyer",
      buyerId: "buyer-123",
      conversationId: "conv-123",
      reason: "기존 바이어 연결",
    };

    const parsed = identityClassificationInputSchema.safeParse(legacyInput);
    assert.equal(parsed.success, true);
  });

  test("광고/스팸 분류 스키마 검증", () => {
    const spamInput = {
      classification: "advertising",
      reason: "스팸 광고",
    };

    const parsed = identityClassificationInputSchema.safeParse(spamInput);
    assert.equal(parsed.success, true);
  });
});
