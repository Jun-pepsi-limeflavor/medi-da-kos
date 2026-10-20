/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * lastContactAt 웹훅 수신 함수(HTTP). 판정·보호 규칙은 last-contact.js.
 *
 * functions/index.js에서 내보낸다. 배포는 이 함수만 선택 배포한다(전체 배포 금지).
 * 배포 전에 Secret CHANNELTALK_WEBHOOK_TOKEN이 있어야 한다. Desk 웹훅 등록은 observe 배포 뒤에 한다
 * (docs/plans/2026-10-19-channeltalk-v2.md 6장).
 * - 기본 모드 off. 모드는 functions/.env의 CHANNELTALK_LAST_CONTACT_MODE(off|observe|on).
 * - 최대 인스턴스 1·동시 처리 1: 한 번에 하나씩 처리해 날짜가 과거로 되돌아가지 않게 한다.
 * - PATCH는 V1과 같은 웹 접수 키를 쓰고, on 모드에서만 클라이언트를 만든다.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { defineSecret, defineString } = require("firebase-functions/params");
const { createChannelTalkApi } = require("./api");
const { createWebhookHandler } = require("./last-contact");

const REGION = "asia-northeast3";
const MODE = defineString("CHANNELTALK_LAST_CONTACT_MODE", { default: "off" });
const API_VERSION = defineString("CHANNELTALK_INTAKE_API_VERSION", { default: "2026-06-01" });
const WEBHOOK_TOKEN = defineSecret("CHANNELTALK_WEBHOOK_TOKEN");
const ACCESS_KEY = defineSecret("CHANNELTALK_INTAKE_ACCESS_KEY");
const ACCESS_SECRET = defineSecret("CHANNELTALK_INTAKE_ACCESS_SECRET");

let api = null;
const handler = createWebhookHandler({
  getMode: () => MODE.value(),
  getToken: () => WEBHOOK_TOKEN.value(),
  getApi: () => {
    api = api || createChannelTalkApi({ accessKey: ACCESS_KEY.value(), accessSecret: ACCESS_SECRET.value(), version: API_VERSION.value() });
    return api;
  },
  log: (entry) => {
    const { level, ...rest } = entry;
    if (level === "error") logger.error("channelTalkLastContact", rest);
    else if (level === "warn") logger.warn("channelTalkLastContact", rest);
    else logger.info("channelTalkLastContact", rest);
  },
});

const channelTalkLastContactWebhook = onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    maxInstances: 1,
    concurrency: 1,
    serviceAccount: "webhook-sa@medidakos.iam.gserviceaccount.com",
    secrets: [WEBHOOK_TOKEN, ACCESS_KEY, ACCESS_SECRET],
  },
  async (req, res) => {
    const result = await handler(req);
    res.status(result.status).send(result.body);
  },
);

module.exports = {
  channelTalkLastContactWebhook,
};
