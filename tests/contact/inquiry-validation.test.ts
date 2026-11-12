// Contact 문의 폼 검증 규칙 테스트: 필수·선택 항목(2026.11.11: 출시일·Message 선택), 이메일·웹 주소, 수량(5,000 이상 정수),
// 희망 출시일 자유 문자열, 브리프 첨부 제한, 폼 하단 오류 안내.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const v = await import("../../src/components/contact/inquiry-validation.ts");

test("required fields: everything except Website, Desired launch date and Message", () => {
  const optional = ["website", "launchDate", "message"];
  for (const field of v.INQUIRY_FIELDS) {
    const expected = optional.includes(field) ? null : v.INQUIRY_MESSAGES.required;
    assert.equal(v.validateInquiryField(field, "   "), expected, field);
  }
});

test("email and optional website format", () => {
  assert.equal(v.validateInquiryField("email", "  name@company.com "), null);
  // Same rule as Log In · Sign Up (HTML spec): a dot in the domain is not required.
  assert.equal(v.validateInquiryField("email", "name@company"), null);
  for (const bad of ["name@", "name company@x.com", "@company.com"]) {
    assert.equal(v.validateInquiryField("email", bad), v.INQUIRY_MESSAGES.invalidEmail, bad);
  }
  assert.equal(v.INQUIRY_MESSAGES.invalidEmail, "Enter a valid email address.");
  assert.equal(v.INQUIRY_MESSAGES.required, "This field is required.");
  for (const ok of ["https://brand.com", "brand.com", "instagram.com/brand", "http://www.brand.co.uk/shop"]) {
    assert.equal(v.validateInquiryField("website", ok), null, ok);
  }
  for (const bad of ["brand", "https://", "ftp://brand.com", "brand .com"]) {
    assert.equal(v.validateInquiryField("website", bad), v.INQUIRY_MESSAGES.invalidWebsite, bad);
  }
});

test("quantity: whole number of 5,000 or more, commas allowed", () => {
  assert.equal(v.validateInquiryField("quantity", "5000"), null);
  assert.equal(v.validateInquiryField("quantity", "12,000"), null);
  assert.equal(v.validateInquiryField("quantity", "4999"), v.INQUIRY_MESSAGES.minQuantity);
  for (const bad of ["12.5", "-6000", "abc", "5,000 units"]) {
    assert.equal(v.validateInquiryField("quantity", bad), v.INQUIRY_MESSAGES.wholeNumber, bad);
  }
  assert.equal(v.formatQuantity("12000"), "12,000");
  assert.equal(v.formatQuantity("12.5"), "12.5");
});

test("launch date and message: optional free text with no format rule", () => {
  for (const ok of ["", "TBD", "Q1 2027", "March 2027", "03 / 2027", "2025-01", "sometime next year"]) {
    assert.equal(v.validateInquiryField("launchDate", ok), null, ok);
  }
  assert.equal(v.validateInquiryField("message", ""), null);
  assert.equal(v.validateInquiryField("message", "A 50ml serum."), null);
});

test("a form with only the required fields filled has no errors", () => {
  const values = {
    fullName: "Test", email: "name@company.com", company: "Brand", country: "US", website: "",
    productCategory: "Serum", quantity: "5,000", targetMarkets: "US", launchDate: "", message: "",
  };
  assert.deepEqual(v.validateInquiry(values), {});
  assert.deepEqual(Object.keys(v.validateInquiry({ ...values, fullName: "" })), ["fullName"]);
});

test("brief files: allowed types, 10 MiB each, max 3, no duplicates", () => {
  const file = (name: string, size = 1000, lastModified = 1) => ({ name, size, lastModified });
  const four = ["a.pdf", "b.DOCX", "c.xlsx", "d.png"].map((n) => file(n));
  let r = v.addBriefFiles([], four);
  assert.deepEqual(r.files.map((f) => f.name), ["a.pdf", "b.DOCX", "c.xlsx"]);
  assert.equal(r.error, v.BRIEF_FILE_MESSAGES.count);

  r = v.addBriefFiles([], [file("x.exe"), file("y.jpeg")]);
  assert.deepEqual(r.files.map((f) => f.name), ["y.jpeg"]);
  assert.equal(r.error, v.BRIEF_FILE_MESSAGES.type);

  r = v.addBriefFiles([], [file("big.pptx", 10 * 1024 * 1024 + 1), file("ok.pptx", 10 * 1024 * 1024)]);
  assert.deepEqual(r.files.map((f) => f.name), ["ok.pptx"]);
  assert.equal(r.error, v.BRIEF_FILE_MESSAGES.size);

  const one = file("brief.pdf");
  r = v.addBriefFiles([one], [file("brief.pdf")]);
  assert.equal(r.files.length, 1);
  assert.equal(r.error, v.BRIEF_FILE_MESSAGES.duplicate);
});

test("form notice follows the current field errors", () => {
  const m = v.INQUIRY_MESSAGES;
  assert.equal(v.inquiryErrorSummary({}), null);
  assert.equal(v.inquiryErrorSummary({ fullName: m.required, email: m.invalidEmail }), m.formError);
  assert.equal(v.inquiryErrorSummary({ email: m.invalidEmail, website: m.invalidWebsite }), m.formInvalid);
  assert.equal(v.inquiryErrorSummary({ quantity: undefined }), null);
  assert.equal(m.formError, "Please fill in the required fields and try again.");
  assert.equal(m.formInvalid, "Please correct the highlighted fields and try again.");
});
