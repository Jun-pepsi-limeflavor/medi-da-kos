/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { ChannelTalkApiError } = require("../channeltalk/api");
const {
  changedOtherFields, classifyEvent, compareUsers, createWebhookHandler, describeShape, findTypeRisks, normalizeMode, parseAllowList, verifyAuth,
} = require("../channeltalk/last-contact");

// 모두 가상 데이터다.
const NOW = Date.UTC(2026, 9, 19, 9, 0, 30);
const TOKEN = "t".repeat(32);

function message(entity = {}, refers = { user: { id: "u1" } }) {
  return {
    event: "push",
    type: "Message",
    entity: { chatType: "userChat", personType: "user", chatId: "c1", createdAt: NOW - 60_000 + 15_000, plainText: "secret body", ...entity },
    refers,
  };
}

test("모드는 off·observe·on만 받고 나머지는 off다", () => {
  assert.equal(normalizeMode("ON"), "on");
  assert.equal(normalizeMode(" observe "), "observe");
  assert.equal(normalizeMode("true"), "off");
  assert.equal(normalizeMode(undefined), "off");
});

test("인증은 16자 이상 기대값과 정확히 같을 때만 통과한다", () => {
  assert.equal(verifyAuth(TOKEN, TOKEN), true);
  assert.equal(verifyAuth("x", TOKEN), false);
  assert.equal(verifyAuth(undefined, TOKEN), false);
  assert.equal(verifyAuth("short", "short"), false);
  assert.equal(verifyAuth("", ""), false);
});

test("Channel 연동 이메일(writingType=email)은 고객·담당자 메일로 인정하고, 이메일 필드 이름만으로는 막지 않는다", () => {
  const customerMail = classifyEvent(message({ writingType: "email", email: { subject: "x" } }), { nowMs: NOW });
  assert.equal(customerMail.action, "update");
  assert.equal(customerMail.reason, "customer_email");
  const managerMail = classifyEvent(message({ personType: "manager", writingType: "email" }, { userChat: { userId: "u1" } }), { nowMs: NOW });
  assert.equal(managerMail.reason, "manager_email");
  const privateMail = classifyEvent(message({ personType: "manager", writingType: "email", options: ["private"] }), { nowMs: NOW });
  assert.equal(privateMail.reason, "private_note");
  assert.equal(classifyEvent(message({ writingType: "standard" }), { nowMs: NOW }).reason, "customer_message");
});

test("고객·담당자 실제 메시지만 갱신하고 시각은 분 단위로 내린다", () => {
  const customer = classifyEvent(message(), { nowMs: NOW });
  assert.deepEqual(customer, { action: "update", reason: "customer_message", userId: "u1", atMs: Date.UTC(2026, 9, 19, 8, 59) });
  const manager = classifyEvent(message({ personType: "manager", personId: "m9" }, { userChat: { userId: "u1" } }), { nowMs: NOW });
  assert.equal(manager.action, "update");
  assert.equal(manager.reason, "manager_message");
  assert.equal(manager.userId, "u1");
});

test("내부대화·봇·시스템 로그·팀챗은 제외하고, 근거가 부족하면 보류한다", () => {
  const cases = [
    [message({ personType: "bot", options: ["private", "silentToUser"] }), "ignore", "private_note"],
    [message({ personType: "manager", options: ["private"] }), "ignore", "private_note"],
    [message({ personType: "bot" }), "ignore", "bot"],
    [message({ log: { action: "open" } }), "ignore", "system_log"],
    [message({ chatType: "group" }), "ignore", "team_chat"],
    [{ ...message(), type: "UserChat" }, "ignore", "not_message_type"],
    [{ ...message(), event: "update" }, "hold", "unknown_event"],
    [message({ chatType: "other" }), "hold", "unknown_chat_type"],
    [message({ personType: "workflow" }), "hold", "unknown_person_type"],
    [message({ broadcastedMsg: true }), "ignore", "broadcast"],
    [message({ personType: "manager", broadcastedMsg: { id: "b1" } }), "ignore", "broadcast"],
    [message({ writingType: "workflow" }), "hold", "unknown_writing_type"],
    [message({}, {}), "hold", "no_user_id"],
    [message({}, { user: { id: "u1" }, userChat: { userId: "u2" } }), "hold", "user_ref_mismatch"],
    [message({ createdAt: (NOW - 60_000) * 1000 }), "hold", "invalid_created_at"],
    [message({ createdAt: "1760000000000" }), "hold", "invalid_created_at"],
    [null, "hold", "no_payload"],
  ];
  for (const [payload, action, reason] of cases) {
    assert.deepEqual(
      (({ action: a, reason: r }) => ({ action: a, reason: r }))(classifyEvent(payload, { nowMs: NOW })),
      { action, reason },
      reason,
    );
  }
});

