// V2 기존 고객 프로필 이관 실행. 운영 Channel 프로필(빈 칸만)과 Firestore channelTalkIdentities에 쓴다.
// 판정: functions/channeltalk/migration-plan.js(dry-run), 실행: functions/channeltalk/migration-apply.js
// 계획: docs/plans/2026-10-19-channeltalk-v2.md
//
// 운영 쓰기이므로 모드마다 별도 승인 후에만 실행한다.
//   1) --preview: API·Firestore 호출 없이 대상 건수만 본다(키 불필요).
//   2) --mode pilot: 보류 고객을 뺀 최대 5명. 끝나면 Desk에서 결과를 확인한다.
//   3) --mode full: 나머지 전체. 이전 실행 로그를 --done-log로 넘겨 끝난 고객을 건너뛴다.
//   신규 생성(이관과 별도 승인):
//   4) --mode create-member: @uid가 지금도 없는 회원만 PUT @uid { profile: { firebaseUid } }로 만든다.
//   5) --mode create-lead: 리드를 POST로 만든다. --desk-checked-at(12시간 이내 Desk 이메일 검색 시각)이 필요하다.
//      둘 다 --allow-keys(사람이 확인한 고객 키 JSON 배열, 비공개 폴더)가 필요하고, --pilot이면 최대 2명이다.
//      생성 요청 전 intent를 로그에 남기며, 결과를 알 수 없는 고객은 다음 실행에서 자동으로 다시 만들지 않는다.
//   모든 모드에 --policy-exclude <V2 이관 제외 정책 JSON(비공개)>이 필요하다. 정책 고객은 판정과 상관없이 처리하지 않는다.
//
//   gcloud auth application-default login            # Firestore 쓰기 권한이 있는 계정
//   export CHANNELTALK_MIGRATION_ACCESS_KEY=...       # 셸 프로세스에서만. 파일·저장소에 두지 않는다
//   export CHANNELTALK_MIGRATION_ACCESS_SECRET=...
//   node functions/scripts/channeltalk-migration-apply.mjs \
//     --plan-dir ~/medidakos-private/channeltalk-v2-dry-run/<dry-run 폴더> \
//     --exclusion ~/medidakos-private/channeltalk-v1-hold-2026-10-12/v2-test-exclusion-ids.json \
//     --mode pilot [--limit 3] [--done-log <이전 apply-log.jsonl> ...] [--max-skips 3] \
//     [--max-plan-age-hours 24] --confirm-write-production
//
// 콘솔에는 건수와 로그 경로만 출력한다. 건별 결과는 비공개 폴더의 apply-log.jsonl(권한 600)에 남는다.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { createChannelTalkApi } = require("../channeltalk/api.js");
const { assertOutsideRepo, normalizeExclusion, redactError } = require("../channeltalk/migration-collect.js");
const {
  createCustomer, loadPolicy, policyKeys, readLogState, runApply, selectCreateTargets, selectTargets,
} = require("../channeltalk/migration-apply.js");
const { createStore } = require("../channeltalk/store.js");

const PROJECT_ID = "medidakos";
const home = (p) => path.resolve(p.replace(/^~(?=$|\/)/, homedir()));

