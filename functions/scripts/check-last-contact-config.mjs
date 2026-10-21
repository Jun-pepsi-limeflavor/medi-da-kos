// lastContactAt 웹훅 배포 전 설정 점검(읽기 전용). 배포 전에 실행해 설정 누락·불일치를 먼저 찾는다.
//
//   node functions/scripts/check-last-contact-config.mjs                     # 로컬 파일만 점검
//   node functions/scripts/check-last-contact-config.mjs --compare-deployed  # 운영 함수 설정과 비교(ADC 필요)
//
// 점검: 1) functions/.env(추적, 운영값 원본)의 MODE·ALLOW_USER_IDS 값과 형식
//       2) functions/.env.<project>(추적 안 함)가 이 값을 몰래 덮어쓰는지
//       3) functions/.env에 커밋하지 않은 변경이 있는지(배포가 저장소와 달라짐)
//       4) (선택) 운영 중인 함수의 환경변수와 같은지
// 비밀값은 다루지 않는다. 출력하는 값은 MODE와 허용 목록 개수뿐이다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const KEYS = ["CHANNELTALK_LAST_CONTACT_MODE", "CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS"];
const FUNCTION = "channelTalkLastContactWebhook";
const REGION = "asia-northeast3";

const { values: args } = parseArgs({ options: { project: { type: "string" }, "compare-deployed": { type: "boolean", default: false } } });
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const fnDir = path.join(repoRoot, "functions");
const project = args.project || JSON.parse(readFileSync(path.join(repoRoot, ".firebaserc"), "utf8")).projects.default;

function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}
const describe = (env) => ({
  mode: env.CHANNELTALK_LAST_CONTACT_MODE ?? "(없음 → off)",
  allow: env.CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS === undefined || env.CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS === ""
    ? "(비어 있음 → 쓰기 없음)"
    : env.CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS === "*" ? "*(전체)" : `${env.CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS.split(",").filter(Boolean).length}명`,
});

const problems = [];
const warnings = [];
const tracked = readEnv(path.join(fnDir, ".env"));
const projectFile = path.join(fnDir, `.env.${project}`);
const override = readEnv(projectFile);
for (const key of KEYS) {
  if (key in override) problems.push(`${path.basename(projectFile)}(추적 안 함)이 ${key}를 덮어씁니다. 운영값은 functions/.env 한 곳에만 두세요.`);
}
const effective = { ...tracked, ...override };
const mode = effective.CHANNELTALK_LAST_CONTACT_MODE;
if (!["off", "observe", "on"].includes(mode)) problems.push(`CHANNELTALK_LAST_CONTACT_MODE 값이 off|observe|on 이 아닙니다(코드에서는 off로 동작).`);
if (mode === "on" && !effective.CHANNELTALK_LAST_CONTACT_ALLOW_USER_IDS) warnings.push("MODE=on 이지만 허용 목록이 비어 있어 실제로는 아무에게도 쓰지 않습니다.");
try {
  const dirty = execFileSync("git", ["status", "--porcelain", "--", "functions/.env"], { cwd: repoRoot, encoding: "utf8" }).trim();
  if (dirty) warnings.push("functions/.env에 커밋하지 않은 변경이 있습니다. 이대로 배포하면 운영 설정이 저장소와 달라집니다.");
} catch {
  warnings.push("git 상태를 확인하지 못했습니다.");
}

const report = { project, local: describe(effective) };
if (args["compare-deployed"]) {
  const require = createRequire(path.join(fnDir, "package.json"));
  const { GoogleAuth } = require("google-auth-library");
  try {
    const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
    const { data } = await client.request({ url: `https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${REGION}/functions/${FUNCTION}` });
    const deployed = (data.serviceConfig && data.serviceConfig.environmentVariables) || {};
    report.deployed = { ...describe(deployed), updateTime: data.updateTime };
    for (const key of KEYS) {
      if ((deployed[key] ?? "") !== (effective[key] ?? "")) problems.push(`${key}: 운영 함수와 로컬 설정이 다릅니다. 이대로 배포하면 운영 동작이 바뀝니다.`);
    }
  } catch (error) {
    problems.push(`운영 함수 설정을 읽지 못했습니다(${error.response ? error.response.status : "auth"}). gcloud auth application-default login 후 다시 실행하세요.`);
  }
}

console.log(JSON.stringify({ ...report, warnings, problems }, null, 2));
if (problems.length > 0) {
  console.error("배포 전에 위 문제를 해결하세요.");
  process.exit(1);
}
