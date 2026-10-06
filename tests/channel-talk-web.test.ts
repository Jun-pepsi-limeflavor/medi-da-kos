// 웹 → Channel Talk 연동(설계 10장): 회원 boot는 신원만, 제출 문서의 channelUserId·uid,
// Brief 저장 시점 동기화, member-hash 본인 인증.
// channel-talk.ts는 SDK 로더가 window.ChannelIO만 부르므로, window를 가짜로 두고 호출을 기록한다.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import {
  BRIEF_STATUS_IN_PROGRESS,
  briefProgressProfile,
  channelUserIdField,
  contactIdentityFields,
  floorToMinute,
  gaBootProfile,
} from "../src/lib/channel-talk-intake.ts";
import { hashMemberId, memberHashResponse } from "../src/lib/channel-talk-member-hash.ts";
import { buildLandingRequest } from "../src/lib/landing/request.ts";

register("./esm-alias-loader.mjs", import.meta.url);

type Call = { method: string; args: unknown[] };
type BootUser = { id: string };

/** window.ChannelIO 가짜. boot는 콜백으로 bootUser(또는 오류)를 바로 돌려준다. */
function fakeChannel(options: { bootUser?: BootUser; bootError?: Error } = {}) {
  const calls: Call[] = [];
  const ChannelIO = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
    if (method === "boot") {
      const callback = args[1] as (error: Error | null, user: BootUser | null) => void;
      if (options.bootError) callback(options.bootError, null);
      else callback(null, options.bootUser ?? { id: "ch-user-1" });
    }
  };
  (globalThis as { window?: unknown }).window = { ChannelIO };
  return { calls, of: (method: string) => calls.filter((c) => c.method === method) };
}

let instance = 0;
/** 모듈 상태(boot 여부 등)가 테스트끼리 섞이지 않게 매번 새로 불러온다. */
async function freshChannelTalk() {
  instance += 1;
  return import(`../src/lib/channel-talk.ts?case=${instance}`) as Promise<typeof import("../src/lib/channel-talk.ts")>;
}

function stubFetch(response: { memberHash?: string } = { memberHash: "hash-abc" }) {
  const requests: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return { ok: true, json: async () => response } as Response;
  }) as typeof fetch;
  return requests;
}

const member = { uid: "uid-1", email: "jane@example.com", displayName: "Jane Doe", phone: "+15550100000", country: "United States", companyName: "Acme", provider: "password", createdAt: "2026-10-01T00:00:00.000Z" };
const PROFILE_FIELDS = ["name", "email", "mobileNumber", "companyName", "country", "firebaseUid", "brandCompanyName", "marketCountry"];

// ---- W2 회원 boot ----

test("회원 boot는 memberId·memberHash·GA 값만 보내고 고객 프로필 필드는 보내지 않는다", async () => {
  const channel = fakeChannel();
  const requests = stubFetch();
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsMember("plugin-key", member as never, "GA1.1.1.2", "id-token-1");

  const [boot] = channel.of("boot");
  const option = boot.args[0] as Record<string, unknown>;
  assert.equal(option.memberId, "uid-1");
  assert.equal(option.memberHash, "hash-abc");
  assert.deepEqual(option.profile, { gaClientId: "GA1.1.1.2", analyticsId: "GA1.1.1.2" });
  for (const field of PROFILE_FIELDS) assert.ok(!(field in (option.profile as object)), field);
  assert.equal(channel.of("updateUser").length, 0, "boot 뒤 프로필을 따로 쓰지 않는다");
  assert.equal((requests[0].init.headers as Record<string, string>).Authorization, "Bearer id-token-1");
  assert.deepEqual(JSON.parse(String(requests[0].init.body)), { memberId: "uid-1" });
});

test("GA 값이 없으면 회원 boot 프로필은 비어 있다", () => {
  assert.deepEqual(gaBootProfile(null), {});
});

