// lastContactAt 실제 쓰기 1명 검증(로컬). 운영 웹훅(observe)과 무관하게, 지정한 테스트 고객 1명에게만 실행한다.
// 운영 웹훅과 같은 처리기(createWebhookHandler, on 모드)에 합성 메시지 이벤트 1건을 넣어 같은 쓰기 경로를 검증한다.
//
// 기본은 dry-run: 고객을 GET해 비공개 폴더에 백업하고 안전 검사만 한다(PATCH 없음).
// 실제 PATCH는 --confirm-write-production-single-user 가 있을 때만, 최대 1회.
//
//   export CHANNELTALK_TEST_ACCESS_KEY=...      # 셸 프로세스에서만. 파일·저장소에 두지 않는다
//   export CHANNELTALK_TEST_ACCESS_SECRET=...
//   node functions/scripts/channeltalk-last-contact-single-check.mjs \
//     --user-id-file ~/medidakos-private/<파일: 1줄 Channel 고객 id, 2줄 그 고객의 이메일> \
//     [--at 2026-10-21T01:00:00Z] [--confirm-write-production-single-user]
//
// 대상 확인: 파일 2줄의 이메일과 실제 고객 이메일이 같아야 실행한다(의도한 테스트 계정인지 확인, 값은 출력하지 않음).
//
// 콘솔에는 고객 id·이메일·이름·값을 출력하지 않는다. 필드 이름과 결과만 출력한다.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const { createChannelTalkApi } = require("../channeltalk/api.js");
const { normalizeEmail } = require("../channeltalk/email.js");
const { floorToMinute } = require("../channeltalk/field-types.js");
const { userEmail } = require("../channeltalk/identity.js");
const { compareUsers, createWebhookHandler, findTypeRisks } = require("../channeltalk/last-contact.js");
const { assertOutsideRepo, readOnlyFetch } = require("../channeltalk/migration-collect.js");

const home = (p) => path.resolve(p.replace(/^~(?=$|\/)/, homedir()));
const { values: args } = parseArgs({
  options: {
    "user-id-file": { type: "string" },
    at: { type: "string", default: "now" },
    out: { type: "string", default: path.join(homedir(), "medidakos-private", "channeltalk-v2-last-contact-test") },
    "confirm-write-production-single-user": { type: "boolean", default: false },
  },
});

function stop(message, code = 1) {
  console.error(message);
  process.exit(code);
}

