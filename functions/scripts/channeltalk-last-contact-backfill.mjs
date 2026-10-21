// lastContactAt 과거 기록 채우기(백필). 규칙: functions/channeltalk/last-contact-backfill.js
//
// 단계(쓰기 단계는 각각 별도 승인):
//   1) --estimate        : 고객 id만 모아 수를 센다(메시지 조회 없음, 쓰기 없음)
//   2) (기본) 계획       : 모든 상담방·메시지를 읽어 고객별 마지막 연락일과 대상을 계산해 비공개 폴더에 저장(쓰기 없음)
//   3) --apply --mode pilot : 계획 대상 중 최대 3명만 profileOnce로 채움
//   4) --apply --mode full  : 나머지 전체. 이전 실행 로그를 --done-log로 넘겨 끝난 고객을 건너뜀
//
//   gcloud auth application-default login     # Firestore 읽기(고객 id 수집)·중단 플래그
//   export CHANNELTALK_BACKFILL_ACCESS_KEY=... CHANNELTALK_BACKFILL_ACCESS_SECRET=...   # 셸 프로세스에서만
//   node functions/scripts/channeltalk-last-contact-backfill.mjs [--estimate] [--max-requests 3000]
//   node functions/scripts/channeltalk-last-contact-backfill.mjs --apply --plan-dir <계획 폴더> --mode pilot --confirm-write-production
//
// 콘솔에는 건수만 출력한다. 고객 id가 들어간 계획·로그는 저장소 밖 비공개 폴더(권한 600)에만 남긴다.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { createChannelTalkApi } = require("../channeltalk/api.js");
const { buildBackfillPlan, createHistoryClient, doneFromLog, runBackfill } = require("../channeltalk/last-contact-backfill.js");
const { createLastContactControl } = require("../channeltalk/last-contact-control.js");
const { assertOutsideRepo, redactError } = require("../channeltalk/migration-collect.js");

