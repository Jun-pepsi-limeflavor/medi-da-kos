import { test } from "node:test";
import assert from "node:assert/strict";
import { supplierInputSchema } from "../src/lib/schemas/supplier.ts";

const valid = {
  companyName: "그린코스",
  contacts: [{
    name: "김대리",
    title: "PM",
    email: "sales@greencos.co.kr",
    phone: "02-1234-5678",
    channel: "email" as const,
  }],
  capabilities: ["formulation", "filling"] as const,
  productionModels: ["ODM"] as const,
  supportedCerts: ["ISO 22716", "CGMP"],
};

test("정상 입력을 통과시킨다", () => {
  const parsed = supplierInputSchema.parse(valid);
  assert.equal(parsed.companyName, "그린코스");
  assert.deepEqual(parsed.supportedCerts, ["ISO 22716", "CGMP"]);
});

test("회사명 앞뒤 공백을 다듬는다", () => {
  const parsed = supplierInputSchema.parse({ ...valid, companyName: "  그린코스  " });
  assert.equal(parsed.companyName, "그린코스");
});

test("담당자 이메일을 소문자로 내리고 조회용 contactEmails를 만든다", () => {
  const parsed = supplierInputSchema.parse({
    ...valid,
    contacts: [{ ...valid.contacts[0], email: "Sales@GreenCos.co.KR" }],
  });
  assert.equal(parsed.contacts[0].email, "sales@greencos.co.kr");
  assert.deepEqual(parsed.contactEmails, ["sales@greencos.co.kr"]);
});

test("회사명이 비면 거부한다", () => {
  assert.throws(() => supplierInputSchema.parse({ ...valid, companyName: "   " }));
});

test("역량과 생산 방식은 정해진 값만 받는다", () => {
  assert.throws(() => supplierInputSchema.parse({ ...valid, capabilities: ["anything"] }));
  assert.throws(() => supplierInputSchema.parse({ ...valid, productionModels: ["anything"] }));
});

test("@ 없는 이메일을 거부한다", () => {
  assert.throws(() => supplierInputSchema.parse({
    ...valid,
    contacts: [{ ...valid.contacts[0], email: "sales.greencos.co.kr" }],
  }));
});

test("인증 목록은 생략 가능하고 빈 배열이 된다", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { supportedCerts, ...rest } = valid;
  const parsed = supplierInputSchema.parse(rest);
  assert.deepEqual(parsed.supportedCerts, []);
});

test("모르는 필드는 떨어뜨린다", () => {
  const parsed = supplierInputSchema.parse({
    ...valid,
    unitCost: 1200,
    ownershipExclusivity: "exclusive",
  }) as Record<string, unknown>;
  assert.equal(parsed.unitCost, undefined);
  assert.equal(parsed.ownershipExclusivity, undefined);
});

import { buyerInputSchema } from "../src/lib/schemas/buyer.ts";

const validBuyer = {
  name: "Charity Kobia",
  emails: ["candy@example.com"],
  inflowChannel: "outlook" as const,
  brandName: "TJ perfumes",
  country: "Kenya",
  phone: "",
};

test("바이어 정상 입력을 통과시킨다", () => {
  const parsed = buyerInputSchema.parse(validBuyer);
  assert.deepEqual(parsed.emails, ["candy@example.com"]);
});

test("이메일 배열을 소문자로 내리고 중복을 없앤다", () => {
  const parsed = buyerInputSchema.parse({
    ...validBuyer,
    emails: ["Candy@Example.com", "candy@example.com", "  CANDY@EXAMPLE.COM  "],
  });
  assert.deepEqual(parsed.emails, ["candy@example.com"]);
});

test("이메일이 하나도 없으면 거부한다", () => {
  assert.throws(() => buyerInputSchema.parse({ ...validBuyer, emails: [] }));
});

test("이름이 비면 거부한다", () => {
  assert.throws(() => buyerInputSchema.parse({ ...validBuyer, name: "  " }));
});

test("모르는 유입경로를 거부한다", () => {
  assert.throws(() => buyerInputSchema.parse({ ...validBuyer, inflowChannel: "instagram" }));
});
