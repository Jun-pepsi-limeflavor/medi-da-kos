// validation.ts 테스트: 필수 항목, 이메일 형식, 비밀번호 길이.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { AUTH_MESSAGES, validateAuthField, validateAuthForm } = await import("../../src/lib/auth/validation.ts");

const empty = { displayName: "", phone: "", country: "", email: "", password: "" };

test("empty required fields use the Figma message", () => {
  assert.deepEqual(validateAuthForm("login", empty), {
    email: AUTH_MESSAGES.required,
    password: AUTH_MESSAGES.required,
  });
  assert.deepEqual(Object.keys(validateAuthForm("register", empty)), ["displayName", "phone", "country", "email", "password"]);
  assert.equal(validateAuthField("displayName", "   "), AUTH_MESSAGES.required);
});

test("email format matches the old <input type=email> rule, after trimming like the browser did", () => {
  for (const bad of ["name", "name@", "@company.com", "na me@company.com", "name@-company.com", "name@company..com"]) {
    assert.equal(validateAuthField("email", bad), AUTH_MESSAGES.email, bad);
  }
  for (const ok of ["name@company.com", "name@company", "first.last+tag@sub.company.co", "  name@company.com "]) {
    assert.equal(validateAuthField("email", ok), undefined, ok);
  }
});

test("password has no max length or character-class rule (none existed before)", () => {
  assert.equal(validateAuthField("password", "aaaaaaaa"), undefined);
  assert.equal(validateAuthField("password", "a".repeat(200)), undefined);
});

test("password must be at least 8 characters", () => {
  assert.equal(validateAuthField("password", "1234567"), AUTH_MESSAGES.password);
  assert.equal(validateAuthField("password", "12345678"), undefined);
});

test("a valid form has no errors; company name is optional", () => {
  assert.deepEqual(
    validateAuthForm("register", { displayName: "QA", phone: "+1 555", country: "US", email: "qa@example.test", password: "longenough" }),
    {},
  );
});
