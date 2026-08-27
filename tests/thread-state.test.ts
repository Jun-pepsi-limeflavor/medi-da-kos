import { test } from "node:test";
import assert from "node:assert/strict";
import { messageSchema } from "../src/lib/schemas/message.ts";
import {
  threadSchema,
  threadStatePatchSchema,
  threadLinkInputSchema,
  buildThreadKey,
  needsReply,
  nextAutoSide,
  appendSideCorrection,
} from "../src/lib/schemas/thread.ts";

const baseThread = {
  channel: "gmail_thomas" as const,
  sourceAccount: "thomas@medidakoslabs.com",
  providerThreadId: "18abc",
  readState: "unread" as const,
  triageState: "open" as const,
  linkState: "unlinked" as const,
  side: "unknown" as const,
  sideSource: "account_rule" as const,
  sideHistory: [],
  lastMessageAt: "2026-08-20T00:00:00.000Z",
  lastDirection: "in" as const,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const baseMessage = {
  channel: "gmail_thomas" as const,
  side: "unknown" as const,
  sideSource: "account_rule" as const,
  sourceAccount: "thomas@medidakoslabs.com",
  externalId: "18abc",
  providerThreadId: "18abc",
  threadKey: "gmail_thomas:thomas@medidakoslabs.com:18abc",
  historyId: "12345",
  direction: "in" as const,
  from: "candy@example.com",
  fromName: "Candy Kobia",
  to: ["thomas@medidakoslabs.com"],
  subject: "Perfume sample request",
  bodyText: "hello",
  attachments: [],
  sentAt: "2026-08-20T00:00:00.000Z",
  parseStatus: "pending" as const,
  createdAt: "2026-08-20T00:00:00.000Z",
  sourceUpdatedAt: "2026-08-20T00:00:00.000Z",
};

// --- 메시지 스키마 ---

test("정상 메시지를 통과시킨다 — extraction·confidence·accepted는 아직 없어도 된다", () => {
  const parsed = messageSchema.parse(baseMessage);
  assert.equal(parsed.threadKey, baseMessage.threadKey);
  assert.equal(parsed.extraction, undefined);
});

test("첨부는 filename·mimeType·size·attachmentId를 요구한다", () => {
  assert.doesNotThrow(() =>
    messageSchema.parse({
      ...baseMessage,
      attachments: [{ filename: "spec.xlsx", mimeType: "application/vnd", size: 1024, attachmentId: "att-1" }],
    }));
  assert.throws(() =>
    messageSchema.parse({
      ...baseMessage,
      attachments: [{ filename: "spec.xlsx" }],
    }));
});

// --- 스레드 상태 필드는 서로 독립적으로 검증된다 ---

test("readState·triageState·linkState·side는 각각 정해진 값만 받는다", () => {
  assert.doesNotThrow(() => threadSchema.parse(baseThread));
  assert.throws(() => threadSchema.parse({ ...baseThread, readState: "archived" }));
  assert.throws(() => threadSchema.parse({ ...baseThread, triageState: "unread" }));
  assert.throws(() => threadSchema.parse({ ...baseThread, linkState: "linked-ish" }));
  assert.throws(() => threadSchema.parse({ ...baseThread, side: "brandish" }));
});

test("한 필드가 잘못돼도 다른 필드는 그대로 파싱된다 — 상태들이 서로 독립적이다", () => {
  assert.throws(() => threadSchema.parse({ ...baseThread, side: "nope" }));
  const parsed = threadSchema.parse({ ...baseThread, side: "brand", triageState: "archived" });
  assert.equal(parsed.readState, "unread");
  assert.equal(parsed.linkState, "unlinked");
});

test("side='unknown'이 정상 값이다", () => {
  const parsed = threadSchema.parse({ ...baseThread, side: "unknown" });
  assert.equal(parsed.side, "unknown");
});

test("buyerId·supplierId·linkedBy·linkedAt은 없어도 통과한다 — Task 3이 나중에 채운다", () => {
  const parsed = threadSchema.parse(baseThread);
  assert.equal(parsed.buyerId, undefined);
  assert.equal(parsed.supplierId, undefined);
  assert.equal(parsed.linkedBy, undefined);
  assert.equal(parsed.linkedAt, undefined);
});

test("buyerId·supplierId·linkedBy·linkedAt이 있어도 통과한다", () => {
  const parsed = threadSchema.parse({
    ...baseThread,
    buyerId: "buyer-1",
    linkState: "linked" as const,
    linkedBy: "rheekw@techasset.co.kr",
    linkedAt: "2026-08-21T00:00:00.000Z",
  });
  assert.equal(parsed.buyerId, "buyer-1");
});

// --- needsReply ---

test("lastDirection이 in이면 needsReply가 참이다", () => {
  assert.equal(needsReply({ lastDirection: "in" }), true);
});

test("lastDirection이 out이면 needsReply가 거짓이다", () => {
  assert.equal(needsReply({ lastDirection: "out" }), false);
});

// --- sideSource='manual'은 자동 판정을 덮지 않는다 ---

test("sideSource가 manual이면 자동 판정 결과를 적용하지 않는다", () => {
  const current = { side: "brand" as const, sideSource: "manual" as const };
  const result = nextAutoSide(current, { side: "factory", sideSource: "address_match" });
  assert.deepEqual(result, { side: "brand", sideSource: "manual" });
});

test("sideSource가 manual이 아니면 자동 판정 결과를 적용한다", () => {
  const current = { side: "unknown" as const, sideSource: "account_rule" as const };
  const result = nextAutoSide(current, { side: "factory", sideSource: "address_match" });
  assert.deepEqual(result, { side: "factory", sideSource: "address_match" });
});

// --- correctThreadSide의 순수 파생 로직 ---

test("공백 사유는 거부한다", () => {
  assert.throws(() =>
    appendSideCorrection(
      { side: "unknown", sideHistory: [] },
      { side: "brand", reason: "   ", actor: "rheekw@techasset.co.kr", at: "2026-08-21T00:00:00.000Z" },
    ));
});

test("sideHistory에 from·to·reason·actor·at을 append한다", () => {
  const result = appendSideCorrection(
    { side: "unknown", sideHistory: [] },
    { side: "brand", reason: "본문에서 브랜드사 확인", actor: "rheekw@techasset.co.kr", at: "2026-08-21T00:00:00.000Z" },
  );
  assert.equal(result.side, "brand");
  assert.equal(result.sideSource, "manual");
  assert.deepEqual(result.sideHistory, [{
    from: "unknown",
    to: "brand",
    reason: "본문에서 브랜드사 확인",
    actor: "rheekw@techasset.co.kr",
    at: "2026-08-21T00:00:00.000Z",
  }]);
});

test("기존 sideHistory 뒤에 새 항목을 이어붙인다 — 지우지 않는다", () => {
  const existing = [{
    from: "unknown" as const, to: "factory" as const,
    reason: "이전 정정", actor: "songjh@techasset.co.kr", at: "2026-08-19T00:00:00.000Z",
  }];
  const result = appendSideCorrection(
    { side: "factory", sideHistory: existing },
    { side: "brand", reason: "재정정", actor: "rheekw@techasset.co.kr", at: "2026-08-21T00:00:00.000Z" },
  );
  assert.equal(result.sideHistory.length, 2);
  assert.deepEqual(result.sideHistory[0], existing[0]);
});

// --- threadKey 조합 ---

test("다른 계정의 같은 providerThreadId가 다른 threadKey를 만든다", () => {
  const a = buildThreadKey("gmail_thomas", "thomas@medidakoslabs.com", "18abc");
  const b = buildThreadKey("gmail_hally", "hally@medidakoslabs.com", "18abc");
  assert.notEqual(a, b);
});

test("같은 채널·계정·providerThreadId는 같은 threadKey를 만든다", () => {
  const a = buildThreadKey("gmail_thomas", "thomas@medidakoslabs.com", "18abc");
  const b = buildThreadKey("gmail_thomas", "thomas@medidakoslabs.com", "18abc");
  assert.equal(a, b);
});

// --- 상태 변경 patch 스키마 ---

test("threadStatePatchSchema는 readState·triageState만 받는다", () => {
  assert.doesNotThrow(() => threadStatePatchSchema.parse({ readState: "read" }));
  assert.doesNotThrow(() => threadStatePatchSchema.parse({ triageState: "archived" }));
  assert.throws(() => threadStatePatchSchema.parse({}));
  assert.throws(() => threadStatePatchSchema.parse({ side: "brand" }));
});

// --- 연결 입력 스키마 ---

test("threadLinkInputSchema는 buyerId 또는 supplierId 중 하나만 요구한다", () => {
  assert.doesNotThrow(() => threadLinkInputSchema.parse({ buyerId: "buyer-1" }));
  assert.doesNotThrow(() => threadLinkInputSchema.parse({ supplierId: "supplier-1" }));
  assert.throws(() => threadLinkInputSchema.parse({}));
  assert.throws(() => threadLinkInputSchema.parse({ buyerId: "buyer-1", supplierId: "supplier-1" }));
});
