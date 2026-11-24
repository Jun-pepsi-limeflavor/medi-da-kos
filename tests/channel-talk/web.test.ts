// 웹 → Channel Talk 연동(설계 10장): 회원 boot는 신원만, 제출 문서의 channelUserId·uid,
// member-hash 본인 인증.
// channel-talk.ts는 SDK 로더가 window.ChannelIO만 부르므로, window를 가짜로 두고 호출을 기록한다.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import {
  channelUserIdField,
  contactIdentityFields,
  gaBootProfile,
} from "../../src/lib/channel-talk/intake.ts";
import { hashMemberId, memberHashResponse } from "../../src/lib/channel-talk/member-hash.ts";

register("../esm-alias-loader.mjs", import.meta.url);

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
  return import(`../../src/lib/channel-talk/client.ts?case=${instance}`) as Promise<typeof import("../../src/lib/channel-talk/client.ts")>;
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

// ---- W4 로그인 Contact uid ----

test("Contact: 로그인 회원은 본인 uid와 Channel 고객 id를 넣는다", () => {
  assert.deepEqual(contactIdentityFields({ uid: "uid-1", channelUserId: "ch-1" }), { uid: "uid-1", channelUserId: "ch-1" });
});

test("Contact: 비로그인이면 uid를 넣지 않고, Channel 고객 id가 없어도 된다", () => {
  assert.deepEqual(contactIdentityFields({ uid: null, channelUserId: "ch-1" }), { channelUserId: "ch-1" });
  assert.deepEqual(contactIdentityFields({ uid: undefined, channelUserId: null }), {});
  assert.deepEqual(contactIdentityFields({ uid: "", channelUserId: "" }), {});
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

// ---- 런처 표시 조건(2026-11-13): SDK 연결 성공 중에만 ready ----

test("런처 ready: boot 성공 때 true, shutdown·재연결 중·boot 실패 때 false", async () => {
  // The launcher store is shared by every client instance in this file; start from "not booted".
  const { isChannelReady, setChannelReady } = await import("../../src/lib/channel-talk/launcher.ts");
  setChannelReady(false);
  stubFetch();
  fakeChannel({ bootUser: { id: "anon-1" } });
  const ct = await freshChannelTalk();
  assert.equal(isChannelReady(), false, "before boot");
  await ct.bootChannelTalkAsAnonymous("plugin-key", null);
  assert.equal(isChannelReady(), true, "after anonymous boot");

  // Login: the SDK is shut down first (launcher hidden), then booted as the member (shown again).
  const states: boolean[] = [];
  const { ChannelIO } = (globalThis as unknown as { window: { ChannelIO: (m: string, ...a: unknown[]) => void } }).window;
  (globalThis as unknown as { window: unknown }).window = {
    ChannelIO: (method: string, ...args: unknown[]) => {
      if (method === "shutdown" || method === "boot") states.push(isChannelReady());
      ChannelIO(method, ...args);
    },
  };
  await ct.bootChannelTalkAsMember("plugin-key", member, null, "id-token");
  assert.deepEqual(states, [true, false], "ready while booted, false once shut down before the member boot");
  assert.equal(isChannelReady(), true, "after member boot");

  ct.shutdownChannelTalk();
  assert.equal(isChannelReady(), false, "after logout shutdown");

  fakeChannel({ bootError: new Error("blocked") });
  const failed = await freshChannelTalk();
  const quiet = console.error;
  console.error = () => {};
  try {
    await failed.bootChannelTalkAsAnonymous("plugin-key", null);
  } finally {
    console.error = quiet;
  }
  assert.equal(isChannelReady(), false, "after a failed boot");
});

test("boot은 SDK 기본 버튼을 숨기고 customLauncherSelector는 넘기지 않는다(사이트 런처가 직접 열고 닫음)", async () => {
  const channel = fakeChannel();
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsAnonymous("plugin-key", null);
  const option = channel.of("boot")[0].args[0] as Record<string, unknown>;
  assert.equal(option.hideChannelButtonOnBoot, true);
  assert.ok(!("customLauncherSelector" in option));
});

// ---- 쿠키 동의(2026-11-23): 상담·식별은 그대로, 추적 옵션만 Marketing 동의 ----

function consentStorage(choices: { analytics: boolean; marketing: boolean } | null) {
  const raw = choices
    ? JSON.stringify({ version: 2, ...choices, savedAt: "2026-11-23T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" })
    : null;
  return { getItem: (key: string) => (key === "mdk:cookie-consent" ? raw : null), setItem() {}, removeItem() {} };
}

test("Marketing 동의가 없으면 boot는 그대로 하되 PageView·UTM 추적과 라우트 PageView를 끈다", async () => {
  const channel = fakeChannel();
  (globalThis as { window: Record<string, unknown> }).window.localStorage = consentStorage(null);
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsAnonymous("plugin-key", null);
  const option = channel.of("boot")[0].args[0] as Record<string, unknown>;
  assert.equal(option.pluginKey, "plugin-key");
  assert.equal(option.trackDefaultEvent, false);
  assert.equal(option.trackUtmSource, false);
  assert.ok(!("hidePopup" in option), "상담 알림 팝업은 숨기지 않는다");
  ct.syncChannelTalkRoute("/contact");
  assert.equal(channel.of("setPage").length, 1);
  assert.equal(channel.of("track").length, 0);
});

test("Marketing 동의가 있으면 Channel Talk 추적 옵션과 라우트 PageView를 켠다", async () => {
  const channel = fakeChannel();
  (globalThis as { window: Record<string, unknown> }).window.localStorage = consentStorage({ analytics: false, marketing: true });
  const ct = await freshChannelTalk();
  await ct.bootChannelTalkAsAnonymous("plugin-key", null);
  const option = channel.of("boot")[0].args[0] as Record<string, unknown>;
  assert.equal(option.trackDefaultEvent, true);
  assert.equal(option.trackUtmSource, true);
  ct.syncChannelTalkRoute("/contact");
  assert.deepEqual(channel.of("track").map((c) => c.args[0]), ["PageView"]);
});
