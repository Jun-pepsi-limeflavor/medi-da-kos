import { readFileSync } from "node:fs";
import { after } from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

let envPromise;

export function getTestEnv() {
  if (!envPromise) {
    envPromise = initializeTestEnvironment({
      projectId: "demo-medidakos",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  }
  return envPromise;
}

// getTestEnv()가 열어둔 RulesTestEnvironment는 누군가 정리해야 프로세스가
// 스스로 종료한다. 이 파일을 import하는 모든 테스트 파일에 훅이 걸린다.
after(async () => {
  if (envPromise) {
    await (await envPromise).cleanup();
  }
});
