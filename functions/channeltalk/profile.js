/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 제출 종류별 Channel Talk 프로필 요청 내용 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 4장.
 * - profileOnce: 비어 있을 때만 들어간다. 이후 담당자가 고친 값이 유지된다.
 * - profile: 자동 관리 필드. 항상 갱신한다.
 * - shippingAddress, description, nextAction, manufacturer 등은 절대 보내지 않는다.
 */
const { normalizeEmail } = require("./email");
const { clampString, floorToMinute, toE164Mobile, toExactInteger } = require("./field-types");
const { mapMarketCountry } = require("./market-country");

const CATEGORY_LABELS = {
  skincare: "Skin Care",
  cosmetic: "Cosmetic",
  "rnd-agency": "RnD Agency",
};

const BRIEF_STATUS_SUBMITTED = "제출 완료";
const BRIEF_STEP_DONE = "완료";
const BRIEF_STEP_LABEL_DONE = "Submitted";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function categoryOf(brief) {
  const step1 = brief && brief.step1;
  if (!step1 || typeof step1 !== "object") return "";
  return text(step1.selection) || text(step1.category);
}

/** 제품명이 있으면 제품명, 없으면 "카테고리 · 패키징 그룹". */
function briefProduct(brief) {
  if (!brief || typeof brief !== "object") return "";
  const name = text(brief.step6 && brief.step6.productName);
  if (name) return name;
  const category = categoryOf(brief);
  const parts = [];
  if (category) parts.push(CATEGORY_LABELS[category] || category);
  const selections = brief.step2 && Array.isArray(brief.step2.selections) ? brief.step2.selections : [];
  const groups = selections.map((selection) => text(selection && selection.group)).filter(Boolean);
  if (groups.length) parts.push(groups.join(", "));
  return parts.join(" · ");
}

function catalogProduct(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => text(item && item.name))
    .filter(Boolean)
    .join(", ");
}

/** 랜딩 korea는 이름을 비우면 회사명이 contactName에 들어간다. 그 경우는 이름이 아니다. */
function personName(name, companyName) {
  const value = text(name);
  if (!value) return { value: "", reason: "empty" };
  if (value.toLowerCase() === text(companyName).toLowerCase()) return { value: "", reason: "same_as_company" };
  return { value, reason: null };
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function createBuilder(existingProfile) {
  const profileOnce = {};
  const profile = {};
  const skipped = {};
  const truncated = [];

  function once(field, value, emptyReason = "empty") {
    if (!hasValue(value)) {
      skipped[field] = emptyReason;
      return;
    }
    if (existingProfile && hasValue(existingProfile[field])) {
      skipped[field] = "already_set";
      return;
    }
    if (typeof value === "string") {
      const clamped = clampString(value);
      if (clamped.truncated) truncated.push(field);
      profileOnce[field] = clamped.value;
    } else {
      profileOnce[field] = value;
    }
  }

  function auto(field, value) {
    if (hasValue(value)) profile[field] = value;
  }

  function done() {
    return {
      profileOnce,
      profile,
      result: { applied: [...Object.keys(profileOnce), ...Object.keys(profile)], skipped, truncated },
    };
  }

  return { once, auto, done, skip: (field, reason) => { skipped[field] = reason; } };
}

function addMember(builder, user) {
  const source = user || {};
  builder.once("name", text(source.displayName));
  builder.once("email", normalizeEmail(source.email));
  builder.once("brandCompanyName", text(source.companyName));
  const phone = text(source.phone);
  builder.once("mobileNumber", toE164Mobile(phone), phone ? "no_country_code" : "empty");
  const market = mapMarketCountry(text(source.country));
  builder.once("marketCountry", market.values, market.reason || "empty");
}

function addMarket(builder, country) {
  const market = mapMarketCountry(text(country));
  builder.once("marketCountry", market.values, market.reason || "empty");
}

function addMoq(builder, value) {
  const raw = typeof value === "number" ? String(value) : text(value);
  builder.once("moq", toExactInteger(value), raw ? "not_exact_number" : "empty");
}

/**
 * @param {object} input
 * @param {"users"|"contact"|"landingRequests"|"orders"} input.kind
 * @param {object} input.data           제출 문서
 * @param {string} [input.uid]          users·orders의 회원 uid
 * @param {string} [input.orderId]
 * @param {number} [input.orderCount]   테스트 제외 주문 수 (이번 주문 포함)
 * @param {object} [input.user]         orders일 때 users 문서
 * @param {object} [input.existingProfile] 지금 Channel 프로필. 있으면 이미 값 있는 칸을 미리 뺀다
 */
function buildProfileUpdate({ kind, data, uid, orderId, orderCount, user, existingProfile }) {
  const builder = createBuilder(existingProfile);
  const doc = data || {};

  if (kind === "users") {
    addMember(builder, doc);
    builder.once("firstSource", "signup");
    builder.auto("firebaseUid", uid);
    return builder.done();
  }

  if (kind === "contact") {
    builder.skip("name", "no_field");
    builder.once("email", normalizeEmail(doc.email));
    builder.once("brandCompanyName", text(doc.companyName));
    builder.once("businessType", text(doc.businessType) ? [text(doc.businessType)] : null);
    builder.once("referralSource", text(doc.referralSource));
    builder.once("firstSource", "contact");
    return builder.done();
  }

  if (kind === "landingRequests") {
    const variant = text(doc.landingVariant);
    const name = personName(doc.contactName, doc.companyName);
    builder.once("name", name.value, name.reason || "empty");
    builder.once("email", normalizeEmail(doc.email));
    builder.once("brandCompanyName", text(doc.companyName));
    if (variant === "korea") {
      builder.skip("marketCountry", "no_field");
      builder.once("businessType", text(doc.businessType) ? [text(doc.businessType)] : null);
      builder.once("referralSource", text(doc.referralSource));
    } else {
      addMarket(builder, doc.country);
    }
    addMoq(builder, doc.expectedVolume);
    if (variant === "catalog") builder.once("product", catalogProduct(doc.catalogItems));
    if (variant === "dashboard") builder.once("product", briefProduct(doc.dashboardBrief));
    builder.once("firstSource", variant ? `landing-${variant}` : null);
    return builder.done();
  }

  if (kind === "orders") {
    const brief = doc.briefSnapshot || {};
    addMember(builder, user);
    builder.once("product", briefProduct(brief));
    const step4 = brief.step4 || {};
    if (step4.orderQuantityTbd === true) builder.skip("moq", "not_exact_number");
    else addMoq(builder, step4.orderQuantity);
    builder.auto("firebaseUid", uid || doc.uid);
    builder.auto("lastOrderId", orderId);
    builder.auto("orderCount", Number.isSafeInteger(orderCount) && orderCount > 0 ? orderCount : null);
    builder.auto("lastCheckoutCompletedAt", floorToMinute(doc.createdAt));
    builder.auto("briefStatus", BRIEF_STATUS_SUBMITTED);
    builder.auto("briefStep", BRIEF_STEP_DONE);
    builder.auto("briefStepLabel", BRIEF_STEP_LABEL_DONE);
    return builder.done();
  }

  throw new Error(`지원하지 않는 제출 종류: ${kind}`);
}

module.exports = {
  BRIEF_STATUS_SUBMITTED,
  BRIEF_STEP_DONE,
  BRIEF_STEP_LABEL_DONE,
  CATEGORY_LABELS,
  briefProduct,
  buildProfileUpdate,
};
