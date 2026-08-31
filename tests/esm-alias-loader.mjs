// node --test 용 최소 ESM 리졸버 훅.
//
// 앱 소스는 Next의 번들러 해석을 전제로 짜여 있다: tsconfig의 "@/*" → "./src/*"
// 별칭, 확장자 생략, 그리고 "server-only" 마커 패키지(Next가 서버 컴포넌트
// 그래프에서는 no-op으로, 클라이언트 그래프에서는 즉시 throw로 바꿔치기한다).
// node --test로 그 소스를 직접 import하면 Node의 기본 ESM 리졸버는 이 셋을
// 하나도 몰라서, 이 훅이 최소한만 흉내낸다 — 새 의존성을 추가하지 않기 위한
// module.register() 훅이다.
//
// 사용법: 각 테스트 파일에서 무거운 소스를 동적 import 하기 *전에*
//   import { register } from "node:module";
//   register("../tests/esm-alias-loader.mjs", import.meta.url);
// 정적 import는 이 훅이 걸리기 전에 이미 링크되므로 대상은 항상 동적 import여야 한다.
const EXTS = [".ts", ".tsx", ".js", ".mjs"];
const SERVER_ONLY_STUB = "server-only-stub:noop";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    // 실제 패키지는 무조건 throw한다(클라이언트 그래프용 스텁). 서버 전용
    // 마커일 뿐 런타임 동작이 없으므로 빈 모듈로 대체한다.
    return { url: SERVER_ONLY_STUB, shortCircuit: true };
  }

  let target = specifier;
  if (target.startsWith("@/")) {
    target = new URL(`src/${target.slice(2)}`, new URL("../", import.meta.url)).href;
  }

  try {
    return await nextResolve(target, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      for (const ext of EXTS) {
        try {
          return await nextResolve(target + ext, context);
        } catch {
          // try the next extension
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url === SERVER_ONLY_STUB) {
    return { format: "module", source: "export {};", shortCircuit: true };
  }
  // Node 26의 strip-only TypeScript는 parameter property를 처리하지 못한다.
  // Firestore Emulator 환경에서 Admin SDK transaction을 실행할 때만
  // TypeScript의 변환기를 쓴다; 일반 단위 테스트의 런타임은 바꾸지 않는다.
  if (process.env.FIRESTORE_EMULATOR_HOST && url.startsWith("file:") && url.endsWith(".ts")) {
    const [{ readFile }, ts] = await Promise.all([
      import("node:fs/promises"),
      import("typescript"),
    ]);
    const source = await readFile(new URL(url), "utf8");
    return {
      format: "module",
      source: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
