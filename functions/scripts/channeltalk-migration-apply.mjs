// V2 기존 고객 프로필 이관 실행. 운영 Channel 프로필(빈 칸만)과 Firestore channelTalkIdentities에 쓴다.
// 판정: functions/channeltalk/migration-plan.js(dry-run), 실행: functions/channeltalk/migration-apply.js
// 계획: docs/plans/2026-10-19-channeltalk-v2.md
//
// 운영 쓰기이므로 모드마다 별도 승인 후에만 실행한다.
//   1) --preview: API·Firestore 호출 없이 대상 건수만 본다(키 불필요).
//   2) --mode pilot: 보류 고객을 뺀 최대 5명. 끝나면 Desk에서 결과를 확인한다.
//   3) --mode full: 나머지 전체. 이전 실행 로그를 --done-log로 넘겨 끝난 고객을 건너뛴다.
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
const { runApply, selectTargets } = require("../channeltalk/migration-apply.js");
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
    "confirm-write-production": { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!args["plan-dir"] || !args.exclusion) fail("--plan-dir 와 --exclusion 이 필요합니다.");
if (args.mode !== "pilot" && args.mode !== "full") fail("--mode pilot 또는 --mode full 을 지정하세요.");
if (!args.preview && !args["confirm-write-production"]) fail("운영 데이터에 쓰는 실행입니다. 승인 후 --confirm-write-production 을 붙이세요.");

const planDir = home(args["plan-dir"]);
const plan = JSON.parse(readFileSync(path.join(planDir, "plan.json"), "utf8"));
const planMeta = JSON.parse(readFileSync(path.join(planDir, "meta.json"), "utf8"));
const planAgeHours = (Date.now() - Date.parse(planMeta.finishedAt || planMeta.startedAt)) / 3600000;
if (!(planAgeHours <= Number(args["max-plan-age-hours"]))) {
  fail(`dry-run 결과가 ${Math.floor(planAgeHours)}시간 지났습니다. 새로 dry-run을 하거나 --max-plan-age-hours 를 조정하세요.`);
}

const ex = normalizeExclusion(JSON.parse(readFileSync(home(args.exclusion), "utf8")));
const doneKeys = new Set();
for (const file of args["done-log"]) {
  for (const line of readFileSync(home(file), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.outcome === "applied" || entry.outcome === "already_done") doneKeys.add(entry.key);
  }
}

const { targets, eligible, excluded } = selectTargets(plan, {
  mode: args.mode,
  limit: args.limit ? Number(args.limit) : undefined,
  doneKeys,
  testChannelIds: new Set(ex.exclusion.channelUserIds),
});
const fieldsPlanned = targets.reduce((n, c) => n + Object.keys(c.profile.profileOnce).length, 0);
console.log(JSON.stringify({ mode: args.mode, eligible, selected: targets.length, fieldsPlanned, excluded, doneFromLogs: doneKeys.size }, null, 2));
if (args.preview) process.exit(0);

const accessKey = process.env.CHANNELTALK_MIGRATION_ACCESS_KEY;
const accessSecret = process.env.CHANNELTALK_MIGRATION_ACCESS_SECRET;
if (!accessKey || !accessSecret) fail("CHANNELTALK_MIGRATION_ACCESS_KEY / CHANNELTALK_MIGRATION_ACCESS_SECRET 가 필요합니다.");

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const outRoot = home(args.out);
assertOutsideRepo(outRoot, repoRoot);
const startedAt = new Date();
const runDir = path.join(outRoot, `${startedAt.toISOString().replace(/[:.]/g, "-")}-${args.mode}`);
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
  maxSkips: Number(args["max-skips"] || (args.mode === "pilot" ? 1 : 3)),
  maxWrites: targets.length * 2,
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