test("ID 토큰이 없으면 member-hash를 요청하지 않고 해시 없이 boot한다", async () => {
  const channel = fakeChannel();
  const requests = stubFetch();
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsMember("plugin-key", member as never, null, null);
  assert.equal(requests.length, 0);
  assert.ok(!("memberHash" in (channel.of("boot")[0].args[0] as object)));
});

// ---- W3 channelUserId ----

test("boot된 Channel 고객 id를 돌려주고, boot 전·실패·종료 뒤에는 null", async () => {
  fakeChannel({ bootUser: { id: "6abf5577af13436eb813" } });
  const ct = await freshChannelTalk();
  assert.equal(ct.getChannelTalkUserId(), null);
  await ct.bootChannelTalkAsAnonymous("plugin-key", null);
  assert.equal(ct.getChannelTalkUserId(), "6abf5577af13436eb813");
  ct.shutdownChannelTalk();
  assert.equal(ct.getChannelTalkUserId(), null);

  fakeChannel({ bootError: new Error("blocked") });
  const failed = await freshChannelTalk();
  const quiet = console.error;
  console.error = () => {};
  try {
    await failed.bootChannelTalkAsAnonymous("plugin-key", null);
  } finally {
    console.error = quiet;
  }
  assert.equal(failed.getChannelTalkUserId(), null);
});

test("channelUserId는 rules와 같은 1~64자 문자열일 때만 넣는다", () => {
  assert.deepEqual(channelUserIdField("6abf5577af13436eb813"), { channelUserId: "6abf5577af13436eb813" });
  assert.deepEqual(channelUserIdField("x".repeat(64)), { channelUserId: "x".repeat(64) });
  for (const value of [null, undefined, "", "x".repeat(65), 123, {}]) assert.deepEqual(channelUserIdField(value), {}, String(value));
});

const landingContext = { pageUrl: "https://www.medidakos.com/landing/korea", gaClientId: "GA1.1.1.2", userAgent: "test" };
/** 앞 테스트의 가짜 window(location 없음)를 치우고 서버 환경처럼 만든다. */
function withoutWindow<T>(run: () => T): T {
  const saved = (globalThis as { window?: unknown }).window;
  delete (globalThis as { window?: unknown }).window;
  try {
    return run();
  } finally {
    (globalThis as { window?: unknown }).window = saved;
  }
}
const koreaInput = { landingVariant: "korea" as const, companyName: "Acme Beauty", email: "buyer@example.com", expectedVolume: "5k-10k" };

test("랜딩: Channel 고객 id가 있으면 제출 문서에 들어간다", () => {
  const request = withoutWindow(() => buildLandingRequest(koreaInput, { ...landingContext, ...channelUserIdField("6abf5577af13436eb813") }));
  assert.equal(request.channelUserId, "6abf5577af13436eb813");
});

test("랜딩: Channel 고객 id가 없어도 제출 문서를 만들고 channelUserId 키가 없다", () => {
  const request = withoutWindow(() => buildLandingRequest(koreaInput, { ...landingContext, ...channelUserIdField(null) }));
  assert.ok(!("channelUserId" in request));
  assert.equal(request.email, "buyer@example.com");
});

// ---- W4 로그인 Contact uid ----

test("Contact: 로그인 회원은 본인 uid와 Channel 고객 id를 넣는다", () => {
  assert.deepEqual(contactIdentityFields({ uid: "uid-1", channelUserId: "ch-1" }), { uid: "uid-1", channelUserId: "ch-1" });
});

test("Contact: 비로그인이면 uid를 넣지 않고, Channel 고객 id가 없어도 된다", () => {
  assert.deepEqual(contactIdentityFields({ uid: null, channelUserId: "ch-1" }), { channelUserId: "ch-1" });
  assert.deepEqual(contactIdentityFields({ uid: undefined, channelUserId: null }), {});
  assert.deepEqual(contactIdentityFields({ uid: "", channelUserId: "" }), {});
});

