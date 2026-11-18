// 로컬 빌드·실행 전용 Firebase 확인 (npm run build:local / start:local, 그리고 일반 npm run start 직전의 prestart).
// - Vercel 빌드는 이 스크립트를 쓰지 않는다: Vercel은 npm run build(next build)만 실행하고 Vercel 환경변수를 쓴다.
//   여기서는 prebuild를 두지 않으므로 Production·staging·Preview 빌드는 그대로다
// - NEXT_PUBLIC_FIREBASE_*는 next build 때 결과물에 박힌다(next start는 다시 읽지 않음). next build는 production 모드라
//   .env.development.local을 읽지 않고 .env.local(운영 medidakos)을 쓰므로, build는 dev 모드 순서
//   (.env.development.local → .env.local → .env)로 읽은 값을 실행 환경변수로 넘겨 빌드한다(실행 환경변수가 파일보다 우선)
// - 빌드 후 결과물(.next/static·.next/server)에서 dev·운영 Firebase 키(API key·App ID)를 찾아 실제로 박힌 프로젝트를 판정한다.
//   운영 값이 보이면 실패. start는 이 판정과 실행 환경의 프로젝트가 같을 때만 next start를 실행한다
// - 운영으로 정말 실행해야 하면 ALLOW_PROD_FIREBASE_DEV=1 (predev와 같은 이름). 값은 프로젝트 ID만 출력한다
// - 사용: node scripts/local-firebase.mjs build | start [next start 옵션] | check-start
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import nextEnv from "@next/env";

const PROD_PROJECT = "medidakos";
const FILES = { dev: ".env.development.local", prod: ".env.local" };
const allowProd = process.env.ALLOW_PROD_FIREBASE_DEV === "1";
const cwd = process.cwd();
const quiet = { info: () => {}, error: console.error };

/** Minimal KEY=VALUE reader for the two env files (fingerprints only; values are never printed). */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/** API key and App ID identify a Firebase web app without ambiguity (project IDs overlap as substrings). */
function fingerprints() {
  const fp = {};
  for (const [label, file] of Object.entries(FILES)) {
    const env = readEnvFile(file);
    const values = [env.NEXT_PUBLIC_FIREBASE_API_KEY, env.NEXT_PUBLIC_FIREBASE_APP_ID].filter((v) => v && v.length > 10);
    if (values.length) fp[label] = { projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, values };
  }
  if (fp.dev && fp.prod && fp.dev.projectId === fp.prod.projectId) delete fp.prod; // .env.local already points at dev
  return fp;
}

function* jsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(full);
    else if (/\.(js|mjs|cjs|json|html|rsc)$/.test(entry.name)) yield full;
  }
}

/** Which Firebase project(s) the current .next build output contains. */
function scanBuild() {
  if (!fs.existsSync(".next/BUILD_ID")) return null;
  const fp = fingerprints();
  const found = new Set();
  for (const dir of [".next/static", ".next/server"]) {
    for (const file of jsFiles(dir)) {
      const text = fs.readFileSync(file, "utf8");
      for (const [label, { values }] of Object.entries(fp)) if (values.some((v) => text.includes(v))) found.add(label);
    }
  }
  if (found.size > 1) return { label: "both", projectId: "dev와 운영이 섞임" };
  const [label] = found;
  if (!label) return { label: "none", projectId: "Firebase 설정 없음(Mock)" };
  return { label, projectId: fp[label].projectId };
}

/** The project a command would use from its env (dev = next dev order, production = next build/start order). */
function resolveEnv(dev) {
  nextEnv.loadEnvConfig(cwd, dev, quiet);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || null;
  const mock = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true";
  return { projectId, mock };
}

function fail(lines) {
  console.error(lines.join("\n"));
  process.exit(1);
}

function runNext(args) {
  const bin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const result = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const PROD_HINT = "  정말 운영 Firebase로 로컬 실행해야 하면 ALLOW_PROD_FIREBASE_DEV=1 을 붙인다.";
const [command, ...rest] = process.argv.slice(2);

if (command === "build") {
  const env = resolveEnv(true);
  if (env.projectId === PROD_PROJECT && !allowProd) {
    fail([`[firebase] 로컬 빌드가 운영 Firebase(${PROD_PROJECT})를 선택해 중단합니다.`, "  .env.development.local의 NEXT_PUBLIC_FIREBASE_*를 확인한다.", PROD_HINT]);
  }
  console.log(`[firebase] 로컬 빌드 → ${env.mock ? "Mock 모드 (설정값: " + env.projectId + ")" : env.projectId}`);
  runNext(["build", ...rest]);
  const built = scanBuild();
  console.log(`[firebase] 빌드 결과물 Firebase → ${built?.projectId ?? "확인 불가"}`);
  if (!built || built.label === "both" || (built.label === "prod" && !allowProd)) {
    fail(["[firebase] 빌드 결과물에 운영 Firebase 값이 들어 있거나 확인할 수 없습니다. 이 빌드로 실행하지 말 것.", PROD_HINT]);
  }
} else if (command === "start" || command === "check-start") {
  // start: start:local (dev 순서로 읽은 값으로 실행). check-start: 일반 npm run start의 prestart (production 순서).
  const env = resolveEnv(command === "start");
  const built = scanBuild();
  if (!built) fail(["[firebase] 빌드 결과물이 없습니다. 먼저 npm run build:local"]);
  console.log(`[firebase] 빌드 결과물 Firebase → ${built.projectId} / 실행 환경 → ${env.projectId ?? "없음"}`);
  if (built.label === "both") fail(["[firebase] 빌드 결과물에 dev와 운영 값이 섞여 있습니다. npm run build:local로 다시 빌드한다."]);
  if (built.label === "prod" && !allowProd) {
    fail(["[firebase] 운영 Firebase로 빌드된 결과물이라 로컬 실행을 막습니다. npm run build:local로 다시 빌드한다.", PROD_HINT]);
  }
  if (built.label !== "none" && built.projectId !== env.projectId && !allowProd) {
    fail([
      "[firebase] 빌드 결과물과 실행 환경의 Firebase 프로젝트가 다릅니다.",
      command === "check-start" ? "  로컬에서는 npm run start:local로 실행한다(dev 설정으로 실행)." : "  npm run build:local로 다시 빌드한다.",
    ]);
  }
  if (command === "start") runNext(["start", ...rest]);
} else {
  fail(["사용: node scripts/local-firebase.mjs build | start [옵션] | check-start"]);
}