test("형태 요약에는 값(본문·id)이 없고 키 이름과 헤더 이름만 있다", () => {
  const shape = describeShape(message({ options: ["private"] }), { "X-Signature": "abc", "Content-Type": "application/json" });
  const text = JSON.stringify(shape);
  assert.ok(!text.includes("secret body") && !text.includes("u1") && !text.includes("abc"));
  assert.deepEqual(shape.headerNames, ["content-type", "x-signature"]);
  assert.equal(shape.createdAtDigits, 13);
  assert.ok(shape.entityKeys.includes("plainText"));
});

test("타입이 틀린 필드를 찾고, 쓰기 전후 다른 필드 변화를 찾는다", () => {
  assert.deepEqual(findTypeRisks({ moq: "500", businessType: "Agency", lastContactAt: 1, name: "x" }), ["businessType", "moq"]);
  assert.deepEqual(findTypeRisks({ moq: 500, marketCountry: ["미국"], orderCount: null }), []);
  assert.deepEqual(changedOtherFields({ moq: "500", lastContactAt: 1 }, { moq: 0, lastContactAt: 2 }), ["moq"]);
  assert.deepEqual(changedOtherFields({ a: [1] }, { a: [1], lastContactAt: 5 }), []);
});

function fakeApi(users) {
  const state = structuredClone(users);
  const calls = [];
  return {
    state,
    calls,
    async getUser(id) {
      calls.push(["GET", id]);
      return state[id] ? structuredClone(state[id]) : null;
    },
    async patchUser(id, body) {
      calls.push(["PATCH", id, body]);
      state[id].profile = { ...state[id].profile, ...body.profile };
      return structuredClone(state[id]);
    },
  };
}

function fakeControl({ halted = false, failRead = false, failHalt = false } = {}) {
  const state = { halted, halts: [] };
  return {
    state,
    async isHalted() {
      if (failRead) throw new Error("firestore unavailable");
      return state.halted;
    },
    async halt(info) {
      if (failHalt) throw new Error("firestore unavailable");
      state.halted = true;
      state.halts.push(info);
    },
  };
}

function handler({ mode = "on", api = fakeApi({}), token = TOKEN, allow = "*", control = fakeControl(), noControl = false } = {}) {
  const logs = [];
  const handle = createWebhookHandler({
    getMode: () => mode, getToken: () => token, getApi: () => api, log: (e) => logs.push(e), now: () => NOW, getAllowList: () => allow,
    getControl: () => (noControl ? null : control),
  });
  return { handle, logs, api, control };
}
const req = (body, auth = TOKEN) => ({ method: "POST", query: { auth }, headers: {}, body });

test("인증되지 않은 요청과 off 모드는 아무것도 하지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: {} } });
  const h = handler({ api });
  assert.equal((await h.handle(req(message(), "wrong"))).status, 401);
  assert.equal((await h.handle({ ...req(message()), method: "GET" })).status, 405);
  assert.equal((await handler({ api, token: "" }).handle(req(message(), ""))).status, 401);
  assert.equal((await handler({ api, mode: "off" }).handle(req(message()))).body, "off");
  assert.equal((await handler({ api, mode: "garbage" }).handle(req(message()))).body, "off");
  assert.deepEqual(api.calls, []);
});

test("observe 모드는 판정과 형태만 남기고 Channel을 호출하지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: {} } });
  const h = handler({ api, mode: "observe" });
  await h.handle(req(message()));
  assert.deepEqual(api.calls, []);
  assert.equal(h.logs[0].outcome, "observed");
  assert.equal(h.logs[0].action, "update");
  assert.ok(!JSON.stringify(h.logs).includes("secret body"));
});

