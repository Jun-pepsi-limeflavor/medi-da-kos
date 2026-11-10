// Contact 문의 폼 검증 규칙 테스트: 필수 항목, 이메일·웹 주소, 수량(5,000 이상 정수), 희망 출시일, 브리프 첨부 제한, 폼 하단 오류 안내.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const v = await import("../../src/components/contact/inquiry-validation.ts");

const NOW = new Date(2026, 10, 10); // 2026-11-10 (local time)

test("required fields: everything except Website or social link", () => {
  for (const field of v.INQUIRY_FIELDS) {
    const expected = field === "website" ? null : v.INQUIRY_MESSAGES.required;
    assert.equal(v.validateInquiryField(field, "   ", NOW), expected, field);
  }
});

test("email and optional website format", () => {
  assert.equal(v.validateInquiryField("email", "  name@company.com ", NOW), null);
  // Same rule as Log In · Sign Up (HTML spec): a dot in the domain is not required.
  assert.equal(v.validateInquiryField("email", "name@company", NOW), null);
  for (const bad of ["name@", "name company@x.com", "@company.com"]) {
    assert.equal(v.validateInquiryField("email", bad, NOW), v.INQUIRY_MESSAGES.invalidEmail, bad);
  }
  assert.equal(v.INQUIRY_MESSAGES.invalidEmail, "Enter a valid email address.");
  assert.equal(v.INQUIRY_MESSAGES.required, "This field is required.");
  for (const ok of ["https://brand.com", "brand.com", "instagram.com/brand", "http://www.brand.co.uk/shop"]) {
    assert.equal(v.validateInquiryField("website", ok, NOW), null, ok);
  }
  for (const bad of ["brand", "https://", "ftp://brand.com", "brand .com"]) {
    assert.equal(v.validateInquiryField("website", bad, NOW), v.INQUIRY_MESSAGES.invalidWebsite, bad);
  }
});

test("quantity: whole number of 5,000 or more, commas allowed", () => {
  assert.equal(v.validateInquiryField("quantity", "5000", NOW), null);
  assert.equal(v.validateInquiryField("quantity", "12,000", NOW), null);
  assert.equal(v.validateInquiryField("quantity", "4999", NOW), v.INQUIRY_MESSAGES.minQuantity);
  for (const bad of ["12.5", "-6000", "abc", "5,000 units"]) {
    assert.equal(v.validateInquiryField("quantity", bad, NOW), v.INQUIRY_MESSAGES.wholeNumber, bad);
  }
  assert.equal(v.formatQuantity("12000"), "12,000");
  assert.equal(v.formatQuantity("12.5"), "12.5");
});

test("launch date: MM / YYYY, this month or later", () => {
  assert.equal(v.normalizeLaunchDate("3/2027"), "03 / 2027");
  assert.equal(v.validateInquiryField("launchDate", "11 / 2026", NOW), null);
  assert.equal(v.validateInquiryField("launchDate", "10 / 2026", NOW), v.INQUIRY_MESSAGES.launchPast);
  for (const bad of ["13 / 2027", "2027-03", "03/27"]) {
    assert.equal(v.validateInquiryField("launchDate", bad, NOW), v.INQUIRY_MESSAGES.launchFormat, bad);
  }
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