// ---- W5 Brief ----

test("Brief 작성 중 프로필: 단계·이름·작성 중·분 단위 저장 시각", () => {
  const now = Date.parse("2026-10-06T03:04:59.999Z");
  assert.deepEqual(briefProgressProfile(3, "Formula", now), {
    briefStep: "3",
    briefStepLabel: "Formula",
    briefStatus: BRIEF_STATUS_IN_PROGRESS,
    briefUpdatedAt: Date.parse("2026-10-06T03:04:00.000Z"),
  });
  assert.equal(floorToMinute(now) % 60000, 0);
});

test("Brief: 저장·이동할 때만 프로필을 쓰고, 불러오기는 페이지 추적만 한다", async () => {
  const channel = fakeChannel();
  stubFetch();
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsMember("plugin-key", member as never, null, "t");

  ct.syncBriefStepToChannelTalk(1, "Category"); // refreshBrief(제출 직후 1단계로 초기화된 초안 포함)
  assert.equal(channel.of("updateUser").length, 0, "불러오기는 프로필을 쓰지 않는다");
  assert.ok(channel.of("setPage").length >= 1);

  ct.syncBriefStepToChannelTalk(2, "Packaging", { saved: true });
  const updates = channel.of("updateUser");
  assert.equal(updates.length, 1);
  const profile = (updates[0].args[0] as { profile: Record<string, unknown> }).profile;
  assert.equal(profile.briefStep, "2");
  assert.equal(profile.briefStepLabel, "Packaging");
  assert.equal(profile.briefStatus, "작성 중");
  assert.equal(typeof profile.briefUpdatedAt, "number");
  assert.equal((profile.briefUpdatedAt as number) % 60000, 0);
});

test("Brief: 다른 대시보드 화면으로 가도 briefStep 등을 null로 지우지 않는다", async () => {
  const channel = fakeChannel();
  stubFetch();
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsMember("plugin-key", member as never, null, "t");
  ct.syncChannelTalkRoute("/dashboard/orders");
  ct.clearBriefStepFromChannelTalk("/dashboard/tracking");
  assert.equal(channel.of("updateUser").length, 0);
  assert.ok(channel.of("resetPage").length >= 1, "가상 페이지는 정리한다");
});

test("Brief: boot 전 저장 요청은 뒤이은 불러오기에 덮이지 않고 boot 뒤 그대로 반영된다", async () => {
  const channel = fakeChannel();
  stubFetch();
  const ct = await freshChannelTalk();
  ct.syncBriefStepToChannelTalk(4, "Fragrance", { saved: true });
  ct.syncBriefStepToChannelTalk(1, "Category"); // 불러오기
  await ct.bootChannelTalkAsMember("plugin-key", member as never, null, "t");
  const updates = channel.of("updateUser");
  assert.equal(updates.length, 1);
  assert.equal((updates[0].args[0] as { profile: { briefStep: string } }).profile.briefStep, "4");
});

test("Brief: boot 전 불러오기만 있었다면 boot 뒤에도 프로필을 쓰지 않는다", async () => {
  const channel = fakeChannel();
  stubFetch();
  const ct = await freshChannelTalk();
  ct.syncBriefStepToChannelTalk(1, "Category");
  await ct.bootChannelTalkAsMember("plugin-key", member as never, null, "t");
  assert.equal(channel.of("updateUser").length, 0);
});

// ---- W6 member-hash ----

const SECRET = "a1".repeat(32);
const verifyAs = (uid: string) => async (token: string) => {
  if (token !== "valid-token") throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
  return { uid };
};

test("member-hash: 토큰이 없으면 401", async () => {
  for (const authorization of [null, "", "Basic abc", "Bearer "]) {
    const result = await memberHashResponse({ authorization, body: { memberId: "uid-1" }, secretKeyHex: SECRET, verifyIdToken: verifyAs("uid-1") });
    assert.equal(result.status, 401, String(authorization));
    assert.ok(!("memberHash" in result.body));
  }
});

