// auth-errors.ts 테스트: 코드별 문구, 팝업 취소, 알 수 없는 오류, Mock 오류, 로그 내용.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { FirebaseError } from "firebase/app";

register("../esm-alias-loader.mjs", import.meta.url);
const { describeAuthError, logAuthError, GENERIC_AUTH_ERROR } = await import("../../src/lib/auth/auth-errors.ts");

// Same shape Firebase Auth throws: FirebaseError with `code` and a developer-facing message.
const fb = (code: string) => new FirebaseError(code, `Firebase: Error (${code}).`);

test("Firebase codes map to user-facing messages", () => {
  const expected: Record<string, string> = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "Invalid email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Password does not meet the security requirements.",
    "auth/password-does-not-meet-requirements": "Password does not meet the security requirements.",
    "auth/user-disabled": "This account has been disabled. Please contact support.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection and try again.",
    "auth/timeout": "Network error. Please check your connection and try again.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and try again.",
    "auth/account-exists-with-different-credential":
      "An account with this email already exists using a different sign-in method. Please use your original sign-in method.",
  };
  for (const [code, message] of Object.entries(expected)) {
    assert.deepEqual(describeAuthError(fb(code)), { message, code }, code);
  }
});

test("user-cancelled Google popups show no message", () => {
  for (const code of ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]) {
    assert.deepEqual(describeAuthError(fb(code)), { message: null, code });
  }
});

test("unknown errors never expose the raw Firebase text", () => {
  assert.deepEqual(describeAuthError(fb("auth/internal-error")), { message: GENERIC_AUTH_ERROR, code: "auth/internal-error" });
  assert.deepEqual(describeAuthError(new Error("Firebase: boom (auth/x).")), { message: GENERIC_AUTH_ERROR, code: null });
  assert.deepEqual(describeAuthError("oops"), { message: GENERIC_AUTH_ERROR, code: null });
  assert.deepEqual(describeAuthError(null), { message: GENERIC_AUTH_ERROR, code: null });
  // Firestore errors after sign-up (e.g. profile save) have non-auth codes → generic message
  assert.equal(describeAuthError({ code: "permission-denied" }).message, GENERIC_AUTH_ERROR);
});

test("mock errors with Firebase-style codes map the same way", () => {
  const mock = Object.assign(new Error("Invalid email or password."), { code: "auth/invalid-credential" });
  assert.equal(describeAuthError(mock).message, "Invalid email or password.");
});

test("logs contain only the code, never the message or email", () => {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => lines.push(args.join(" "));
  try {
    const withEmail = Object.assign(new FirebaseError("auth/email-already-in-use", "Firebase: user@example.com taken"), {
      customData: { email: "user@example.com" },
    });
    logAuthError("sign-up", withEmail);
    logAuthError("login", new Error("password=hunter2"));
  } finally {
    console.warn = original;
  }
  assert.deepEqual(lines, ["[auth] sign-up failed: auth/email-already-in-use", "[auth] login failed: Error"]);
  assert.ok(!lines.join(" ").includes("example.com") && !lines.join(" ").includes("hunter2"));
});
