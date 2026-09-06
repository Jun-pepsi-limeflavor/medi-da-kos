/* eslint-disable @typescript-eslint/no-require-imports */
const {
  notionRequest,
  paragraphBlock,
  tableRow,
  tableBlock,
  pageMention,
  createSubPage,
  ensureSectionPages,
} = require("./notion-sync");

const MAX_BLOCKS_PER_APPEND = 100;
const MAX_MESSAGES_PER_CUSTOMER = 200;
const HISTORY_TABLE_HEADER = ["구분", "날짜", "제목", "내용"];

function extractEmailFromProperty(property) {
  if (!property) return null;
  if (property.type === "email") return property.email || null;
  if (property.type === "rich_text") {
    return property.rich_text?.map((t) => t.plain_text).join("").trim() || null;
  }
  if (property.type === "title") {
    return property.title?.map((t) => t.plain_text).join("").trim() || null;
  }
  return null;
}

async function findPendingCustomerPages({ apiKey, databaseId, syncedProperty, emailProperty, fetchImpl }) {
  const json = await notionRequest({
    apiKey,
    method: "POST",
    path: `/databases/${databaseId}/query`,
    body: {
      filter: { property: syncedProperty, checkbox: { equals: false } },
      page_size: 50,
    },
    fetchImpl,
  });
  return (json.results || [])
    .map((page) => ({
      pageId: page.id,
      email: extractEmailFromProperty(page.properties?.[emailProperty]),
    }))
    .filter((p) => p.email);
}

function dedupeById(docs) {
  const seen = new Map();
  for (const doc of docs) seen.set(doc.id, doc);
  return Array.from(seen.values());
}

/**
 * `messages.from`은 문자열, `messages.to`는 배열이라(functions-ingest/store.js)
 * OR 조건을 Firestore 쿼리 하나로 못 표현한다. 두 번 조회해 합친다.
 */
async function fetchEmailHistory({ db, email }) {
  const [fromSnap, toSnap] = await Promise.all([
    db.collection("messages").where("from", "==", email).limit(MAX_MESSAGES_PER_CUSTOMER).get(),
    db.collection("messages").where("to", "array-contains", email).limit(MAX_MESSAGES_PER_CUSTOMER).get(),
  ]);
  const merged = dedupeById([...fromSnap.docs, ...toSnap.docs]).map((doc) => doc.data());
  merged.sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));
  return merged.slice(0, MAX_MESSAGES_PER_CUSTOMER);
}

function formatKoDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

/** 2000자 rich_text 한계 때문에 긴 본문은 문단 여러 개로 쪼갠다 — 잘라내지 않는다. */
function chunkText(text, size = 1900) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks.length ? chunks : ["(본문 없음)"];
}

function messageDetailTitle(message) {
  const direction = message.direction === "in" ? "수신" : "발신";
  return `[${direction}] ${formatKoDate(message.sentAt)} · ${message.subject || "(제목 없음)"}`;
}

function buildMessageDetailBlocks(message) {
  const direction = message.direction === "in" ? "수신" : "발신";
  const meta = [
    `구분: ${direction}`,
    `날짜: ${formatKoDate(message.sentAt)}`,
    `제목: ${message.subject || "(제목 없음)"}`,
    `보낸 사람: ${message.from || "-"}`,
    `받는 사람: ${Array.isArray(message.to) ? message.to.join(", ") : message.to || "-"}`,
  ];
  const blocks = meta.map((line) => paragraphBlock(line));
  const body = typeof message.bodyText === "string" && message.bodyText.trim() ? message.bodyText : "";
  for (const chunk of chunkText(body)) blocks.push(paragraphBlock(chunk));
  return blocks;
}

/** 메일 한 통의 전체 내용을 담은 하위 페이지를 만든다 — 표 칸 안에 길게 늘어놓지 않기 위해. */
async function createMessageDetailPage({ apiKey, parentPageId, message, fetchImpl }) {
  return createSubPage({
    apiKey,
    parentPageId,
    title: messageDetailTitle(message),
    children: buildMessageDetailBlocks(message),
    fetchImpl,
  });
}

/** 표 한 행 — "내용" 칸은 스니펫이 아니라 전체 내용 페이지로 가는 링크(멘션)다. */
async function buildHistoryRow({ apiKey, historyPageId, message, fetchImpl }) {
  const detailPageId = await createMessageDetailPage({ apiKey, parentPageId: historyPageId, message, fetchImpl });
  const direction = message.direction === "in" ? "수신" : "발신";
  return [direction, formatKoDate(message.sentAt), message.subject || "(제목 없음)", pageMention(detailPageId)];
}

async function appendBlocks({ apiKey, pageId, children, fetchImpl }) {
  const results = [];
  for (let i = 0; i < children.length; i += MAX_BLOCKS_PER_APPEND) {
    const json = await notionRequest({
      apiKey,
      method: "PATCH",
      path: `/blocks/${pageId}/children`,
      body: { children: children.slice(i, i + MAX_BLOCKS_PER_APPEND) },
      fetchImpl,
    });
    results.push(...(json.results || []));
  }
  return results;
}

