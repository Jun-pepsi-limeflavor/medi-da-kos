/* eslint-disable @typescript-eslint/no-require-imports */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineString } = require("firebase-functions/params");
const {
  DEFAULT_GMAIL_MAILBOXES,
  getApprovedMailbox,
  getGmailToken,
  normalizeMailboxConfig,
} = require("./google-auth");
const { listAllMessageIds, getMessage, normalizeMessage: normalizeGmailMessage } = require("./gmail");
const {
  GraphRequestError,
  getClientCredentialsToken,
  listDeltaPages,
  normalizeMessage: normalizeOutlookMessage,
} = require("./outlook");
const {
  listAllChatMessages,
  listAllUserChats,
  normalizeMessage: normalizeChannelTalkMessage,
} = require("./channeltalk");
const { saveMessage, getIngestState, setIngestState } = require("./store");

setGlobalOptions({ region: "asia-northeast3" });
initializeApp();

const INGEST_MAILBOXES = defineString("INGEST_MAILBOXES");
const INGEST_INITIAL_AFTER = defineString("INGEST_INITIAL_AFTER", { default: "" });

const INITIAL_BACKFILL_DAYS = 30;

function initialEpochSeconds(value, now = Date.now()) {
  if (!value || !value.trim()) return Math.floor(now / 1000) - INITIAL_BACKFILL_DAYS * 24 * 60 * 60;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error("INGEST_INITIAL_AFTER must be an ISO timestamp");
  return Math.floor(parsed / 1000);
}

function parseMailboxList(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("INGEST_MAILBOXES must list approved Gmail mailboxes");
  }
  const entries = value.split(",").map((raw) => {
    const account = raw.trim();
    if (!account) throw new Error("INGEST_MAILBOXES must not contain blank mailboxes");
    const approved = getApprovedMailbox(account);
    if (!approved) throw new Error(`Gmail mailbox is not approved: ${account}`);
    return { account, channel: approved.channel, enabled: approved.enabled };
  });
  return normalizeMailboxConfig(entries);
}

function gmailContext(account) {
  const approved = getApprovedMailbox(account);
  if (!approved) throw new Error(`Gmail mailbox is not approved: ${account}`);
  const domain = account.split("@")[1];
  return {
    channel: approved.channel,
    side: domain === "medidakoslabs.com" || domain === "medidakos.com" ? "brand" : "factory",
    sideSource: "account_rule",
    account,
  };
}

async function ingestGmailAccount(db, account, options = {}) {
  const deps = options.deps || {
    getGmailToken,
    getIngestState,
    getMessage,
    listAllMessageIds,
    normalizeGmailMessage,
    saveMessage,
    setIngestState,
  };
  const state = await deps.getIngestState(db, account);
  const initialAfter = initialEpochSeconds(options.initialAfter, options.now);
  const checkpoint = state.lastEpochSeconds == null ? initialAfter : state.lastEpochSeconds;
  const after = Math.max(0, checkpoint - 5);
  let processedCount = 0;
  let newest = checkpoint;

  // getGmailToken rejects unverified domains. We deliberately record that per
  // requested mailbox rather than silently treating it as a successful skip.
  const token = await deps.getGmailToken(account, { purpose: "read" });
  const ids = await deps.listAllMessageIds(token, { after });
  for (const id of ids) {
    const raw = await deps.getMessage(token, id);
    await deps.saveMessage(db, deps.normalizeGmailMessage(raw, gmailContext(account)));
    newest = Math.max(newest, Math.floor(Number(raw.internalDate) / 1000));
    processedCount += 1;
  }

  const now = new Date(options.now ?? Date.now()).toISOString();
  await deps.setIngestState(db, account, {
    lastEpochSeconds: newest,
    initialEpochSeconds: state.initialEpochSeconds ?? initialAfter,
    lastAttemptAt: now,
    lastSuccessAt: now,
    lastError: null,
    processedCount,
  });
  return processedCount;
}

async function ingestOutlookAccount(db, config, options = {}) {
  const stateKey = `outlook:${config.mailbox.toLowerCase()}`;
  const state = await getIngestState(db, stateKey);
  const token = await getClientCredentialsToken(config);
  const since = new Date(initialEpochSeconds(options.initialAfter, options.now) * 1000).toISOString();
  let result;
  let deltaResetError = null;
  try {
    result = await listDeltaPages(token, {
      mailbox: config.mailbox,
      deltaLink: state.deltaLink || undefined,
      since,
    });
  } catch (error) {
    if (!(error instanceof GraphRequestError) || error.code !== "DELTA_EXPIRED") throw error;
    // A stale delta cursor is never re-used. The bounded reset stays visible
    // in state even when the replacement read subsequently succeeds.
    deltaResetError = "DELTA_EXPIRED";
    result = await listDeltaPages(token, { mailbox: config.mailbox, since });
  }

  let processedCount = 0;
  for (const raw of result.messages) {
    await saveMessage(db, normalizeOutlookMessage(raw, { account: config.mailbox }));
    processedCount += 1;
  }
  if (!result.deltaLink) throw new Error("Outlook delta round completed without a deltaLink");

  const now = new Date(options.now ?? Date.now()).toISOString();
  await setIngestState(db, stateKey, {
    deltaLink: result.deltaLink,
    lastAttemptAt: now,
    lastSuccessAt: now,
    lastError: null,
    lastDeltaResetError: deltaResetError,
    processedCount,
  });
  return processedCount;
}

