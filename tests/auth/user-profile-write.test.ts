// user-profile-write 테스트: 새 회원 문서 모양, 선택 항목이 빈 경우, 기존 문서(나중의 Google 로그인)에서 빈 값으로 덮어쓰지 않음.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { userProfileWrite } = await import("../../src/lib/firebase/user-profile-write.ts");

const base = {
  uid: "u1",
  email: "qa@example.test",
  displayName: "QA",
  phone: "",
  country: "",
  companyName: "",
  provider: "email" as const,
  role: "user" as const,
  createdAt: "2026-11-12T00:00:00.000Z",
};

/** Keys firestore.rules allows on create (users/{uid}). */
const CREATE_KEYS = ["uid", "email", "displayName", "phone", "country", "companyName", "provider", "createdAt", "isTest"];
/** Keys firestore.rules allows to change on update. */
const UPDATE_KEYS = ["displayName", "phone", "country", "companyName", "provider", "isTest"];

test("new email sign-up with optional fields left empty: same document shape as before", () => {
  const doc = userProfileWrite(base, false, true);
  assert.deepEqual(doc, { uid: "u1", email: "qa@example.test", createdAt: base.createdAt, displayName: "QA", phone: "", country: "", companyName: "", provider: "email", isTest: true });
  assert.ok(Object.keys(doc).every((k) => CREATE_KEYS.includes(k)));
  assert.equal("role" in doc, false);
});

test("new sign-up keeps filled optional fields", () => {
  const doc = userProfileWrite({ ...base, phone: "+1 202 555 0123", country: "United States", companyName: "Brand" }, false, false);
  assert.equal(doc.phone, "+1 202 555 0123");
  assert.equal(doc.country, "United States");
  assert.equal(doc.companyName, "Brand");
  assert.equal(doc.isTest, false);
});

test("existing user signing in with Google does not blank saved phone, country or company", () => {
  const google = { ...base, displayName: "QA Google", provider: "google" as const };
  const doc = userProfileWrite(google, true, true);
  assert.deepEqual(doc, { displayName: "QA Google", provider: "google", isTest: true });
  assert.ok(Object.keys(doc).every((k) => UPDATE_KEYS.includes(k)));
});