/** table 블록 자체에 표 행을 추가로 붙인다 (한 번에 최대 100행). */
async function appendTableRows({ apiKey, tableId, rows, fetchImpl }) {
  for (let i = 0; i < rows.length; i += MAX_BLOCKS_PER_APPEND) {
    await notionRequest({
      apiKey,
      method: "PATCH",
      path: `/blocks/${tableId}/children`,
      body: { children: rows.slice(i, i + MAX_BLOCKS_PER_APPEND).map((cells) => tableRow(cells)) },
      fetchImpl,
    });
  }
}

async function markSynced({ apiKey, pageId, syncedProperty, fetchImpl }) {
  await notionRequest({
    apiKey,
    method: "PATCH",
    path: `/pages/${pageId}`,
    body: { properties: { [syncedProperty]: { checkbox: true } } },
    fetchImpl,
  });
}

/**
 * 메시지가 0건이어도 완료 처리한다 — 그래야 다음 폴링에서 같은 페이지를 반복해서 재시도하지 않는다.
 * 표는 헤더+행을 한 번에 최대 100개까지만 만들 수 있어(Notion API 제약), 그 이상은
 * 테이블 블록 생성 후 그 블록에 행을 이어서 append한다. 메일 한 통마다 전체 내용을 담은
 * 하위 페이지를 먼저 만들고, 표의 "내용" 칸에는 그 페이지로 가는 링크만 남긴다 — 본문이
 * 길어도 표 한 칸에 다 욱여넣지 않기 위해서다.
 */
async function syncEmailHistoryForPage({ db, apiKey, pageId, email, syncedProperty, fetchImpl }) {
  const messages = await fetchEmailHistory({ db, email });
  const { historyPageId } = await ensureSectionPages({ apiKey, mainPageId: pageId, fetchImpl });

  if (!messages.length) {
    await appendBlocks({
      apiKey,
      pageId: historyPageId,
      children: [paragraphBlock("주고받은 이메일 이력이 없습니다.")],
      fetchImpl,
    });
  } else {
    const rows = [];
    for (const message of messages) {
      rows.push(await buildHistoryRow({ apiKey, historyPageId, message, fetchImpl }));
    }

    const firstBatchSize = MAX_BLOCKS_PER_APPEND - 1; // 헤더 행도 자식 1개로 친다
    const firstBatch = rows.slice(0, firstBatchSize);
    const rest = rows.slice(firstBatchSize);

    const created = await appendBlocks({
      apiKey,
      pageId: historyPageId,
      children: [tableBlock([HISTORY_TABLE_HEADER, ...firstBatch])],
      fetchImpl,
    });

    if (rest.length) {
      const tableBlockResult = created.find((block) => block.type === "table");
      if (tableBlockResult) {
        await appendTableRows({ apiKey, tableId: tableBlockResult.id, rows: rest, fetchImpl });
      }
    }
  }

  await markSynced({ apiKey, pageId, syncedProperty, fetchImpl });
  return messages.length;
}

function nowIso() {
  return new Date().toISOString();
}

async function syncPendingEmailHistories({ db, notion, fetchImpl = fetch, now = nowIso }) {
  if (!notion?.apiKey || !notion?.databaseId) {
    console.log("notion-email-history: NOTION 설정 없음 — 스킵");
    return { skipped: true, reason: "not-configured" };
  }

  const { apiKey, databaseId, propertyNames } = notion;
  const stateRef = db.collection("notionSyncState").doc("emailHistory");
  const pending = await findPendingCustomerPages({
    apiKey,
    databaseId,
    syncedProperty: propertyNames.synced,
    emailProperty: propertyNames.email,
    fetchImpl,
  });

  let succeeded = 0;
  let failed = 0;
  for (const { pageId, email } of pending) {
    try {
      const count = await syncEmailHistoryForPage({
        db,
        apiKey,
        pageId,
        email,
        syncedProperty: propertyNames.synced,
        fetchImpl,
      });
      succeeded += 1;
      console.log(`notion-email-history ${pageId} (${email}): 완료 (메시지 ${count}건)`);
    } catch (error) {
      failed += 1;
      console.error(`notion-email-history ${pageId} (${email}) 실패:`, error.message || error);
    }
  }

  await stateRef.set(
    { lastPolledAt: now(), pending: pending.length, succeeded, failed },
    { merge: true },
  );
  return { skipped: false, pending: pending.length, succeeded, failed };
}

module.exports = {
  extractEmailFromProperty,
  findPendingCustomerPages,
  fetchEmailHistory,
  buildHistoryRow,
  syncEmailHistoryForPage,
  syncPendingEmailHistories,
};
