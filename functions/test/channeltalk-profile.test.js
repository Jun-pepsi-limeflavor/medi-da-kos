/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildProfileUpdate, briefProduct } = require("../channeltalk/profile");

const FORBIDDEN = ["shippingAddress", "description", "nextAction", "manufacturer", "landlineNumber", "firstName", "lastName", "tags", "lastContactAt", "companyName", "country"];

function assertNoForbidden(update) {
  for (const field of FORBIDDEN) {
    assert.ok(!(field in update.profileOnce), `profileOnce.${field}`);
    assert.ok(!(field in update.profile), `profile.${field}`);
  }
}

const user = {
  uid: "uid-1",
  email: "Jane@Example.com",
  displayName: "Jane Doe",
  phone: "+1 555 010 0000",
  country: "United States",
  companyName: "Acme Beauty",
};

const brief = {
  step1: { selection: "skincare" },
  step2: { selections: [{ group: "Bottle", items: ["Airless pump"] }, { group: "Jar", items: [] }] },
  step4: { volume: "50", unit: "ml", orderQuantity: "5,000", orderQuantityTbd: false },
  step6: { productName: "" },
  shippingAddress: { recipientName: "Jane Doe", addressLine1: "1 Main St", city: "Austin", country: "United States", phone: "+15550100000" },
};

test("회원가입: 처음 한 번만 넣을 값과 firebaseUid", () => {
  const update = buildProfileUpdate({ kind: "users", data: user, uid: "uid-1" });
  assert.deepEqual(update.profileOnce, {
    name: "Jane Doe",
    email: "jane@example.com",
    brandCompanyName: "Acme Beauty",
    mobileNumber: "+15550100000",
    marketCountry: ["미국"],
    firstSource: "signup",
  });
  assert.deepEqual(update.profile, { firebaseUid: "uid-1" });
  assertNoForbidden(update);
});

test("회원가입: 국가번호 없는 전화와 변환할 수 없는 국가는 미반영 사유로 남긴다", () => {
  const update = buildProfileUpdate({ kind: "users", data: { ...user, phone: "5550100000", country: "Global" }, uid: "uid-1" });
  assert.ok(!("mobileNumber" in update.profileOnce));
  assert.ok(!("marketCountry" in update.profileOnce));
  assert.equal(update.result.skipped.mobileNumber, "no_country_code");
  assert.equal(update.result.skipped.marketCountry, "not_specific");
});

test("Contact: 이름 칸이 없고 businessType은 리스트, firstSource=contact", () => {
  const update = buildProfileUpdate({
    kind: "contact",
    data: { companyName: "Acme Beauty", email: "buyer@example.com", businessType: "Existing Beauty Brand", referralSource: "Social Media", message: "hi" },
  });
  assert.deepEqual(update.profileOnce, {
    email: "buyer@example.com",
    brandCompanyName: "Acme Beauty",
    businessType: ["Existing Beauty Brand"],
    referralSource: "Social Media",
    firstSource: "contact",
  });
  assert.deepEqual(update.profile, {});
  assert.equal(update.result.skipped.name, "no_field");
  assertNoForbidden(update);
});

test("Landing korea: 이름이 회사명과 같으면 넣지 않고, 국가 항목이 없고, 물량 코드는 MOQ가 아니다", () => {
  const update = buildProfileUpdate({
    kind: "landingRequests",
    data: {
      landingVariant: "korea", companyName: "Acme Beauty", contactName: "Acme Beauty", email: "buyer@example.com",
      country: "Global", expectedVolume: "5k-10k", businessType: "Agency", referralSource: "Events",
    },
  });
  assert.ok(!("name" in update.profileOnce));
  assert.equal(update.result.skipped.name, "same_as_company");
  assert.equal(update.result.skipped.marketCountry, "no_field");
  assert.equal(update.result.skipped.moq, "not_exact_number");
  assert.deepEqual(update.profileOnce.businessType, ["Agency"]);
  assert.equal(update.profileOnce.referralSource, "Events");
  assert.equal(update.profileOnce.firstSource, "landing-korea");
});

