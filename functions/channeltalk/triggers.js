/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Channel Talk 웹 접수 연동 트리거. functions/index.js가 그대로 내보낸다.
 *
 * - 기존 트리거(onUserSignup·onContactCreated·onOrderCreated·onLandingRequestCreated)와 별개 함수다.
 *   같은 문서 생성 이벤트에 따로 반응하므로 서로의 실패에 영향을 주지 않는다.
 * - 처리 기록(channelTalkSync)을 만들기 전의 오류만 밖으로 던져 Firebase 자동 재실행(retry: true)에 맡긴다.
 *   처리 기록을 만든 뒤의 오류는 던지지 않고 channelTalkSync에 남기며, 재시도는 channelTalkRetry가 한다.
 * - 로그에는 원천·문서 id·결과만 남긴다(고객 정보·본문 금지).
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineBoolean, defineInt, defineSecret, defineString } = require("firebase-functions/params");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { createChannelTalkApi } = require("./api");
const { DEFAULT_MAX_NOTE_LENGTH } = require("./notes");
const { handleTriggerEvent, runRetryBatch } = require("./processor");
const { createStore } = require("./store");

const REGION = "asia-northeast3";
const TIMEOUT_SECONDS = 120;

const INTAKE_ENABLED = defineBoolean("CHANNELTALK_INTAKE_ENABLED", { default: false });
const API_VERSION = defineString("CHANNELTALK_INTAKE_API_VERSION", { default: "2026-06-01" });
const BOT_NAME = defineString("CHANNELTALK_INTAKE_BOT_NAME", { default: "웹 접수" });
const INTERNAL_DOMAINS = defineString("CHANNELTALK_INTERNAL_DOMAINS", {
  default: "techasset.co.kr,medidakoslabs.com,medidakos.com",
});
const TEST_DOMAIN = defineString("CHANNELTALK_TEST_DOMAIN", { default: "techasset.co.kr" });
const NOTE_MAX_LENGTH = defineInt("CHANNELTALK_NOTE_MAX_LENGTH", { default: DEFAULT_MAX_NOTE_LENGTH });
const ACCESS_KEY = defineSecret("CHANNELTALK_INTAKE_ACCESS_KEY");
const ACCESS_SECRET = defineSecret("CHANNELTALK_INTAKE_ACCESS_SECRET");

const SECRETS = [ACCESS_KEY, ACCESS_SECRET];

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function buildDeps() {
  const enabled = INTAKE_ENABLED.value() === true;
  const config = {
    enabled,
    internalDomains: splitList(INTERNAL_DOMAINS.value()),
    testDomain: TEST_DOMAIN.value(),
    botName: BOT_NAME.value(),
    noteMaxLength: NOTE_MAX_LENGTH.value(),
  };
  // 꺼져 있으면 API를 만들지 않는다. 처리권 잡기가 process를 돌려주지 않으므로 호출될 일도 없다.
  const api = enabled
    ? createChannelTalkApi({ accessKey: ACCESS_KEY.value(), accessSecret: ACCESS_SECRET.value(), version: API_VERSION.value() })
    : null;
  return { store: createStore(getFirestore(), { Timestamp, FieldValue }), api, config };
}

async function handle(source, event) {
  const snap = event.data;
  if (!snap) return;
  let deps;
  try {
    deps = buildDeps();
  } catch (error) {
    // 설정을 읽지 못하면 처리 기록도 만들 수 없다. 처리권을 잡기 전 오류이므로 Firebase 재실행에 맡긴다.
    console.error(`channelTalk ${source}/${event.params.docId}: pre_claim_failed config ${error && (error.code || error.name)}`);
    throw error;
  }
  await handleTriggerEvent({ source, docId: event.params.docId, data: snap.data(), deps });
}

function trigger(collection, source) {
  return onDocumentCreated(
    { document: `${collection}/{docId}`, region: REGION, timeoutSeconds: TIMEOUT_SECONDS, secrets: SECRETS, retry: true },
    (event) => handle(source, event),
  );
}

const channelTalkOnUserCreated = trigger("users", "users");
const channelTalkOnContactCreated = trigger("contact", "contact");
const channelTalkOnLandingCreated = trigger("landingRequests", "landingRequests");
const channelTalkOnOrderCreated = trigger("orders", "orders");

const channelTalkRetry = onSchedule(
  { schedule: "every 10 minutes", timeZone: "Asia/Seoul", region: REGION, timeoutSeconds: TIMEOUT_SECONDS, secrets: SECRETS },
  async () => {
    try {
      const result = await runRetryBatch({ deps: buildDeps() });
      if (result.disabled) {
        console.log("channelTalkRetry: intake disabled — 처리하지 않음");
        return;
      }
      const counts = result.processed.reduce((acc, item) => ({ ...acc, [item.outcome]: (acc[item.outcome] || 0) + 1 }), {});
      console.log(`channelTalkRetry: ${result.processed.length}건 처리, 남음 ${result.remaining}`, counts);
    } catch (error) {
      console.error(`channelTalkRetry: unhandled ${error && (error.code || error.name)}`);
    }
  },
);

module.exports = {
  channelTalkOnContactCreated,
  channelTalkOnLandingCreated,
  channelTalkOnOrderCreated,
  channelTalkOnUserCreated,
  channelTalkRetry,
};