const { values: args } = parseArgs({
  options: {
    "plan-dir": { type: "string" },
    exclusion: { type: "string" },
    mode: { type: "string" },
    limit: { type: "string" },
    "done-log": { type: "string", multiple: true, default: [] },
    "max-skips": { type: "string" },
    "max-plan-age-hours": { type: "string", default: "24" },
    out: { type: "string", default: path.join(homedir(), "medidakos-private", "channeltalk-v2-apply") },
    preview: { type: "boolean", default: false },
    pilot: { type: "boolean", default: false },
    "allow-keys": { type: "string" },
    "desk-checked-at": { type: "string" },
    "member-email": { type: "boolean", default: false },
    "policy-exclude": { type: "string" },
    "confirm-write-production": { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!args["plan-dir"] || !args.exclusion) fail("--plan-dir 와 --exclusion 이 필요합니다.");
if (!args["policy-exclude"]) fail("--policy-exclude <V2 이관 제외 정책 JSON> 이 필요합니다. 없으면 실행하지 않습니다.");
const CREATE_MODES = { "create-member": "member", "create-lead": "lead" };
const createKind = CREATE_MODES[args.mode] || null;
if (!["pilot", "full"].includes(args.mode) && !createKind) fail("--mode pilot | full | create-member | create-lead 를 지정하세요.");
if (createKind && !args["allow-keys"]) fail("생성 모드는 --allow-keys <확인한 고객 키 JSON> 이 필요합니다.");
if (createKind === "lead") {
  const checkedHours = (Date.now() - Date.parse(args["desk-checked-at"] || "")) / 3600000;
  if (!(checkedHours >= 0 && checkedHours <= 12)) fail("리드 생성은 12시간 이내 Desk 이메일 검색 시각을 --desk-checked-at (ISO) 으로 넘기세요.");
}
if (!args.preview && !args["confirm-write-production"]) fail("운영 데이터에 쓰는 실행입니다. 승인 후 --confirm-write-production 을 붙이세요.");

const planDir = home(args["plan-dir"]);
const plan = JSON.parse(readFileSync(path.join(planDir, "plan.json"), "utf8"));
const planMeta = JSON.parse(readFileSync(path.join(planDir, "meta.json"), "utf8"));
const planAgeHours = (Date.now() - Date.parse(planMeta.finishedAt || planMeta.startedAt)) / 3600000;
if (!(planAgeHours <= Number(args["max-plan-age-hours"]))) {
  fail(`dry-run 결과가 ${Math.floor(planAgeHours)}시간 지났습니다. 새로 dry-run을 하거나 --max-plan-age-hours 를 조정하세요.`);
}

const ex = normalizeExclusion(JSON.parse(readFileSync(home(args.exclusion), "utf8")));
const policy = loadPolicy(JSON.parse(readFileSync(home(args["policy-exclude"]), "utf8")));
const policyMatch = policyKeys(plan, policy);
const logEntries = args["done-log"].flatMap((file) => readFileSync(home(file), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)));
const { doneKeys, uncertainKeys } = readLogState(logEntries);

const limit = args.limit ? Number(args.limit) : undefined;
const { targets, eligible, excluded } = createKind
  ? selectCreateTargets(plan, {
    kind: createKind,
    allowKeys: new Set(JSON.parse(readFileSync(home(args["allow-keys"]), "utf8"))),
    doneKeys,
    uncertainKeys,
    pilot: args.pilot,
    limit,
    policyKeys: policyMatch.keys,
  })
  : selectTargets(plan, { mode: args.mode, limit, doneKeys, testChannelIds: new Set(ex.exclusion.channelUserIds), policyKeys: policyMatch.keys });
const fieldsPlanned = targets.reduce((n, c) => n + Object.keys(c.profile.profileOnce).length, 0);
console.log(JSON.stringify({
  mode: args.mode, pilot: args.pilot, eligible, selected: targets.length, fieldsPlanned, excluded, doneFromLogs: doneKeys.size, uncertainFromLogs: uncertainKeys.size,
  policy: { version: policy.version, customers: policy.customers, matchedCustomers: policyMatch.keys.size, unmatchedRecordIds: policyMatch.unmatchedRecordIds, buyers: policy.buyerIds.size },
}, null, 2));
if (targets.some((c) => policyMatch.keys.has(c.key))) fail("정책 제외 고객이 실행 대상에 들어 있어 멈춥니다.");
if (args.preview) process.exit(0);

const accessKey = process.env.CHANNELTALK_MIGRATION_ACCESS_KEY;
const accessSecret = process.env.CHANNELTALK_MIGRATION_ACCESS_SECRET;
if (!accessKey || !accessSecret) fail("CHANNELTALK_MIGRATION_ACCESS_KEY / CHANNELTALK_MIGRATION_ACCESS_SECRET 가 필요합니다.");

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const outRoot = home(args.out);
assertOutsideRepo(outRoot, repoRoot);
const startedAt = new Date();
const runDir = path.join(outRoot, `${startedAt.toISOString().replace(/[:.]/g, "-")}-${args.mode}${args.pilot ? "-trial" : ""}`);
mkdirSync(runDir, { recursive: true, mode: 0o700 });
const logFile = path.join(runDir, "apply-log.jsonl");
writeFileSync(logFile, "", { mode: 0o600 });

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const store = createStore(getFirestore(), { Timestamp, FieldValue });
const api = createChannelTalkApi({
  accessKey,
  accessSecret,
  version: process.env.CHANNELTALK_INTAKE_API_VERSION || "2026-06-01",
});

const summary = await runApply(targets, {
  api,
  store,
  maxSkips: Number(args["max-skips"] || (args.mode === "full" ? 3 : 1)),
  // 고객당 생성 1 + 프로필 PATCH 1 + 휴대폰 번호 PATCH 1
  maxWrites: targets.length * (createKind ? 3 : 2),
  handler: createKind ? createCustomer : undefined,
  memberEmail: args["member-email"],
  onEntry: (entry) => appendFileSync(logFile, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`),
});
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
writeFileSync(
  path.join(runDir, "summary.json"),
  `${JSON.stringify({ mode: args.mode, planDir, selected: targets.length, ...summary, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), commit }, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(JSON.stringify(summary, null, 2));
console.log(`로그: ${runDir}`);
if (summary.stopped) fail(`중단: ${redactError(summary.stopped)}`);