if (!args["user-id-file"]) stop("--user-id-file <비공개 파일(1줄 고객 id, 2줄 이메일)> 이 필요합니다.");
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const idFile = home(args["user-id-file"]);
assertOutsideRepo(idFile, repoRoot);
const lines = readFileSync(idFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
if (lines.length !== 2 || !/^[A-Za-z0-9]{16,40}$/.test(lines[0]) || !normalizeEmail(lines[1])) {
  stop("고객 파일은 정확히 2줄이어야 합니다: 1줄 Channel 고객 id, 2줄 그 고객의 이메일.");
}
const userId = lines[0];
const expectedEmail = normalizeEmail(lines[1]);

const atMs = floorToMinute(args.at === "now" ? Date.now() : Date.parse(args.at));
if (!Number.isFinite(atMs)) stop("--at 형식이 올바르지 않습니다(ISO 또는 now).");

const accessKey = process.env.CHANNELTALK_TEST_ACCESS_KEY;
const accessSecret = process.env.CHANNELTALK_TEST_ACCESS_SECRET;
if (!accessKey || !accessSecret) stop("CHANNELTALK_TEST_ACCESS_KEY / CHANNELTALK_TEST_ACCESS_SECRET 가 필요합니다.");
const version = process.env.CHANNELTALK_INTAKE_API_VERSION || "2026-06-01";
const readApi = createChannelTalkApi({ accessKey, accessSecret, version, fetchImpl: readOnlyFetch(globalThis.fetch) });

const outRoot = home(args.out);
assertOutsideRepo(outRoot, repoRoot);
const confirm = args["confirm-write-production-single-user"];
const runDir = path.join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${confirm ? "write" : "dry-run"}`);
mkdirSync(runDir, { recursive: true, mode: 0o700 });
const save = (file, value) => writeFileSync(path.join(runDir, file), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

// 1) 쓰기 전 전체 GET + 백업
const before = await readApi.getUser(userId);
if (!before) stop("고객을 찾지 못했습니다(404). 실행하지 않습니다.");
save("before.json", before);

// 2) 안전 검사(운영 처리기와 같은 규칙 + 테스트 고객 확인)
const checks = {
  type: before.type || null,
  member: before.member === true,
  intendedAccount: normalizeEmail(userEmail(before)) === expectedEmail,
  typeRisks: findTypeRisks(before.profile),
  currentLastContactSet: Number.isFinite(before.profile && before.profile.lastContactAt),
  notNewer: Number.isFinite(before.profile && before.profile.lastContactAt) && floorToMinute(before.profile.lastContactAt) >= atMs,
  atMinute: new Date(atMs).toISOString(),
};
const blockers = [];
if (before.type === "unified") blockers.push("unified_user");
if (!checks.intendedAccount) blockers.push("email_mismatch");
if (checks.typeRisks.length > 0) blockers.push("type_risk");
if (checks.notNewer) blockers.push("not_newer");
save("checks.json", { ...checks, blockers });
console.log(JSON.stringify({ mode: confirm ? "write" : "dry-run", checks, blockers }, null, 2));
if (blockers.length > 0) stop(`실행하지 않습니다: ${blockers.join(", ")} (상세: ${runDir})`);
if (!confirm) {
  console.log(`dry-run: PATCH하지 않았습니다. 백업: ${runDir}`);
  process.exit(0);
}

// 3) 실제 실행: 지정 고객 1명, PATCH 최대 1회
const writeApi = createChannelTalkApi({ accessKey, accessSecret, version });
const gets = [];
let patches = 0;
const guardedApi = {
  async getUser(id) {
    if (id !== userId) throw new Error("지정하지 않은 고객 조회를 막았습니다");
    const user = await readApi.getUser(id);
    gets.push(user);
    return user;
  },
  async patchUser(id, body) {
    if (id !== userId) throw new Error("지정하지 않은 고객 쓰기를 막았습니다");
    if (patches >= 1) throw new Error("PATCH는 1회만 허용합니다");
    patches += 1;
    return writeApi.patchUser(id, body);
  },
};
const token = randomBytes(24).toString("hex");
const logs = [];
// 로컬 1명 검증은 운영 중단 플래그(Firestore)를 건드리지 않는다. 이상이 나면 이 스크립트가 직접 멈춘다.
const localControl = { isHalted: async () => false, halt: async () => {} };
const handler = createWebhookHandler({
  getMode: () => "on",
  getToken: () => token,
  getApi: () => guardedApi,
  getAllowList: () => userId,
  getControl: () => localControl,
  log: (entry) => logs.push(entry),
});
const event = {
  event: "push",
  type: "Message",
  entity: { chatType: "userChat", personType: "user", createdAt: atMs },
  refers: { user: { id: userId } },
};
await handler({ method: "POST", query: { auth: token }, headers: {}, body: event });

// 4) 다시 GET해 백업과 전체 비교
const after = await readApi.getUser(userId);
save("after.json", after);
const diff = compareUsers(before, after || {});
const result = {
  patches,
  handler: logs.map(({ outcome, skipReason, fields, metadata }) => ({ outcome, skipReason, fields, metadata })),
  unexpectedChanged: diff.unexpected,
  metadataChanged: diff.metadata,
  lastContactAtApplied: Boolean(after && after.profile && floorToMinute(after.profile.lastContactAt) === atMs),
};
save("result.json", result);
console.log(JSON.stringify(result, null, 2));
console.log(`결과: ${runDir}`);
const ok = patches <= 1 && result.unexpectedChanged.length === 0 && logs.at(-1)?.outcome === "updated" && result.lastContactAtApplied;
if (!ok) stop("예상과 다른 결과입니다. 추가 실행 없이 멈춥니다. before.json으로 복구 여부를 판단하세요.");
