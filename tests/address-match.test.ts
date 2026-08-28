import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractCounterpartyAddress,
  resolveAddressMatchSide,
} from "../src/lib/schemas/thread.ts";

// --- extractCounterpartyAddress ---

test("인바운드는 마지막 메시지의 from을 상대 주소로 쓴다", () => {
  const messages = [
    { direction: "in" as const, from: "Candy@Example.com", to: ["thomas@medidakoslabs.com"] },
  ];
  assert.equal(extractCounterpartyAddress(messages, "thomas@medidakoslabs.com"), "candy@example.com");
});

test("아웃바운드는 우리 주소를 제외한 to[]를 상대 주소로 쓴다", () => {
  const messages = [
    { direction: "out" as const, from: "thomas@medidakoslabs.com", to: ["thomas@medidakoslabs.com", "candy@example.com"] },
  ];
  assert.equal(extractCounterpartyAddress(messages, "thomas@medidakoslabs.com"), "candy@example.com");
});

test("아웃바운드인데 우리 주소뿐이면 상대 주소가 없다", () => {
  const messages = [
    { direction: "out" as const, from: "thomas@medidakoslabs.com", to: ["thomas@medidakoslabs.com"] },
  ];
  assert.equal(extractCounterpartyAddress(messages, "thomas@medidakoslabs.com"), null);
});

test("메시지가 여럿이면 마지막(가장 최근) 메시지 기준이다", () => {
  const messages = [
    { direction: "in" as const, from: "old@example.com", to: ["thomas@medidakoslabs.com"] },
    { direction: "in" as const, from: "new@example.com", to: ["thomas@medidakoslabs.com"] },
  ];
  assert.equal(extractCounterpartyAddress(messages, "thomas@medidakoslabs.com"), "new@example.com");
});

test("메시지가 없으면 null이다", () => {
  assert.equal(extractCounterpartyAddress([], "thomas@medidakoslabs.com"), null);
});

// --- resolveAddressMatchSide ---

test("side=unknown이고 바이어만 매칭되면 brand/address_match로 올린다", () => {
  const result = resolveAddressMatchSide(
    { side: "unknown", sideSource: "account_rule" },
    { buyer: true, supplier: false },
  );
  assert.deepEqual(result, { side: "brand", sideSource: "address_match" });
});

test("side=unknown이고 제조사만 매칭되면 factory/address_match로 올린다", () => {
  const result = resolveAddressMatchSide(
    { side: "unknown", sideSource: "account_rule" },
    { buyer: false, supplier: true },
  );
  assert.deepEqual(result, { side: "factory", sideSource: "address_match" });
});

test("side=unknown이고 양쪽 다 매칭되면 unknown을 유지한다", () => {
  const result = resolveAddressMatchSide(
    { side: "unknown", sideSource: "account_rule" },
    { buyer: true, supplier: true },
  );
  assert.deepEqual(result, { side: "unknown", sideSource: "account_rule" });
});

test("side=unknown이고 어느 쪽도 매칭되지 않으면 unknown을 유지한다", () => {
  const result = resolveAddressMatchSide(
    { side: "unknown", sideSource: "account_rule" },
    { buyer: false, supplier: false },
  );
  assert.deepEqual(result, { side: "unknown", sideSource: "account_rule" });
});

test("side=brand인데 제조사에서만 매칭되면(모순 증거) factory로 고친다", () => {
  const result = resolveAddressMatchSide(
    { side: "brand", sideSource: "account_rule" },
    { buyer: false, supplier: true },
  );
  assert.deepEqual(result, { side: "factory", sideSource: "address_match" });
});

test("side=factory인데 바이어에서만 매칭되면(모순 증거) brand로 고친다", () => {
  const result = resolveAddressMatchSide(
    { side: "factory", sideSource: "account_rule" },
    { buyer: true, supplier: false },
  );
  assert.deepEqual(result, { side: "brand", sideSource: "address_match" });
});

test("side=brand이고 바이어가 확인되면(같은 쪽) 그대로 둔다", () => {
  const result = resolveAddressMatchSide(
    { side: "brand", sideSource: "account_rule" },
    { buyer: true, supplier: false },
  );
  assert.deepEqual(result, { side: "brand", sideSource: "account_rule" });
});

test("side=brand인데 아무 데도 매칭되지 않으면 계정 기본값을 지우지 않는다", () => {
  const result = resolveAddressMatchSide(
    { side: "brand", sideSource: "account_rule" },
    { buyer: false, supplier: false },
  );
  assert.deepEqual(result, { side: "brand", sideSource: "account_rule" });
});

test("sideSource='manual'은 절대 자동으로 덮지 않는다 — 모순 증거가 있어도", () => {
  const result = resolveAddressMatchSide(
    { side: "brand", sideSource: "manual" },
    { buyer: false, supplier: true },
  );
  assert.deepEqual(result, { side: "brand", sideSource: "manual" });
});