test("on 모드는 lastContactAt 하나만 보내고, 같거나 오래된 이벤트로는 되돌리지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500, name: "Kim" } } });
  const h = handler({ api });
  await h.handle(req(message()));
  const patches = api.calls.filter(([k]) => k === "PATCH");
  assert.deepEqual(patches[0][2], { profile: { lastContactAt: Date.UTC(2026, 9, 19, 8, 59) } });
  assert.equal(h.logs.at(-1).outcome, "updated");

  await h.handle(req(message()));
  await h.handle(req(message({ createdAt: NOW - 3_600_000 })));
  assert.equal(api.calls.filter(([k]) => k === "PATCH").length, 1);
  assert.deepEqual(h.logs.slice(-2).map((l) => l.skipReason), ["not_newer", "not_newer"]);
  assert.equal(api.state.u1.profile.lastContactAt, Date.UTC(2026, 9, 19, 8, 59));
  assert.equal(api.state.u1.profile.moq, 500);
});

test("타입이 틀린 필드가 있거나 고객이 없거나 통합됐으면 쓰지 않는다", async () => {
  const api = fakeApi({
    u1: { id: "u1", profile: { moq: "TBD" } },
    u2: { id: "u2", type: "unified", unifiedId: "u3", profile: {} },
  });
  const h = handler({ api });
  await h.handle(req(message()));
  await h.handle(req(message({}, { user: { id: "u2" } })));
  await h.handle(req(message({}, { user: { id: "u9" } })));
  assert.deepEqual(h.logs.map((l) => l.skipReason), ["type_risk", "user_unified", "user_missing"]);
  assert.deepEqual(h.logs[0].fields, ["moq"]);
  assert.equal(api.calls.filter(([k]) => k === "PATCH").length, 0);
});

test("쓰기 후 다른 필드가 바뀌면 경고하고, 이 인스턴스는 이후 쓰지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500 } }, u2: { id: "u2", profile: {} } });
  const coercing = {
    ...api,
    async patchUser(id, body) {
      const user = await api.patchUser(id, body);
      api.state[id].profile.moq = 0; // Channel이 저장 시 다른 필드를 변환한 경우
      return user; // 응답은 변환 전 상태
    },
  };
  const h = handler({ api: coercing });
  await h.handle(req(message()));
  assert.equal(h.logs[0].outcome, "alert");
  assert.deepEqual(h.logs[0].fields, ["profile.moq"]);
  await h.handle(req(message({}, { user: { id: "u2" } })));
  assert.equal(h.logs[1].mode, "observe");
  assert.equal(api.calls.filter(([k, id]) => k === "PATCH" && id === "u2").length, 0);
});

test("API 오류는 재시도하지 않고 200으로 기록만 한다", async () => {
  const failing = { async getUser() { throw new ChannelTalkApiError("GET 503", { code: "server_error", ambiguous: true }); }, async patchUser() {} };
  const h = handler({ api: failing });
  const res = await h.handle(req(message()));
  assert.equal(res.status, 200);
  assert.deepEqual([h.logs[0].outcome, h.logs[0].skipReason], ["error", "server_error"]);
});

test("수신 함수는 index.js에서 내보내고, 단일 인스턴스·공개 호출·기본 off로 설정돼 있다", () => {
  const index = readFileSync(path.join(__dirname, "../index.js"), "utf8");
  assert.match(index, /require\("\.\/channeltalk\/last-contact-trigger"\)/);
  const trigger = readFileSync(path.join(__dirname, "../channeltalk/last-contact-trigger.js"), "utf8");
  assert.match(trigger, /maxInstances: 1/);
  assert.match(trigger, /concurrency: 1/);
  assert.match(trigger, /CHANNELTALK_LAST_CONTACT_MODE", \{ default: "off" \}/);
  const { channelTalkLastContactWebhook } = require("../channeltalk/last-contact-trigger");
  assert.equal(typeof channelTalkLastContactWebhook, "function");
});

test("쓰기 후 비교는 응답이 아니라 다시 읽은 값으로 하고, 최상위 고객 정보 변화도 이상으로 본다", async () => {
  const api = fakeApi({ u1: { id: "u1", name: "Kim", tags: ["a", "b"], updatedAt: 1, profile: { moq: 500 } } });
  const renaming = {
    ...api,
    async patchUser(id, body) {
      const user = await api.patchUser(id, body);
      Object.assign(api.state[id], { name: "Changed", updatedAt: 2 });
      return user;
    },
  };
  const h = handler({ api: renaming });
  await h.handle(req(message()));
  assert.equal(h.logs[0].outcome, "alert");
  assert.deepEqual(h.logs[0].fields, ["name"]);
  assert.deepEqual(h.logs[0].metadata, ["updatedAt"]);
  assert.equal(renaming.calls.filter(([k]) => k === "GET").length, 2);
});

test("전체 비교: 메타데이터·태그 순서는 정상, 모르는 최상위 필드 변화는 이상", () => {
  const before = { id: "u1", name: "Kim", tags: ["a", "b"], updatedAt: 1, version: 3, profile: { moq: 500, lastContactAt: 1 } };
  const ok = compareUsers(before, { ...before, tags: ["b", "a"], updatedAt: 2, version: 4, profile: { moq: 500, lastContactAt: 2 } });
  assert.deepEqual(ok.unexpected, []);
  assert.deepEqual(ok.metadata, ["updatedAt", "version"]);
  const bad = compareUsers(before, { ...before, someNewFlag: true, profile: { moq: 0, lastContactAt: 2 } });
  assert.deepEqual(bad.unexpected, ["profile.moq", "someNewFlag"]);
});

test("쓴 뒤 고객을 다시 읽지 못하면 이상으로 보고 이후 쓰지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: {} }, u2: { id: "u2", profile: {} } });
  const vanishing = {
    ...api,
    async patchUser(id, body) {
      const user = await api.patchUser(id, body);
      delete api.state[id];
      return user;
    },
  };
  const h = handler({ api: vanishing });
  await h.handle(req(message()));
  assert.deepEqual([h.logs[0].outcome, h.logs[0].skipReason], ["alert", "user_missing_after_patch"]);
  await h.handle(req(message({}, { user: { id: "u2" } })));
  assert.equal(h.logs[1].mode, "observe");
});