async function ingestChannelTalkAccount(db, config, options = {}) {
  const stateKey = `channeltalk:${config.account}`;
  const nowMs = options.now ?? Date.now();
  const chats = await listAllUserChats(config.credentials, { state: "opened" });
  let processedCount = 0;

  for (const chat of chats.userChats) {
    if (!chat || typeof chat.id !== "string" || !chat.id) {
      throw new Error("Channel Talk user-chat is missing an id");
    }
    const messages = await listAllChatMessages(chat.id, config.credentials);
    for (const raw of messages.messages) {
      await saveMessage(db, normalizeChannelTalkMessage(raw, {
        account: config.account,
        user: chat.user || chat.customer || chat.contact,
        userChatId: chat.id,
      }));
      processedCount += 1;
    }
  }

  const now = new Date(nowMs).toISOString();
  await setIngestState(db, stateKey, {
    lastPollAt: now,
    lastAttemptAt: now,
    lastSuccessAt: now,
    lastError: null,
    processedCount,
  });
  return processedCount;
}

async function recordFailure(db, stateKey, error, now = Date.now()) {
  await setIngestState(db, stateKey, {
    lastAttemptAt: new Date(now).toISOString(),
    lastError: error instanceof Error ? error.message : "ingest failed",
  });
}

async function runAllIngestions({ db, gmailMailboxes, outlook, channelTalk, initialAfter, deps = {}, logger = console }) {
  const gmailIngest = deps.ingestGmailAccount || ingestGmailAccount;
  const outlookIngest = deps.ingestOutlookAccount || ingestOutlookAccount;
  const channelTalkIngest = deps.ingestChannelTalkAccount || ingestChannelTalkAccount;
  const failureRecorder = deps.recordFailure || recordFailure;
  for (const mailbox of gmailMailboxes) {
    const stateKey = mailbox.account;
    try {
      const count = await gmailIngest(db, mailbox.account, { initialAfter });
      logger.log(`ingest Gmail ${mailbox.account}: ${count} messages`);
    } catch (error) {
      logger.error(`ingest Gmail ${mailbox.account} failed: ${error instanceof Error ? error.message : "unknown"}`);
      await failureRecorder(db, stateKey, error);
    }
  }

  if (outlook) {
    const stateKey = `outlook:${outlook.mailbox.toLowerCase()}`;
    try {
      const count = await outlookIngest(db, outlook, { initialAfter });
      logger.log(`ingest Outlook ${outlook.mailbox}: ${count} messages`);
    } catch (error) {
      logger.error(`ingest Outlook ${outlook.mailbox} failed: ${error instanceof Error ? error.message : "unknown"}`);
      await failureRecorder(db, stateKey, error);
    }
  }

  if (channelTalk) {
    const stateKey = `channeltalk:${channelTalk.account}`;
    try {
      const count = await channelTalkIngest(db, channelTalk);
      logger.log(`ingest Channel Talk ${channelTalk.account}: ${count} messages`);
    } catch (error) {
      logger.error(`ingest Channel Talk ${channelTalk.account} failed: ${error instanceof Error ? error.message : "unknown"}`);
      await failureRecorder(db, stateKey, error);
    }
  }
}

const ingestGmail = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "Asia/Seoul",
    timeoutSeconds: 540,
  },
  async () => {
    const gmailMailboxes = parseMailboxList(INGEST_MAILBOXES.value());
    const channelTalkKey = process.env.CHANNELTALK_ACCESS_KEY || "";
    const channelTalkSecret = process.env.CHANNELTALK_ACCESS_SECRET || "";
    const channelTalkConfig =
      channelTalkKey && channelTalkSecret
        ? {
            account: "main",
            credentials: {
              accessKey: channelTalkKey,
              accessSecret: channelTalkSecret,
              channelVersion: process.env.CHANNELTALK_CHANNEL_VERSION || "5",
            },
          }
        : null;

    await runAllIngestions({
      db: getFirestore(),
      gmailMailboxes,
      outlook: null,
      channelTalk: channelTalkConfig,
      initialAfter: INGEST_INITIAL_AFTER.value(),
    });
  },
);

module.exports = {
  DEFAULT_GMAIL_MAILBOXES,
  gmailContext,
  ingestChannelTalkAccount,
  ingestGmailAccount,
  ingestOutlookAccount,
  initialEpochSeconds,
  ingestGmail,
  parseMailboxList,
  runAllIngestions,
};
