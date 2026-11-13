import { test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

const valid = {
  companyName: "Acme Beauty",
  email: "jane@acme.example",
  message: "We'd like to develop a serum.",
  status: "submitted",
  createdAt: "2026-10-01T00:00:00.000Z",
};

function anon(env) {
  return collection(env.unauthenticatedContext().firestore(), "contact");
}

function signedIn(env, uid) {
  return collection(env.authenticatedContext(uid).firestore(), "contact");
}

test("비로그인 문의를 uid 없이 생성할 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), valid));
});

test("비로그인 문의에 uid를 넣을 수 없다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...valid, uid: "buyer-1" }));
});

test("로그인 사용자는 본인 uid로 문의할 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(signedIn(env, "buyer-1"), { ...valid, uid: "buyer-1" }));
});

test("로그인 사용자도 남의 uid로 문의할 수 없다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(signedIn(env, "buyer-1"), { ...valid, uid: "buyer-2" }));
});

test("로그인 사용자는 uid 없이도 문의할 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(signedIn(env, "buyer-1"), valid));
});

test("channelUserId는 64자 이하 문자열이면 허용한다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), { ...valid, channelUserId: "6abe09fe96c07cc647f8" }));
  await assertSucceeds(addDoc(anon(env), { ...valid, channelUserId: "x".repeat(64) }));
  await assertSucceeds(addDoc(anon(env), { ...valid, channelUserId: "" }));
});

test("channelUserId가 64자를 넘거나 문자열이 아니면 거부한다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...valid, channelUserId: "x".repeat(65) }));
  await assertFails(addDoc(anon(env), { ...valid, channelUserId: 12345 }));
});

test("기존 필수 필드 검증은 그대로다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...valid, email: "not-an-email" }));
  await assertFails(addDoc(anon(env), { ...valid, status: "new" }));
});

test("문의는 읽을 수 없다", async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext("buyer-1").firestore();
  await assertFails(getDoc(doc(db, "contact", "any")));
});

// ---------- 리뉴얼 Contact (formVersion 2, 2026-11) ----------

const v2 = () => ({
  formVersion: 2,
  fullName: "Jane Doe",
  email: "jane@acme.example",
  companyName: "Acme Beauty",
  country: "United States",
  productCategory: "Serum",
  quantityPerSku: 5000,
  targetMarkets: "United States, United Kingdom",
  isTest: true,
  status: "submitted",
  createdAt: "2026-11-13T00:00:00.000Z",
  serverCreatedAt: serverTimestamp(),
});

test("리뉴얼: 필수 항목만으로 비로그인 문의를 생성할 수 있다(Message 생략)", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), v2()));
});

test("리뉴얼: 선택 항목·추적·식별 필드를 모두 넣을 수 있다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(signedIn(env, "buyer-1"), {
    ...v2(), uid: "buyer-1", channelUserId: "6abe09fe96c07cc647f8",
    website: "https://brand.example", launchDate: "Q1 2027", message: "x".repeat(5000), promoInterest: true,
    utmSource: "google", utmMedium: "cpc", utmCampaign: "c", utmContent: "a", utmTerm: "t",
    pageUrl: "https://dev.medidakos.com/contact", gaClientId: "123.456", userAgent: "Mozilla/5.0",
  }));
});

test("리뉴얼: Message 빈 문자열을 허용하고 5,001자는 거부한다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), { ...v2(), message: "" }));
  await assertFails(addDoc(anon(env), { ...v2(), message: "x".repeat(5001) }));
});

test("리뉴얼: 필수 항목이 없거나 비면 거부한다", async () => {
  const env = await getTestEnv();
  for (const key of ["fullName", "email", "companyName", "country", "productCategory", "quantityPerSku", "targetMarkets", "isTest", "createdAt", "serverCreatedAt"]) {
    const data = v2();
    delete data[key];
    await assertFails(addDoc(anon(env), data));
  }
  for (const key of ["fullName", "companyName", "country", "productCategory", "targetMarkets"]) {
    await assertFails(addDoc(anon(env), { ...v2(), [key]: "" }));
  }
});