test("1명 검증 스크립트: 기본 dry-run, 명시 승인 옵션, 지정 고객·PATCH 1회 제한, 저장소 밖 백업, id·이메일 미출력", () => {
  const source = readFileSync(path.join(__dirname, "../scripts/channeltalk-last-contact-single-check.mjs"), "utf8");
  assert.match(source, /"confirm-write-production-single-user": \{ type: "boolean", default: false \}/);
  assert.match(source, /if \(!confirm\) \{\n\s+console\.log\(`dry-run: PATCH하지 않았습니다/);
  assert.match(source, /if \(patches >= 1\) throw new Error\("PATCH는 1회만 허용합니다"\)/);
  assert.match(source, /if \(id !== userId\) throw new Error\("지정하지 않은 고객 쓰기를 막았습니다"\)/);
  assert.match(source, /fetchImpl: readOnlyFetch\(globalThis\.fetch\)/);
  assert.match(source, /assertOutsideRepo\(outRoot, repoRoot\)/);
  assert.match(source, /assertOutsideRepo\(idFile, repoRoot\)/);
  // 대상 확인은 이메일 형식이 아니라, 사용자가 비공개 파일에 적은 이메일과의 일치로 한다.
  assert.match(source, /intendedAccount: normalizeEmail\(userEmail\(before\)\) === expectedEmail/);
  assert.match(source, /if \(!checks\.intendedAccount\) blockers\.push\("email_mismatch"\)/);
  assert.doesNotMatch(source, /isAllowedTestEmail|allow-non-test-email/);
  const consoleLines = source.split("\n").filter((line) => /console\.(log|error)\(/.test(line));
  assert.ok(consoleLines.every((line) => !/userId|expectedEmail|userEmail\(|before\.name|profile\.email/.test(line)), consoleLines.join("\n"));
});

test("허용 목록: 비어 있으면 아무에게도 쓰지 않고, 목록 고객만 쓰며, *이면 전체다", async () => {
  assert.deepEqual([...parseAllowList(" u1, u2 ,").ids], ["u1", "u2"]);
  assert.equal(parseAllowList("*").all, true);
  assert.equal(parseAllowList(undefined).ids.size, 0);

  const users = { u1: { id: "u1", profile: {} }, u2: { id: "u2", profile: {} } };
  const none = handler({ api: fakeApi(users), allow: "" });
  await none.handle(req(message()));
  assert.deepEqual(none.api.calls, []);
  assert.equal(none.logs[0].skipReason, "not_allowlisted");

  const one = handler({ api: fakeApi(users), allow: "u2" });
  await one.handle(req(message()));
  await one.handle(req(message({}, { user: { id: "u2" } })));
  assert.deepEqual(one.api.calls.filter(([k]) => k === "PATCH").map(([, id]) => id), ["u2"]);
  assert.deepEqual(one.logs.map((l) => l.outcome), ["observed", "updated"]);
});

test("Firebase 매핑 없이 Channel 고객 id만으로 처리한다(매핑·정책 파일을 읽지 않음)", () => {
  const source = readFileSync(path.join(__dirname, "../channeltalk/last-contact.js"), "utf8");
  assert.doesNotMatch(source, /firebase-admin|channelTalkIdentities|getMapping|policy/i);
  const trigger = readFileSync(path.join(__dirname, "../channeltalk/last-contact-trigger.js"), "utf8");
  assert.match(trigger, /CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS", \{ default: "" \}/);
});

// ── 중단 플래그(Firestore) ───────────────────────────────────────────────

test("중단 상태이거나 플래그를 읽지 못하거나 플래그가 없으면 Channel을 호출하지 않는다(fail-closed)", async () => {
  const users = { u1: { id: "u1", profile: {} } };
  for (const [opts, reason] of [
    [{ control: fakeControl({ halted: true }) }, "halted"],
    [{ control: fakeControl({ failRead: true }) }, "halt_check_failed"],
    [{ noControl: true }, "no_halt_control"],
  ]) {
    const h = handler({ api: fakeApi(users), ...opts });
    await h.handle(req(message()));
    assert.deepEqual(h.api.calls, [], reason);
    assert.equal(h.logs[0].skipReason, reason);
  }
});

test("observe·off 모드는 중단 플래그도 Channel도 건드리지 않는다", async () => {
  for (const mode of ["observe", "off"]) {
    let touched = 0;
    const control = { isHalted: async () => { touched += 1; return false; }, halt: async () => { touched += 1; } };
    const h = handler({ mode, api: fakeApi({ u1: { id: "u1", profile: {} } }), control });
    await h.handle(req(message()));
    assert.equal(touched, 0, mode);
    assert.deepEqual(h.api.calls, [], mode);
  }
});

test("쓰기 후 이상을 감지하면 중단 플래그를 기록하고, 새 인스턴스도 그 플래그로 쓰지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500 } }, u2: { id: "u2", profile: {} } });
  const coercing = {
    ...api,
    async patchUser(id, body) {
      const user = await api.patchUser(id, body);
      api.state[id].profile.moq = 0;
      return user;
    },
  };
  const control = fakeControl();
  const first = handler({ api: coercing, control });
  await first.handle(req(message()));
  assert.equal(control.state.halted, true);
  assert.deepEqual(control.state.halts[0], { reason: "other_fields_changed", fields: ["profile.moq"], channelUserId: "u1", nowMs: NOW });

  // 재시작된 인스턴스(메모리 상태 없음)도 Firestore 플래그 때문에 쓰지 않는다.
  const restarted = handler({ api: coercing, control });
  await restarted.handle(req(message({}, { user: { id: "u2" } })));
  assert.equal(restarted.logs[0].skipReason, "halted");
  assert.equal(api.calls.filter(([k, id]) => k === "PATCH" && id === "u2").length, 0);
});

test("중단 기록에 실패해도 이 인스턴스는 쓰기를 멈추고 오류를 남긴다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500 } }, u2: { id: "u2", profile: {} } });
  const coercing = { ...api, async patchUser(id, body) { const u = await api.patchUser(id, body); api.state[id].profile.moq = 0; return u; } };
  const h = handler({ api: coercing, control: fakeControl({ failHalt: true }) });
  await h.handle(req(message()));
  assert.deepEqual(h.logs.map((l) => l.skipReason), ["halt_record_failed", "other_fields_changed"]);
  await h.handle(req(message({}, { user: { id: "u2" } })));
  assert.equal(h.logs.at(-1).mode, "observe");
});

// 최소한의 가짜 Firestore(문서 하나)
function fakeDb({ failGet = false } = {}) {
  const docs = new Map();
  const ref = (path) => ({
    path,
    async get() {
      if (failGet) throw new Error("unavailable");
      const data = docs.get(path);
      return { exists: Boolean(data), data: () => data, get: (k) => (data ? data[k] : undefined) };
    },
    async set(value, { merge } = {}) {
      docs.set(path, merge ? { ...(docs.get(path) || {}), ...resolve(docs.get(path), value) } : resolve(undefined, value));
    },
  });
  const resolve = (prev, value) => Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v && v.__inc ? ((prev && prev[k]) || 0) + v.__inc : v]));
  return {
    docs,
    collection: (c) => ({ doc: (d) => ref(`${c}/${d}`) }),
    async runTransaction(fn) {
      return fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) });
    },
  };
}
const fakeTs = { fromMillis: (ms) => ({ toMillis: () => ms }) };
const fakeFv = { increment: (n) => ({ __inc: n }) };

test("중단 플래그 문서: 없으면 중단 아님, halt는 최초 사유 유지·횟수 증가, resume은 관리자 이름 필요, 손상 값은 중단 취급", async () => {
  const { createLastContactControl, COLLECTION, DOC_ID } = require("../channeltalk/last-contact-control");
  assert.equal(`${COLLECTION}/${DOC_ID}`, "channelTalkControl/lastContact");
  const db = fakeDb();
  const control = createLastContactControl(db, { Timestamp: fakeTs, FieldValue: fakeFv });
  assert.equal(await control.isHalted(), false);

  await control.halt({ reason: "other_fields_changed", fields: ["profile.moq"], channelUserId: "u1", nowMs: 1 });
  await control.halt({ reason: "user_missing_after_patch", fields: [], channelUserId: "u2", nowMs: 2 });
  assert.equal(await control.isHalted(), true);
  const status = await control.status();
  assert.deepEqual([status.reason, status.fields, status.haltCount], ["other_fields_changed", ["profile.moq"], 2]);
  assert.equal("channelUserId" in status, false);

  await assert.rejects(control.resume({ resumedBy: " ", nowMs: 3 }), /resumedBy/);
  await control.resume({ resumedBy: "admin", nowMs: 3 });
  assert.equal(await control.isHalted(), false);

  db.docs.set("channelTalkControl/lastContact", { halted: "no" });
  assert.equal(await control.isHalted(), true);
  await assert.rejects(createLastContactControl(fakeDb({ failGet: true }), { Timestamp: fakeTs, FieldValue: fakeFv }).isHalted(), /unavailable/);
});

// ── 여러 상담방(유저챗) 처리: lastContactAt은 고객 단위 ──────────────────────

const at = (h, m) => Date.UTC(2026, 9, 19, h, m);
/** 상담방 chatId의 메시지. 고객 id는 refers.userChat.userId(담당자 답변 형태)로도 줄 수 있다. */
function chatMessage(chatId, createdAt, { userId = "u1", personType = "user", options, viaUserChat = false } = {}) {
  const refers = viaUserChat ? { userChat: { id: chatId, userId } } : { user: { id: userId }, userChat: { id: chatId, userId } };
  return message({ chatId, createdAt, personType, ...(options ? { options } : {}) }, refers);
}
const patchedValues = (api, id = "u1") => api.calls.filter(([k, uid]) => k === "PATCH" && uid === id).map(([, , b]) => b.profile.lastContactAt);

test("상담방 A·B에서 번갈아 온 메시지는 고객 하나의 최신 시각만 남긴다", async () => {
  const h = handler({ api: fakeApi({ u1: { id: "u1", profile: {} } }) });
  await h.handle(req(chatMessage("chatA", at(8, 50))));
  await h.handle(req(chatMessage("chatB", at(8, 58), { personType: "manager", viaUserChat: true })));
  await h.handle(req(chatMessage("chatA", at(8, 55))));
  assert.deepEqual(patchedValues(h.api), [at(8, 50), at(8, 58)]);
  assert.equal(h.api.state.u1.profile.lastContactAt, at(8, 58));
  assert.equal(h.logs.at(-1).skipReason, "not_newer");
});

test("늦게 도착한 과거 이벤트와 같은 분의 이벤트로는 되돌리거나 다시 쓰지 않는다", async () => {
  const h = handler({ api: fakeApi({ u1: { id: "u1", profile: {} } }) });
  await h.handle(req(chatMessage("chatB", at(8, 58) + 40_000)));
  await h.handle(req(chatMessage("chatA", at(8, 50))));
  await h.handle(req(chatMessage("chatA", at(8, 58) + 5_000)));
  assert.deepEqual(patchedValues(h.api), [at(8, 58)]);
  assert.deepEqual(h.logs.slice(1).map((l) => l.skipReason), ["not_newer", "not_newer"]);
});

test("거의 동시에 도착한 두 상담방 이벤트도 순서대로 처리돼 날짜가 역행하지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: {} } });
  const slow = {
    ...api,
    async getUser(id) { await new Promise((r) => setTimeout(r, 5)); return api.getUser(id); },
    async patchUser(id, body) { await new Promise((r) => setTimeout(r, body.profile.lastContactAt === at(8, 50) ? 20 : 1)); return api.patchUser(id, body); },
  };
  const h = handler({ api: slow });
  await Promise.all([h.handle(req(chatMessage("chatB", at(8, 58)))), h.handle(req(chatMessage("chatA", at(8, 50))))]);
  assert.equal(api.state.u1.profile.lastContactAt, at(8, 58));
  assert.deepEqual(patchedValues(api), [at(8, 58)]);
});

test("다른 상담방의 내부대화·봇·시스템 메시지는 시각을 바꾸지 않는다", async () => {
  const h = handler({ api: fakeApi({ u1: { id: "u1", profile: { lastContactAt: at(8, 0) } } }) });
  await h.handle(req(chatMessage("chatB", at(8, 59), { personType: "manager", options: ["private"] })));
  await h.handle(req(chatMessage("chatB", at(8, 59), { personType: "bot" })));
  await h.handle(req(message({ chatId: "chatB", createdAt: at(8, 59), log: { action: "close" } })));
  assert.deepEqual(h.api.calls, []);
  assert.equal(h.api.state.u1.profile.lastContactAt, at(8, 0));
});

test("서로 다른 고객은 각자 값만 바뀌고, 고객 참조가 어긋나면 어느 쪽도 쓰지 않는다", async () => {
  const h = handler({ api: fakeApi({ u1: { id: "u1", profile: {} }, u2: { id: "u2", profile: {} } }) });
  await h.handle(req(chatMessage("chatA", at(8, 50), { userId: "u1" })));
  await h.handle(req(chatMessage("chatB", at(8, 58), { userId: "u2" })));
  await h.handle(req(message({ chatId: "chatC", createdAt: at(8, 59) }, { user: { id: "u1" }, userChat: { id: "chatC", userId: "u2" } })));
  assert.equal(h.api.state.u1.profile.lastContactAt, at(8, 50));
  assert.equal(h.api.state.u2.profile.lastContactAt, at(8, 58));
  assert.equal(h.logs.at(-1).reason, "user_ref_mismatch");
});

test("허용 목록·중단 플래그는 상담방과 상관없이 고객 단위로 적용된다", async () => {
  const users = { u1: { id: "u1", profile: {} }, u2: { id: "u2", profile: {} } };
  const allowed = handler({ api: fakeApi(users), allow: "u1" });
  await allowed.handle(req(chatMessage("chatB", at(8, 58), { userId: "u1" })));
  await allowed.handle(req(chatMessage("chatA", at(8, 58), { userId: "u2" })));
  assert.deepEqual(allowed.api.calls.filter(([k]) => k === "PATCH").map(([, id]) => id), ["u1"]);

  const halted = handler({ api: fakeApi(users), control: fakeControl({ halted: true }) });
  await halted.handle(req(chatMessage("chatA", at(8, 58))));
  await halted.handle(req(chatMessage("chatB", at(8, 59))));
  assert.deepEqual(halted.api.calls, []);
  assert.deepEqual(halted.logs.map((l) => l.skipReason), ["halted", "halted"]);
});

test("이상 감지 뒤 대기 중이던 다른 상담방 이벤트도 쓰지 않는다", async () => {
  const api = fakeApi({ u1: { id: "u1", profile: { moq: 500 } } });
  const coercing = { ...api, async patchUser(id, body) { const u = await api.patchUser(id, body); api.state[id].profile.moq = 0; return u; } };
  const control = fakeControl();
  const h = handler({ api: coercing, control });
  await Promise.all([h.handle(req(chatMessage("chatA", at(8, 50)))), h.handle(req(chatMessage("chatB", at(8, 58))))]);
  assert.equal(patchedValues(api).length, 1);
  assert.deepEqual(h.logs.map((l) => l.skipReason), ["other_fields_changed", "tripped"]);
  assert.equal(control.state.halted, true);
});

// ── 정상 자동 갱신(방문·메신저 활동)과 실제 손상 구분 ─────────────────────────

const visitorUser = () => ({
  id: "u1",
  city: "Seoul",
  latitude: 37.5,
  longitude: 127,
  managedKey: 10,
  sessionsCount: 3,
  web: { browser: "Chrome", lastSeenAt: 1, sessionsCount: 3, os: "macOS" },
  profile: { moq: 500, marketCountry: ["미국"], orderCount: 2, analyticsId: "a1", gaClientId: "g1" },
});
/** 쓰기 직후 다시 읽을 때 visit(state)로 값을 바꾸는 가짜 Channel. */
function visitingApi(visit) {
  const api = fakeApi({ u1: visitorUser() });
  return {
    api,
    client: {
      ...api,
      async patchUser(id, body) {
        const user = await api.patchUser(id, body);
        visit(api.state[id]);
        return user;
      },
    },
  };
}

test("방문·팝업으로 자동 갱신된 필드는 중단하지 않고 updated와 함께 이름만 로그에 남긴다", async () => {
  const { client } = visitingApi((u) => {
    Object.assign(u, { city: "Busan", latitude: 35.1, longitude: 129, popUpChatId: "chat9", sessionsCount: 4, lastSeenAt: 2 });
    Object.assign(u.web, { browser: "Safari", lastSeenAt: 2, sessionsCount: 4 });
    Object.assign(u.profile, { analyticsId: "a2", gaClientId: "g2" });
  });
  const control = fakeControl();
  const h = handler({ api: client, control });
  await h.handle(req(message()));
  const entry = h.logs.at(-1);
  assert.equal(entry.outcome, "updated");
  assert.deepEqual(entry.auto, ["city", "latitude", "longitude", "popUpChatId", "profile.analyticsId", "profile.gaClientId", "web.browser", "web.lastSeenAt", "web.sessionsCount"]);
  assert.equal(control.state.halted, false);
  assert.ok(!JSON.stringify(h.logs).includes("Busan") && !JSON.stringify(h.logs).includes("a2"));
});

test("자동 갱신 필드라도 타입이 바뀌거나 지워지면 손상으로 보고 중단한다", async () => {
  const cases = [
    [(u) => { u.latitude = "35.1"; }, ["latitude"]],
    [(u) => { delete u.profile.analyticsId; }, ["profile.analyticsId"]],
    [(u) => { u.city = null; }, ["city"]],
    [(u) => { u.web.os = "Windows"; }, ["web.os"]],
    [(u) => { u.web = "gone"; }, ["web"]],
  ];
  for (const [visit, fields] of cases) {
    const { client } = visitingApi(visit);
    const control = fakeControl();
    const h = handler({ api: client, control });
    await h.handle(req(message()));
    assert.equal(h.logs.at(-1).outcome, "alert", fields.join());
    assert.deepEqual(h.logs.at(-1).fields, fields);
    assert.equal(control.state.halted, true);
  }
});

test("의미를 확인하지 못한 managedKey와 업무 필드(moq·marketCountry·orderCount) 변화는 계속 손상으로 본다", async () => {
  const cases = [
    [(u) => { u.managedKey = 11; }, ["managedKey"]],
    [(u) => { u.profile.moq = 0; }, ["profile.moq"]],
    [(u) => { u.profile.marketCountry = []; }, ["profile.marketCountry"]],
    [(u) => { u.profile.orderCount = "2"; }, ["profile.orderCount"]],
  ];
  for (const [visit, fields] of cases) {
    const { client } = visitingApi(visit);
    const h = handler({ api: client });
    await h.handle(req(message()));
    assert.equal(h.logs.at(-1).outcome, "alert", fields.join());
    assert.deepEqual(h.logs.at(-1).fields, fields);
  }
});

test("자동 갱신과 실제 손상이 함께 생기면 손상만 이상으로, 자동 갱신은 따로 남긴다", async () => {
  const { client } = visitingApi((u) => {
    u.city = "Busan";
    u.profile.gaClientId = "g2";
    u.profile.moq = 0;
  });
  const control = fakeControl();
  const h = handler({ api: client, control });
  await h.handle(req(message()));
  const entry = h.logs.at(-1);
  assert.equal(entry.outcome, "alert");
  assert.deepEqual(entry.fields, ["profile.moq"]);
  assert.deepEqual(entry.auto, ["city", "profile.gaClientId"]);
  assert.deepEqual(control.state.halts[0].fields, ["profile.moq"]);
});

test("compareUsers: 자동 갱신 분류 규칙", () => {
  const before = visitorUser();
  const after = structuredClone(before);
  Object.assign(after, { popUpChatId: "c1", longitude: 128 });
  after.web.lastSeenAt = 9;
  after.profile.lastContactAt = 5;
  const diff = compareUsers(before, after);
  assert.deepEqual(diff.unexpected, []);
  assert.deepEqual(diff.auto, ["longitude", "popUpChatId", "web.lastSeenAt"]);
  delete after.web.browser;
  assert.deepEqual(compareUsers(before, after).unexpected, ["web.browser"]);
});
