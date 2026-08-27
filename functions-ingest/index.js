const { initializeApp } = require("firebase-admin/app");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineString } = require("firebase-functions/params");

// 리전을 빼면 us-central1 에 생긴다. 기존 functions/index.js 와 같은 이유다.
setGlobalOptions({ region: "asia-northeast3" });

initializeApp();

const INGEST_MAILBOXES = defineString("INGEST_MAILBOXES");

exports.ingestGmail = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "Asia/Seoul" },
  async () => {
    const mailboxes = INGEST_MAILBOXES.value()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log("ingestGmail: 대상 메일함", mailboxes.length, "개");
    // Task 5 에서 실제 수집이 들어온다.
  },
);
