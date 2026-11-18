// 로컬 개발 서버(npm run dev) 시작 전 확인 — package.json "predev"가 실행한다.
// - next dev와 같은 순서(process.env → .env.development.local → .env.local → .env)로 환경변수를 읽어
//   이번 실행이 쓸 Firebase 프로젝트를 한 줄로 보여 준다
// - 운영 Firebase(medidakos)가 선택되면 개발 서버를 시작하지 않는다(실제 회원가입·문의가 운영 DB·메일·Channel Talk로 가는 사고 방지).
//   정말 필요하면 ALLOW_PROD_FIREBASE_DEV=1 을 붙여 실행
// - Mock 모드(NEXT_PUBLIC_USE_MOCK_AUTH=true)나 Firebase 설정이 없으면 Firebase 요청이 없으므로 통과
// - 값은 프로젝트 ID만 출력한다(키·시크릿 출력 없음)
import nextEnv from "@next/env";

const PROD_PROJECT = "medidakos";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
const mockFlag = process.env.NEXT_PUBLIC_USE_MOCK_AUTH;
const configured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && projectId && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);
// Same rule as useMockAuth() in src/lib/firebase/client.ts.
const mock = mockFlag === "true" || (mockFlag !== "false" && !configured);

if (mock) {
  console.log("[firebase] Mock 모드 — Firebase 요청 없음");
} else if (projectId === PROD_PROJECT && process.env.ALLOW_PROD_FIREBASE_DEV !== "1") {
  console.error(
    [
      `[firebase] 운영 Firebase(${PROD_PROJECT})가 선택돼 개발 서버를 시작하지 않습니다.`,
      "  dev Firebase 값은 .env.development.local(NEXT_PUBLIC_FIREBASE_*)에 둡니다.",
      "  정말 운영으로 실행해야 하면 ALLOW_PROD_FIREBASE_DEV=1 npm run dev",
    ].join("\n"),
  );
  process.exit(1);
} else {
  console.log(`[firebase] 로컬 개발 서버 → ${projectId}${projectId === PROD_PROJECT ? " (운영 — 허용됨)" : ""}`);
}
