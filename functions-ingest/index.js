const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineString } = require("firebase-functions/params");
const { getGmailToken } = require("./google-auth");
const { listAllMessageIds, getMessage, normalizeMessage } = require("./gmail");
const { saveMessage, getIngestState, setIngestState } = require("./store");

// 리전을 빼면 us-central1 에 생긴다. 기존 functions/index.js 와 같은 이유다.
setGlobalOptions({ region: "asia-northeast3" });

initializeApp();

const INGEST_MAILBOXES = defineString("INGEST_MAILBOXES");

// 메일함은 side 의 기본값일 뿐이다. 계획 4에서 주소 매칭·수동 정정이 가능하다.
const SIDE_BY_DOMAIN = {
  "medidakoslabs.com": "brand",
  "medidakos.com": "brand",
  "techasset.co.kr": "factory",
};

function sideOf(account) {
  return SIDE_BY_DOMAIN[account.split("@")[1]] ?? "unknown";
}

function channelOf(account) {
  return `gmail_${account.split("@")[0]}`;
}

async function ingestOne(db, account) {
  const token = await getGmailToken(account);
  const state = await getIngestState(db, account);

  const after = state.lastEpochSeconds == null
    ? null
    : Math.max(0, state.lastEpochSeconds - 5);
  const ids = await listAllMessageIds(token, { after });
  let newest = state.lastEpochSeconds ?? 0;

  for (const id of ids) {
    const raw = await getMessage(token, id);
    const normalized = normalizeMessage(raw, {
      channel: channelOf(account),
      side: sideOf(account),
      sideSource: "account_rule",
      account,
    });
    await saveMessage(db, normalized);
    newest = Math.max(newest, Math.floor(Number(raw.internalDate) / 1000));
  }

  await setIngestState(db, account, {
    lastEpochSeconds: newest || state.lastEpochSeconds,
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    processedCount: ids.length,
  });
  return ids.length;
}

exports.ingestGmail = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "Asia/Seoul", timeoutSeconds: 540 },
  async () => {
    const db = getFirestore();
    const mailboxes = INGEST_MAILBOXES.value()
      .split(",").map((s) => s.trim()).filter(Boolean);

    for (const account of mailboxes) {
      try {
        const n = await ingestOne(db, account);
        console.log(`ingestGmail ${account}: ${n}통`);
      } catch (err) {
        // 한 메일함이 실패해도 나머지는 계속한다.
        console.error(`ingestGmail ${account} 실패:`, err.message);
        await setIngestState(db, account, {
          lastAttemptAt: new Date().toISOString(),
          lastError: err.message,
        });
      }
    }
  },
);