const home = (p) => path.resolve(p.replace(/^~(?=$|\/)/, homedir()));
const { values: args } = parseArgs({
  options: {
    estimate: { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    "plan-dir": { type: "string" },
    mode: { type: "string" },
    limit: { type: "string" },
    "done-log": { type: "string", multiple: true, default: [] },
    "max-requests": { type: "string", default: "3000" },
    "interval-ms": { type: "string", default: "200" },
    "max-plan-age-hours": { type: "string", default: "24" },
    "no-firestore-ids": { type: "boolean", default: false },
    exclusion: { type: "string", default: path.join(homedir(), "medidakos-private", "channeltalk-v1-hold-2026-10-12", "v2-test-exclusion-ids.json") },
    out: { type: "string", default: path.join(homedir(), "medidakos-private", "channeltalk-v2-last-contact-backfill") },
    "confirm-write-production": { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

const accessKey = process.env.CHANNELTALK_BACKFILL_ACCESS_KEY;
const accessSecret = process.env.CHANNELTALK_BACKFILL_ACCESS_SECRET;
if (!accessKey || !accessSecret) fail("CHANNELTALK_BACKFILL_ACCESS_KEY / CHANNELTALK_BACKFILL_ACCESS_SECRET 가 필요합니다.");
const version = process.env.CHANNELTALK_INTAKE_API_VERSION || "2026-06-01";
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const outRoot = home(args.out);
assertOutsideRepo(outRoot, repoRoot);

// GET 전용 클라이언트에 간격·요청 상한을 건다. 실패는 재시도하지 않고 실행을 멈춘다.
const maxRequests = Number(args["max-requests"]);
const intervalMs = Number(args["interval-ms"]);
const stats = { requests: 0 };
const raw = createHistoryClient({ accessKey, accessSecret, version });
const client = Object.fromEntries(Object.entries(raw).map(([name, fn]) => [name, async (...a) => {
  if (stats.requests >= maxRequests) throw new Error(`Channel 요청 상한(${maxRequests})에 도달해 멈췄습니다`);
  stats.requests += 1;
  if (intervalMs > 0) await new Promise((r) => setTimeout(r, intervalMs));
  return fn(...a);
}]));

initializeApp({ projectId: "medidakos", credential: applicationDefault() });
const db = getFirestore();
const startedAt = new Date();
const write = (dir, file, value) => writeFileSync(path.join(dir, file), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

if (!args.apply) {
  // ── 고객 id 수집(읽기) ──
  const ids = new Set();
  const globalChatsByUser = new Map();
  const sources = { chatList: 0, firestore: 0, globalChats: 0 };
  for (const state of ["opened", "snoozed", "closed"]) {
    let cursor = null;
    for (let page = 0; page < 50; page += 1) {
      const { userChats, nextCursor } = await client.listUserChatsPage({ state, cursor });
      for (const c of userChats) {
        if (!c.userId) continue;
        if (!ids.has(c.userId)) { ids.add(c.userId); sources.chatList += 1; }
        const list = globalChatsByUser.get(c.userId) || [];
        if (!list.some((x) => x.id === c.id)) { list.push(c); sources.globalChats += 1; }
        globalChatsByUser.set(c.userId, list);
      }
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }
  }
  if (!args["no-firestore-ids"]) {
    const add = (id) => { if (typeof id === "string" && id && !ids.has(id)) { ids.add(id); sources.firestore += 1; } };
    for (const d of (await db.collection("channelTalkIdentities").get()).docs) {
      const m = d.data();
      [m.channelUserId, ...(m.otherChannelUserIds || [])].forEach(add);
    }
    const prefixed = async (name, prefix) => (await db.collection(name).orderBy(FieldPath.documentId()).startAt(prefix).endAt(`${prefix}`).get()).docs;
    (await prefixed("threads", "channeltalk:")).forEach((d) => add(d.data().channelTalkUserId));
    (await prefixed("conversationIdentities", "channeltalk:main:")).forEach((d) => add(d.id.slice("channeltalk:main:".length)));
    (await db.collection("channelTalkSync").get()).docs.forEach((d) => add(d.data().channelUserId));
  }
  // Desk에서 지운 것으로 확인된 테스트 고객은 조회하지 않는다.
  let skippedDeletedTest = 0;
  try {
    const status = JSON.parse(readFileSync(home(args.exclusion), "utf8")).exclude?.channelTalk?.userStatus || {};
    for (const [id, s] of Object.entries(status)) if (s && s.status === "deleted" && ids.delete(id)) skippedDeletedTest += 1;
  } catch {
    // 제외 목록이 없으면 그대로 진행(404로 건너뛴다)
  }
  const collected = { userIds: ids.size, sources, skippedDeletedTest, requests: stats.requests };
  if (args.estimate) {
    console.log(JSON.stringify({ estimate: collected, note: "고객마다 상담 목록 1회 이상 + 상담방마다 메시지 1회 이상 + 고객 조회 1회" }, null, 2));
    process.exit(0);
  }
  const runDir = path.join(outRoot, `${startedAt.toISOString().replace(/[:.]/g, "-")}-plan`);
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  try {
    const plan = await buildBackfillPlan({ client, userIds: [...ids], globalChatsByUser });
    const skipReasons = plan.skips.reduce((o, s) => ({ ...o, [s.reason]: (o[s.reason] || 0) + 1 }), {});
    const reviewReasons = plan.reviews.reduce((o, s) => ({ ...o, [s.reason]: (o[s.reason] || 0) + 1 }), {});
    const summary = { collected, stats: plan.stats, targets: plan.targets.length, skipReasons, reviewReasons, requests: stats.requests };
    write(runDir, "plan.json", { ...plan, createdAt: startedAt.toISOString(), finishedAt: new Date().toISOString() });
    write(runDir, "summary.json", summary);
    console.log(JSON.stringify(summary, null, 2));
    console.log(`계획: ${runDir.replace(homedir(), "~")}`);
  } catch (error) {
    write(runDir, "error.json", { error: redactError(error), requests: stats.requests });
    fail(`계획 중단: ${redactError(error)}`);
  }
  process.exit(0);
}

// ── 쓰기(별도 승인) ──
if (!args["plan-dir"]) fail("--plan-dir 가 필요합니다.");
if (args.mode !== "pilot" && args.mode !== "full") fail("--mode pilot 또는 --mode full 을 지정하세요.");
if (!args["confirm-write-production"]) fail("운영 쓰기입니다. 승인 후 --confirm-write-production 을 붙이세요.");
const planDir = home(args["plan-dir"]);
const plan = JSON.parse(readFileSync(path.join(planDir, "plan.json"), "utf8"));
const ageHours = (Date.now() - Date.parse(plan.finishedAt)) / 3600000;
if (!(ageHours <= Number(args["max-plan-age-hours"]))) fail(`계획이 ${Math.floor(ageHours)}시간 지났습니다. 계획을 다시 만드세요.`);
const done = doneFromLog(args["done-log"].flatMap((f) => readFileSync(home(f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))));
const remaining = plan.targets.filter((t) => !done.has(t.channelUserId));
const limit = args.mode === "pilot" ? Math.min(Number(args.limit || 3), 3) : Number(args.limit || remaining.length);
const targets = remaining.slice(0, limit);
console.log(JSON.stringify({ mode: args.mode, planTargets: plan.targets.length, doneFromLogs: done.size, selected: targets.length }, null, 2));

const runDir = path.join(outRoot, `${startedAt.toISOString().replace(/[:.]/g, "-")}-${args.mode}`);
mkdirSync(runDir, { recursive: true, mode: 0o700 });
const logFile = path.join(runDir, "apply-log.jsonl");
writeFileSync(logFile, "", { mode: 0o600 });
const writer = createChannelTalkApi({ accessKey, accessSecret, version });
const control = createLastContactControl(db, { Timestamp, FieldValue });
const summary = await runBackfill(targets, {
  api: { getUser: (id) => client.getUser(id), patchUser: (id, body) => writer.patchUser(id, body) },
  control,
  maxSkips: args.mode === "pilot" ? 1 : 3,
  maxWrites: targets.length,
  onEntry: (entry) => appendFileSync(logFile, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`),
});
write(runDir, "summary.json", { ...summary, selected: targets.length, planDir, requests: stats.requests });
console.log(JSON.stringify({ ...summary, requests: stats.requests }, null, 2));
console.log(`로그: ${runDir.replace(homedir(), "~")}`);
if (summary.stopped) fail(`중단: ${summary.stopped}`);
