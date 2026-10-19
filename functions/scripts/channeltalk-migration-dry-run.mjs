// V2 기존 고객 이관 dry-run (읽기 전용). 운영 Firestore·Channel에 쓰기 요청을 보내지 않는다.
// 판정: functions/channeltalk/migration-plan.js, 수집: functions/channeltalk/migration-collect.js
// 계획: docs/plans/2026-10-19-channeltalk-v2.md
//
// 실행은 별도 승인 후에만 한다. 사용법:
//   gcloud auth application-default login            # Firestore 읽기 권한이 있는 계정
//   export CHANNELTALK_DRYRUN_ACCESS_KEY=...          # 셸에서만 설정. 파일·저장소에 두지 않는다
//   export CHANNELTALK_DRYRUN_ACCESS_SECRET=...
//   node functions/scripts/channeltalk-migration-dry-run.mjs \
//     --exclusion ~/medidakos-private/channeltalk-v1-hold-2026-10-12/v2-test-exclusion-ids.json \
//     [--desk-export <csv> --desk-id-column <열> --desk-email-column <열>] \
//     [--out ~/medidakos-private/channeltalk-v2-dry-run] [--include-ingest-ids] [--include-thread-ids] \
//     [--reuse-snapshot <이전 결과 폴더>] [--estimate-only] \
//     [--interval-ms 250] [--max-requests 3000] --confirm-read-production
//
// --estimate-only: Firestore만 읽고 예상 Channel 요청 수를 출력한다(Channel 키 불필요, Channel 호출 없음).
// --reuse-snapshot: 이전 실행의 snapshot.json에 있는 Firestore·Channel 값은 다시 읽지 않는다.
// 예상 요청 수가 --max-requests를 넘으면 Channel을 호출하기 전에 멈춘다.
// 콘솔에는 건수와 결과 경로만 출력한다. 고객 정보는 결과 파일(권한 600)에만 남는다.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { createChannelTalkApi } = require("../channeltalk/api.js");
const {
  assertOutsideRepo,
  collectAndPlan,
  createReadOnlyReader,
  parseDeskExport,
  readOnlyFetch,
  redactError,
} = require("../channeltalk/migration-collect.js");

const PROJECT_ID = "medidakos";
const PAGE_SIZE = 300;

const { values: args } = parseArgs({
  options: {
    exclusion: { type: "string" },
    "desk-export": { type: "string" },
    "desk-id-column": { type: "string" },
    "desk-email-column": { type: "string" },
    out: { type: "string", default: path.join(homedir(), "medidakos-private", "channeltalk-v2-dry-run") },
    "include-ingest-ids": { type: "boolean", default: false },
    "include-thread-ids": { type: "boolean", default: false },
    "reuse-snapshot": { type: "string" },
    "estimate-only": { type: "boolean", default: false },
    "interval-ms": { type: "string", default: "250" },
    "max-requests": { type: "string", default: "3000" },
    "test-domain": { type: "string", default: "techasset.co.kr" },
    "confirm-read-production": { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!args["confirm-read-production"]) fail("운영 데이터를 읽는 실행입니다. 승인 후 --confirm-read-production 을 붙여 실행하세요.");
if (!args.exclusion) fail("--exclusion <비공개 제외 목록 JSON> 이 필요합니다.");
const estimateOnly = args["estimate-only"];
const accessKey = process.env.CHANNELTALK_DRYRUN_ACCESS_KEY;
const accessSecret = process.env.CHANNELTALK_DRYRUN_ACCESS_SECRET;
if (!estimateOnly && (!accessKey || !accessSecret)) fail("CHANNELTALK_DRYRUN_ACCESS_KEY / CHANNELTALK_DRYRUN_ACCESS_SECRET 가 필요합니다.");

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const outRoot = path.resolve(args.out.replace(/^~(?=$|\/)/, homedir()));
assertOutsideRepo(outRoot, repoRoot);

let deskIndex = null;
let deskStats = null;
if (args["desk-export"]) {
  if (!args["desk-id-column"] || !args["desk-email-column"]) fail("--desk-id-column 과 --desk-email-column 이 필요합니다.");
  const parsed = parseDeskExport(readFileSync(args["desk-export"], "utf8"), {
    idColumn: args["desk-id-column"],
    emailColumn: args["desk-email-column"],
  });
  deskIndex = parsed.index;
  deskStats = { rows: parsed.rows, skipped: parsed.skipped, emails: Object.keys(parsed.index).length };
}

const snapshot = args["reuse-snapshot"]
  ? JSON.parse(readFileSync(path.join(path.resolve(args["reuse-snapshot"].replace(/^~(?=$|\/)/, homedir())), "snapshot.json"), "utf8"))
  : null;

initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();

// Firestore는 이 함수로만 읽는다(get만 사용).
async function listDocs(name, { prefix } = {}) {
  const docs = [];
  let query = db.collection(name).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
  if (prefix) query = query.startAt(prefix).endAt(`${prefix}`);
  let last = null;
  for (;;) {
    const snap = await (last ? query.startAfter(last) : query).get();
    for (const doc of snap.docs) docs.push({ id: doc.id, data: doc.data() });
    if (snap.size < PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return docs;
}

const maxRequests = Number(args["max-requests"]);
const reader = estimateOnly
  ? null
  : createReadOnlyReader(
    createChannelTalkApi({
      accessKey,
      accessSecret,
      version: process.env.CHANNELTALK_INTAKE_API_VERSION || "2026-06-01",
      fetchImpl: readOnlyFetch(globalThis.fetch),
    }),
    { intervalMs: Number(args["interval-ms"]), maxRequests },
  );

const startedAt = new Date();
const runDir = path.join(outRoot, startedAt.toISOString().replace(/[:.]/g, "-"));
mkdirSync(runDir, { recursive: true, mode: 0o700 });
// Firestore Timestamp는 밀리초로 저장한다(스냅샷 재사용 시 판정이 같은 값을 보도록).
function replacer(key, value) {
  const raw = this[key];
  return raw && typeof raw.toMillis === "function" ? raw.toMillis() : value;
}
const write = (file, value) => writeFileSync(path.join(runDir, file), `${JSON.stringify(value, replacer, 2)}\n`, { mode: 0o600 });
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

try {
  const { plan, meta, snapshot: nextSnapshot } = await collectAndPlan({
    listDocs,
    reader,
    exclusionRaw: JSON.parse(readFileSync(args.exclusion, "utf8")),
    deskIndex,
    includeIngestIds: args["include-ingest-ids"],
    includeThreadIds: args["include-thread-ids"],
    snapshot,
    estimateOnly,
    maxRequests,
    config: { testDomain: args["test-domain"] },
  });
  const runInfo = { deskExport: deskStats, reuseSnapshot: Boolean(snapshot), startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), commit };
  write("meta.json", { ...meta, ...runInfo });
  if (estimateOnly) {
    console.log(JSON.stringify({ counts: meta.counts, estimate: meta.estimate, maxRequests }, null, 2));
  } else {
    write("plan.json", plan);
    write("snapshot.json", nextSnapshot);
    console.log(JSON.stringify({ summary: plan.summary, channelIndexComplete: meta.channelIndexComplete, estimate: meta.estimate, channelRequests: meta.channelRequests }, null, 2));
  }
  console.log(`결과: ${runDir}`);
} catch (error) {
  write("error.json", { error: redactError(error), channelRequests: reader ? reader.stats : null, startedAt: startedAt.toISOString(), commit });
  fail(`dry-run 중단: ${redactError(error)} (상세: ${runDir}/error.json)`);
}
