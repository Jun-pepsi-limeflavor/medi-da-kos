// saveUserProfile()의 exists()-분기를 에뮬레이터로 검증한다.
// getFirebaseDb()는 firebase/firestore 클라이언트 SDK의 전역 싱글턴이고
// connectFirestoreEmulator(...,{mockUserToken})는 그 인스턴스 생애주기에
// 딱 한 번만 걸 수 있다. saveUserProfile은 실제 앱처럼 로그인 상태로 호출돼야
// rules(isOwner)를 통과하므로, 이 파일 전체가 같은 uid로 로그인한 것처럼
// 한 번만 연결한다 — withSecurityRulesDisabled는 RulesTestContext가 만든
// firestore 인스턴스에만 적용되고 이 전역 인스턴스는 건드리지 못한다.
// 규칙 자체는 users.test.mjs가 이미 검사한다.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { connectFirestoreEmulator, doc, getDoc, setDoc, terminate } from "firebase/firestore";
import { getTestEnv } from "./helpers.mjs";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-medidakos";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "demo-app";
process.env.NEXT_PUBLIC_USE_MOCK_AUTH = "false";

// firestore-service.ts는 확장자 생략 상대 import 투성이다(Next 번들러 전제).
// node --test가 그걸 그대로 못 여니 최소 리졸버 훅을 동적 import 전에 건다.
register("../esm-alias-loader.mjs", import.meta.url);
const { getFirebaseDb } = await import("../../src/lib/firebase.ts");
const { saveUserProfile } = await import("../../src/lib/firestore-service.ts");

const UID = "user-profile-test-uid";
const appDb = getFirebaseDb();
connectFirestoreEmulator(appDb, "127.0.0.1", 8080, {
  mockUserToken: { sub: UID, user_id: UID },
});

// 열린 grpc/websocket 채널을 안 닫으면 node --test가 프로세스 종료를 못 하고
// 매달린다 — helpers.mjs의 after() 훅과 별개로 이 인스턴스도 직접 정리한다.
after(() => terminate(appDb));

test("saveUserProfile: 새 문서는 uid/email/createdAt 과 가변 필드를 함께 쓴다", async () => {
  const env = await getTestEnv();

  await saveUserProfile({
    uid: UID,
    email: "new@example.com",
    displayName: "New Name",
    phone: "010-1111-2222",
    country: "KR",
    companyName: "New Co",
    provider: "google",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), "users", UID));
    data = snap.data();
  });
  assert.equal(data.uid, UID);
  assert.equal(data.email, "new@example.com");
  assert.equal(data.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(data.displayName, "New Name");
  assert.equal(data.phone, "010-1111-2222");
});

test("saveUserProfile: 기존 문서는 가변 필드만 merge 하고 uid/email/createdAt 은 보존한다", async () => {
  const env = await getTestEnv();

  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "users", UID), {
      uid: UID,
      email: "orig@example.com",
      createdAt: "2020-01-01T00:00:00.000Z",
      displayName: "Old Name",
      phone: "010-0000-0000",
      country: "US",
      companyName: "Old Co",
      provider: "email",
      isTest: false,
    }),
  );

  await saveUserProfile({
    // saveUserProfile은 존재하는 문서면 uid/email/createdAt을 payload에서
    // 아예 빼므로, 여기 값이 달라도 기존 값이 살아남아야 한다.
    uid: UID,
    email: "ignored@example.com",
    createdAt: "IGNORED",
    displayName: "Updated Name",
    phone: "010-9999-8888",
    country: "KR",
    companyName: "New Co",
    provider: "google",
  });

  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), "users", UID));
    data = snap.data();
  });
  assert.equal(data.uid, UID, "uid는 보존된다");
  assert.equal(data.email, "orig@example.com", "email은 보존된다");
  assert.equal(data.createdAt, "2020-01-01T00:00:00.000Z", "createdAt은 보존된다");
  assert.equal(data.displayName, "Updated Name", "displayName은 갱신된다");
  assert.equal(data.phone, "010-9999-8888", "phone은 갱신된다");
  assert.equal(data.companyName, "New Co", "companyName은 갱신된다");
});
