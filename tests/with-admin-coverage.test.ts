import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ADMIN_API_DIR = "src/app/api/admin";

// 세션을 만드는 라우트는 세션을 요구할 수 없다.
const EXEMPT = new Set(["session/route.ts"]);

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...routeFiles(full, rel));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(rel);
  }
  return out;
}

// `method`라는 이름으로 밖에 보이는 로컬 바인딩을 전부 모은다. 세 가지 모양을 본다:
//   export const GET = ...        → 로컬 이름은 GET 자신
//   export function GET() {}      → 로컬 이름은 GET 자신
//   export { GET }                → 로컬 이름은 GET 자신 (재-export)
//   export { handler as GET }     → 로컬 이름은 handler (이름을 바꾼 재-export)
function localNamesExportedAs(src: string, method: string): string[] {
  const names = new Set<string>();

  if (new RegExp(`export\\s+(const|async\\s+function|function)\\s+${method}\\b`).test(src)) {
    names.add(method);
  }

  for (const block of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const clause of block[1].split(",")) {
      const asMatch = clause.match(/^\s*(\w+)\s+as\s+(\w+)\s*$/);
      if (asMatch && asMatch[2] === method) names.add(asMatch[1]);
      else if (clause.trim() === method) names.add(method);
    }
  }

  return [...names];
}

// 로컬 이름이 `withAdmin(...)` 호출로 만들어졌는지 — export 여부와 무관하게 찾는다.
// (재-export는 정의부와 export 문이 떨어져 있을 수 있어서, "로컬 이름"과 "export
// 여부"를 따로 판정해야 `const GET = withAdmin(...); export { GET };` 같은
// 유효한 간접 패턴을 오탐하지 않는다.)
function isGuarded(src: string, localName: string): boolean {
  return new RegExp(`\\bconst\\s+${localName}\\s*=\\s*withAdmin\\s*\\(`).test(src)
    || new RegExp(`export\\s+async\\s+function\\s+${localName}\\b[\\s\\S]*?return\\s+withAdmin\\s*\\(`).test(src);
}

// 이 검사가 보는 것: 같은 파일 안에서 텍스트로 드러나는 export/재-export와
// `withAdmin(...)` 호출 바인딩.
// 이 검사가 보지 못하는 것: 런타임에 조립되는 핸들러(문자열 결합·동적 할당처럼
// `withAdmin(` 텍스트 자체가 안 보이는 코드), 그리고 다른 모듈에서 만들어 여기로
// 재-export만 해 오는 핸들러(그 모듈은 이 검사가 열어보지 않는다). 텍스트 패턴
// 검사이지 타입 인터프리터가 아니다.
test("어드민 API 라우트는 전부 withAdmin 으로만 내보낸다", () => {
  const files = routeFiles(ADMIN_API_DIR);
  assert.ok(files.length > 0, "어드민 라우트가 하나도 없다 — 경로가 맞는지 확인");

  const offenders: string[] = [];
  for (const rel of files) {
    if (EXEMPT.has(rel)) continue;
    const src = readFileSync(join(ADMIN_API_DIR, rel), "utf8");
    for (const method of METHODS) {
      const localNames = localNamesExportedAs(src, method);
      const guarded = localNames.some((name) => isGuarded(src, name));
      if (localNames.length > 0 && !guarded) {
        offenders.push(`${rel}: ${method}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `withAdmin 없이 내보낸 핸들러: ${offenders.join(", ")}`);
});

// firebase-admin은 Edge 런타임에서 죽는다. withAdmin으로 감쌌어도 라우트가
// 기본값(Edge)으로 남아 있으면 배포 후에야 터진다 — 세션을 만드는
// exempt 라우트도 firebase-admin을 쓰므로 예외 없이 전부 검사한다.
test("어드민 API 라우트는 전부 nodejs 런타임을 선언한다", () => {
  const files = routeFiles(ADMIN_API_DIR);
  assert.ok(files.length > 0, "어드민 라우트가 하나도 없다 — 경로가 맞는지 확인");

  const offenders: string[] = [];
  for (const rel of files) {
    const src = readFileSync(join(ADMIN_API_DIR, rel), "utf8");
    if (!/export\s+const\s+runtime\s*=\s*["']nodejs["']/.test(src)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `runtime = "nodejs" 선언이 없는 라우트: ${offenders.join(", ")}`);
});
