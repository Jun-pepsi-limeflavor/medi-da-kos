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

// Storage 규칙 테스트용(firestore.get 교차 검사 때문에 Firestore도 함께 연결). npm test는 두 에뮬레이터를 띄운다.
let storageEnvPromise;

export function getStorageTestEnv() {
  if (!storageEnvPromise) {
    storageEnvPromise = initializeTestEnvironment({
      projectId: "demo-medidakos",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
      storage: {
        rules: readFileSync("storage.rules", "utf8"),
        host: "127.0.0.1",
        port: 9199,
      },
    });
  }
  return storageEnvPromise;
}

// getTestEnv()가 열어둔 RulesTestEnvironment는 누군가 정리해야 프로세스가
// 스스로 종료한다. 이 파일을 import하는 모든 테스트 파일에 훅이 걸린다.
after(async () => {
  if (envPromise) {
    await (await envPromise).cleanup();
  }
  if (storageEnvPromise) {
    await (await storageEnvPromise).cleanup();
  }
});