test("member-hash: 유효하지 않은 토큰이면 401", async () => {
  const result = await memberHashResponse({ authorization: "Bearer forged", body: { memberId: "uid-1" }, secretKeyHex: SECRET, verifyIdToken: verifyAs("uid-1") });
  assert.equal(result.status, 401);
  assert.ok(!("memberHash" in result.body));
});

test("member-hash: 다른 사용자의 uid를 요청하면 403", async () => {
  const result = await memberHashResponse({ authorization: "Bearer valid-token", body: { memberId: "someone-else" }, secretKeyHex: SECRET, verifyIdToken: verifyAs("uid-1") });
  assert.equal(result.status, 403);
  assert.ok(!("memberHash" in result.body));
});

test("member-hash: 본인 uid면 해시를 돌려준다", async () => {
  const result = await memberHashResponse({ authorization: "Bearer valid-token", body: { memberId: "uid-1" }, secretKeyHex: SECRET, verifyIdToken: verifyAs("uid-1") });
  assert.equal(result.status, 200);
  assert.equal(result.body.memberHash, hashMemberId("uid-1", SECRET));
});

test("member-hash: 토큰 검증 설정이 없으면(auth 오류가 아님) 500, 해시는 주지 않는다", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const result = await memberHashResponse({
      authorization: "Bearer valid-token",
      body: { memberId: "uid-1" },
      secretKeyHex: SECRET,
      verifyIdToken: async () => { throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set"); },
    });
    assert.equal(result.status, 500);
    assert.ok(!("memberHash" in result.body));
  } finally {
    console.error = quiet;
  }
});

test("member-hash: 잘못된 본문은 400", async () => {
  const bad = await memberHashResponse({ authorization: "Bearer valid-token", body: undefined, secretKeyHex: SECRET, verifyIdToken: verifyAs("uid-1") });
  assert.equal(bad.status, 400);
  const noId = await memberHashResponse({ authorization: "Bearer valid-token", body: {}, secretKeyHex: SECRET, verifyIdToken: verifyAs("uid-1") });
  assert.equal(noId.status, 400);
});

test("member-hash: 비밀값이 없으면(빈 값 포함) 인증과 관계없이 503, 해시 없음, 로그에는 누락 사실만", async () => {
  const logged: string[] = [];
  const quiet = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
  try {
    for (const secretKeyHex of [undefined, ""]) {
      for (const authorization of [null, "Bearer valid-token"]) {
        let verified = false;
        const result = await memberHashResponse({
          authorization,
          body: { memberId: "uid-1" },
          secretKeyHex,
          verifyIdToken: async () => { verified = true; return { uid: "uid-1" }; },
        });
        assert.equal(result.status, 503);
        assert.ok(!("memberHash" in result.body));
        assert.equal(verified, false, "토큰을 검증하지 않는다");
      }
    }
  } finally {
    console.error = quiet;
  }
  assert.ok(logged.length >= 1);
  for (const line of logged) {
    assert.match(line, /CHANNEL_TALK_MEMBER_HASH_SECRET is not configured/);
    assert.ok(!line.includes("valid-token") && !line.includes("uid-1"), "토큰·uid를 로그에 남기지 않는다");
  }
});

test("member-hash가 실패(503 등)하면 클라이언트는 해시 없이 회원 boot를 계속한다", async () => {
  const channel = fakeChannel();
  globalThis.fetch = (async () => ({ ok: false, status: 503, json: async () => ({ error: "Member hash is not configured" }) })) as unknown as typeof fetch;
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsMember("plugin-key", member as never, null, "id-token-1");
  const option = channel.of("boot")[0].args[0] as Record<string, unknown>;
  assert.equal(option.memberId, "uid-1");
  assert.ok(!("memberHash" in option));
  assert.equal(ct.getChannelTalkUserId(), "ch-user-1", "boot는 진행된다");
});
