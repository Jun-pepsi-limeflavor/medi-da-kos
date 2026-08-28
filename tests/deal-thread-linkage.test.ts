import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { threadLinkInputSchema, threadSchema } from "../src/lib/schemas/thread.ts";

describe("딜-스레드 연동 및 스키마 검증 테스트", () => {
  const baseThread = {
    channel: "gmail_thomas" as const,
    sourceAccount: "thomas@medidakoslabs.com",
    providerThreadId: "th-12345",
    readState: "read" as const,
    triageState: "open" as const,
    linkState: "unlinked" as const,
    side: "brand" as const,
    sideSource: "manual" as const,
    sideHistory: [],
    lastMessageAt: "2026-08-28T00:00:00.000Z",
    lastDirection: "in" as const,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };

  test("threadLinkInputSchema: dealId 단독 연결을 허용한다", () => {
    const input = { dealId: "deal_xyz789" };
    const parsed = threadLinkInputSchema.parse(input);
    assert.equal(parsed.dealId, "deal_xyz789");
    assert.equal(parsed.buyerId, undefined);
    assert.equal(parsed.supplierId, undefined);
  });

  test("threadLinkInputSchema: dealId 해제(null)를 허용한다", () => {
    const input = { dealId: null };
    const parsed = threadLinkInputSchema.parse(input);
    assert.equal(parsed.dealId, null);
  });

  test("threadLinkInputSchema: buyerId와 dealId를 동시에 지정할 수 있다", () => {
    const input = { buyerId: "buyer_123", dealId: "deal_456" };
    const parsed = threadLinkInputSchema.parse(input);
    assert.equal(parsed.buyerId, "buyer_123");
    assert.equal(parsed.dealId, "deal_456");
  });

  test("threadLinkInputSchema: supplierId와 dealId를 동시에 지정할 수 있다", () => {
    const input = { supplierId: "supplier_789", dealId: "deal_456" };
    const parsed = threadLinkInputSchema.parse(input);
    assert.equal(parsed.supplierId, "supplier_789");
    assert.equal(parsed.dealId, "deal_456");
  });

  test("threadLinkInputSchema: buyerId와 supplierId는 동시에 지정할 수 없다", () => {
    const input = { buyerId: "buyer_123", supplierId: "supplier_789" };
    assert.throws(() => threadLinkInputSchema.parse(input), {
      message: /buyerId와 supplierId는 동시에 지정할 수 없습니다/,
    });
  });

  test("threadLinkInputSchema: 모든 필드가 비어있으면 거부한다", () => {
    assert.throws(() => threadLinkInputSchema.parse({}), {
      message: /연결할 대상/,
    });
  });

  test("threadSchema: dealId가 포함된 스레드 문서를 정상 파싱한다", () => {
    const threadWithDeal = {
      ...baseThread,
      dealId: "deal-bala-spf15",
      linkState: "linked" as const,
      linkedBy: "thomas@medidakoslabs.com",
      linkedAt: "2026-08-28T01:00:00.000Z",
    };
    const parsed = threadSchema.parse(threadWithDeal);
    assert.equal(parsed.dealId, "deal-bala-spf15");
    assert.equal(parsed.linkState, "linked");
    assert.equal(parsed.linkedBy, "thomas@medidakoslabs.com");
  });
});
