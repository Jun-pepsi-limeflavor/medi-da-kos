// lastContactAt 쓰기 중단 플래그 확인·수동 해제(관리자용). 문서: channelTalkControl/lastContact
//
// 기본은 상태만 읽는다(고객 id 출력 안 함). 해제는 원인을 확인한 관리자가 아래 두 옵션을 모두 줄 때만 한다.
//   gcloud auth application-default login
//   node functions/scripts/channeltalk-last-contact-control.mjs                       # 상태 보기
//   node functions/scripts/channeltalk-last-contact-control.mjs --resume --resumed-by <이름> --confirm-resume
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { createLastContactControl } = require("../channeltalk/last-contact-control.js");

const { values: args } = parseArgs({
  options: {
    resume: { type: "boolean", default: false },
    "resumed-by": { type: "string" },
    "confirm-resume": { type: "boolean", default: false },
  },
});

initializeApp({ projectId: "medidakos", credential: applicationDefault() });
const control = createLastContactControl(getFirestore(), { Timestamp, FieldValue });
const show = (s) => ({
  ...s,
  haltedAt: s.haltedAt ? new Date(s.haltedAt).toISOString() : null,
  resumedAt: s.resumedAt ? new Date(s.resumedAt).toISOString() : null,
});

const before = await control.status();
console.log(JSON.stringify({ status: show(before) }, null, 2));
if (!args.resume) process.exit(0);
if (!args["confirm-resume"] || !args["resumed-by"]) {
  console.error("해제하려면 --resumed-by <이름> 과 --confirm-resume 이 모두 필요합니다.");
  process.exit(1);
}
if (!before.halted) {
  console.log("중단 상태가 아니어서 바꾸지 않았습니다.");
  process.exit(0);
}
await control.resume({ resumedBy: args["resumed-by"], nowMs: Date.now() });
console.log(JSON.stringify({ status: show(await control.status()) }, null, 2));
