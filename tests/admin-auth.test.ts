import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertAllowedAdmin, NotAdminError } from "../src/lib/admin-auth.ts";

const google = (email: string) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
});

beforeEach(() => {
  process.env.BACKOFFICE_ADMIN_EMAILS = "rheekw@techasset.co.kr, songjh@techasset.co.kr";
});

test("허용목록에 있는 구글 계정은 통과한다", () => {
  const id = assertAllowedAdmin(google("rheekw@techasset.co.kr"));
  assert.deepEqual(id, { email: "rheekw@techasset.co.kr" });
});

test("대소문자와 공백이 달라도 통과한다", () => {
  const id = assertAllowedAdmin(google("  RheeKW@Techasset.co.KR "));
  assert.deepEqual(id, { email: "rheekw@techasset.co.kr" });
});

test("허용목록에 없으면 거부한다", () => {
  assert.throws(() => assertAllowedAdmin(google("stranger@example.com")), NotAdminError);
});

test("이메일 미인증이면 거부한다", () => {
  assert.throws(
    () => assertAllowedAdmin({ ...google("rheekw@techasset.co.kr"), email_verified: false }),
    NotAdminError,
  );
});

test("허용되지 않은 제공자면 거부한다", () => {
  assert.throws(
    () =>
      assertAllowedAdmin({
        ...google("rheekw@techasset.co.kr"),
        firebase: { sign_in_provider: "password" },
      }),
    NotAdminError,
  );
});

test("microsoft.com 제공자는 통과한다", () => {
  process.env.BACKOFFICE_ADMIN_EMAILS = "support@medidakos.com";
  const id = assertAllowedAdmin({
    email: "support@medidakos.com",
    email_verified: true,
    firebase: { sign_in_provider: "microsoft.com" },
  });
  assert.deepEqual(id, { email: "support@medidakos.com" });
});

test("BACKOFFICE_ADMIN_EMAILS 가 비어 있으면 통과가 아니라 예외다", () => {
  process.env.BACKOFFICE_ADMIN_EMAILS = "";
  assert.throws(
    () => assertAllowedAdmin(google("rheekw@techasset.co.kr")),
    (err: unknown) =>
      err instanceof Error &&
      !(err instanceof NotAdminError) &&
      /BACKOFFICE_ADMIN_EMAILS/.test((err as Error).message),
  );
});

test("BACKOFFICE_ADMIN_EMAILS 가 없어도 예외다", () => {
  delete process.env.BACKOFFICE_ADMIN_EMAILS;
  assert.throws(
    () => assertAllowedAdmin(google("rheekw@techasset.co.kr")),
    (err: unknown) =>
      err instanceof Error &&
      !(err instanceof NotAdminError) &&
      /BACKOFFICE_ADMIN_EMAILS/.test((err as Error).message),
  );
});

test("BACKOFFICE_ADMIN_EMAILS 가 콤마뿐이어도 예외다", () => {
  process.env.BACKOFFICE_ADMIN_EMAILS = ",";
  assert.throws(
    () => assertAllowedAdmin(google("rheekw@techasset.co.kr")),
    (err: unknown) =>
      err instanceof Error &&
      !(err instanceof NotAdminError) &&
      /BACKOFFICE_ADMIN_EMAILS/.test((err as Error).message),
  );
});

test("BACKOFFICE_ADMIN_EMAILS 가 공백 조각뿐이어도 예외다", () => {
  process.env.BACKOFFICE_ADMIN_EMAILS = " , , ";
  assert.throws(
    () => assertAllowedAdmin(google("rheekw@techasset.co.kr")),
    (err: unknown) =>
      err instanceof Error &&
      !(err instanceof NotAdminError) &&
      /BACKOFFICE_ADMIN_EMAILS/.test((err as Error).message),
  );
});

test("이메일이 없으면 거부한다", () => {
  assert.throws(() => assertAllowedAdmin({ ...google(""), email: undefined }), NotAdminError);
});

test("이메일이 문자열이 아니면 거부한다", () => {
  assert.throws(
    () => assertAllowedAdmin({ ...google(""), email: 12345 as unknown as string }),
    NotAdminError,
  );
});

test("U+212A KELVIN SIGN 으로 대소문자 폴딩을 노려도 거부한다", () => {
  // U+212A(KELVIN SIGN)는 toLowerCase()에서 ASCII "k"로 접힌다.
  // 폴딩 전에 걸러내지 않으면 이 이메일이 rheekw@... 로 오인된다.
  const kelvinSign = "K";
  assert.throws(
    () => assertAllowedAdmin(google(`rhee${kelvinSign}w@techasset.co.kr`)),
    NotAdminError,
  );
});