test("리뉴얼: 수량은 5,000 이상 1억 이하 정수만 허용한다", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), { ...v2(), quantityPerSku: 100000000 }));
  await assertFails(addDoc(anon(env), { ...v2(), quantityPerSku: 4999 }));
  await assertFails(addDoc(anon(env), { ...v2(), quantityPerSku: 100000001 }));
  await assertFails(addDoc(anon(env), { ...v2(), quantityPerSku: 5000.5 }));
  await assertFails(addDoc(anon(env), { ...v2(), quantityPerSku: "5000" }));
});

test("리뉴얼: 길이 제한을 넘는 값과 잘못된 타입을 거부한다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...v2(), fullName: "x".repeat(101) }));
  await assertFails(addDoc(anon(env), { ...v2(), targetMarkets: "x".repeat(301) }));
  await assertFails(addDoc(anon(env), { ...v2(), website: "x".repeat(501) }));
  await assertFails(addDoc(anon(env), { ...v2(), launchDate: "x".repeat(101) }));
  await assertFails(addDoc(anon(env), { ...v2(), promoInterest: "yes" }));
  await assertFails(addDoc(anon(env), { ...v2(), isTest: "true" }));
  await assertFails(addDoc(anon(env), { ...v2(), email: "not-an-email" }));
  await assertFails(addDoc(anon(env), { ...v2(), status: "new" }));
  await assertFails(addDoc(anon(env), { ...v2(), userAgent: "x".repeat(1001) }));
});

test("리뉴얼: 허용 목록 밖의 필드를 거부한다(기존 referralSource·businessType 포함)", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...v2(), role: "admin" }));
  await assertFails(addDoc(anon(env), { ...v2(), referralSource: "google" }));
  await assertFails(addDoc(anon(env), { ...v2(), promoCode: "YE2026" }));
});

test("리뉴얼: 서버 시각이 아닌 serverCreatedAt과 다른 formVersion을 거부한다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...v2(), serverCreatedAt: new Date("2020-01-01") }));
  await assertFails(addDoc(anon(env), { ...v2(), formVersion: 3 }));
});

test("리뉴얼: uid·channelUserId 규칙은 기존과 같다", async () => {
  const env = await getTestEnv();
  await assertFails(addDoc(anon(env), { ...v2(), uid: "buyer-1" }));
  await assertFails(addDoc(signedIn(env, "buyer-1"), { ...v2(), uid: "buyer-2" }));
  await assertSucceeds(addDoc(signedIn(env, "buyer-1"), { ...v2(), uid: "buyer-1" }));
  await assertFails(addDoc(anon(env), { ...v2(), channelUserId: "x".repeat(65) }));
});

test("기존 형식: 운영 폼이 보내는 필드 전체로 생성할 수 있다(하위 호환)", async () => {
  const env = await getTestEnv();
  await assertSucceeds(addDoc(anon(env), {
    ...valid, referralSource: "google", businessType: "brand",
    utmSource: "a", utmMedium: "b", utmCampaign: "c", utmContent: "d", utmTerm: "e",
    pageUrl: "https://www.medidakos.com/contact", gaClientId: "1.2", userAgent: "UA",
    isTest: false, serverCreatedAt: serverTimestamp(),
  }));
});

test("기존 형식으로 리뉴얼 검사를 우회할 수 없다", async () => {
  const env = await getTestEnv();
  // formVersion이 있으면 기존 검사로 통과할 수 없다
  await assertFails(addDoc(anon(env), { ...valid, formVersion: 2 }));
  await assertFails(addDoc(anon(env), { ...valid, formVersion: 1 }));
  // 기존 형식에 리뉴얼 필드·임의 필드를 덧붙일 수 없다
  await assertFails(addDoc(anon(env), { ...valid, fullName: "x".repeat(10000) }));
  await assertFails(addDoc(anon(env), { ...valid, anything: "spam" }));
  // 기존 형식은 여전히 Message가 필수다(운영 폼 그대로)
  await assertFails(addDoc(anon(env), { ...valid, message: "" }));
});