test("Landing catalog: 이름·국가·제품, 정확한 숫자일 때만 MOQ", () => {
  const data = {
    landingVariant: "catalog", companyName: "Acme Beauty", contactName: "Jane Doe", email: "buyer@example.com",
    country: "Germany", expectedVolume: "3,000~5,000",
    catalogItems: [{ id: "s1", name: "Pink Serum", category: "serum" }, { id: "t1", name: "Rose Toner", category: "toner" }],
  };
  const range = buildProfileUpdate({ kind: "landingRequests", data });
  assert.equal(range.profileOnce.name, "Jane Doe");
  assert.deepEqual(range.profileOnce.marketCountry, ["독일"]);
  assert.equal(range.profileOnce.product, "Pink Serum, Rose Toner");
  assert.ok(!("moq" in range.profileOnce));
  assert.equal(range.result.skipped.moq, "not_exact_number");
  assert.equal(range.profileOnce.firstSource, "landing-catalog");

  const exact = buildProfileUpdate({ kind: "landingRequests", data: { ...data, expectedVolume: "5,000" } });
  assert.equal(exact.profileOnce.moq, 5000);
  assertNoForbidden(exact);
});

test("Landing dashboard: 브리프에서 제품을 만든다", () => {
  const update = buildProfileUpdate({
    kind: "landingRequests",
    data: { landingVariant: "dashboard", companyName: "Acme", contactName: "Jane", email: "buyer@example.com", country: "USA", expectedVolume: "TBD", dashboardBrief: brief },
  });
  assert.equal(update.profileOnce.product, "Skin Care · Bottle, Jar");
  assert.equal(update.profileOnce.firstSource, "landing-dashboard");
});

test("Order: 회원 정보 + 제품·MOQ는 처음 한 번만, 주문 관련 값은 자동 갱신, 배송지는 보내지 않음", () => {
  const update = buildProfileUpdate({
    kind: "orders",
    data: { uid: "uid-1", title: "Custom ODM — Skin Care", briefSnapshot: brief, createdAt: "2026-10-01T05:39:21.056Z" },
    uid: "uid-1",
    orderId: "order-1",
    orderCount: 2,
    user,
  });
  assert.equal(update.profileOnce.product, "Skin Care · Bottle, Jar");
  assert.equal(update.profileOnce.moq, 5000);
  assert.equal(update.profileOnce.name, "Jane Doe");
  assert.deepEqual(update.profile, {
    firebaseUid: "uid-1",
    lastOrderId: "order-1",
    orderCount: 2,
    lastCheckoutCompletedAt: Date.parse("2026-10-01T05:39:00.000Z"),
    briefStatus: "제출 완료",
    briefStep: "완료",
    briefStepLabel: "Submitted",
  });
  assert.ok(!("firstSource" in update.profileOnce));
  assertNoForbidden(update);
});

test("Order: 수량 미정이면 MOQ를 넣지 않는다", () => {
  const update = buildProfileUpdate({
    kind: "orders",
    data: { briefSnapshot: { ...brief, step4: { orderQuantity: "5000", orderQuantityTbd: true } } },
    uid: "uid-1",
    orderId: "o",
    orderCount: 1,
    user,
  });
  assert.ok(!("moq" in update.profileOnce));
  assert.equal(update.result.skipped.moq, "not_exact_number");
});

test("제품명이 있으면 제품명을 쓴다", () => {
  assert.equal(briefProduct({ ...brief, step6: { productName: " Glow Serum " } }), "Glow Serum");
  assert.equal(briefProduct({}), "");
});

test("지금 Channel 프로필에 값이 있으면 처음 한 번만 넣을 값에서 뺀다(자동 관리 값은 그대로)", () => {
  const update = buildProfileUpdate({
    kind: "orders",
    data: { briefSnapshot: brief },
    uid: "uid-1",
    orderId: "o",
    orderCount: 3,
    user,
    existingProfile: { name: "Edited by staff", marketCountry: ["캐나다"], moq: 0, product: "" },
  });
  assert.ok(!("name" in update.profileOnce));
  assert.ok(!("marketCountry" in update.profileOnce));
  assert.ok(!("moq" in update.profileOnce));
  assert.equal(update.result.skipped.name, "already_set");
  assert.equal(update.result.skipped.marketCountry, "already_set");
  assert.equal(update.profileOnce.product, "Skin Care · Bottle, Jar");
  assert.equal(update.profile.orderCount, 3);
});

test("긴 문자열은 512자로 잘린다", () => {
  const update = buildProfileUpdate({ kind: "contact", data: { companyName: "x".repeat(600), email: "buyer@example.com" } });
  assert.equal(update.profileOnce.brandCompanyName.length, 512);
  assert.deepEqual(update.result.truncated, ["brandCompanyName"]);
});

test("알 수 없는 종류는 오류", () => {
  assert.throws(() => buildProfileUpdate({ kind: "cmBriefs", data: {} }));
});
