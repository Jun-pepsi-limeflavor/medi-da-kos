/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  extractEmailFromProperty,
  fetchEmailHistory,
  syncEmailHistoryForPage,
  syncPendingEmailHistories,
} = require("../notion-email-history");

function fakeMessagesDb({ messages = [] } = {}) {
  const state = new Map();
  return {
    state,
    collection(name) {
      if (name === "messages") {
        return {
          where(field, op, value) {
            const filtered = messages.filter((m) => {
              if (op === "==") return m[field] === value;
              if (op === "array-contains") return Array.isArray(m[field]) && m[field].includes(value);
              return false;
            });
            return {
              limit() {
                return this;
              },
              async get() {
                return { docs: filtered.map((data) => ({ id: data.id, data: () => data })) };
              },
            };
          },
        };
      }
      if (name === "notionSyncState") {
        return {
          doc(id) {
            return {
              async set(data, opts) {
                state.set(id, { ...(opts?.merge ? state.get(id) || {} : {}), ...data });
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };
}

function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected fetch call: ${init.method} ${url}`);
    return {
      ok: next.ok !== false,
      status: next.status || 200,
      async json() {
        return next.json ?? {};
      },
    };
  };
  return { calls, fetchImpl };
}

const notionConfig = {
  apiKey: "secret_test",
  databaseId: "db-1",
  propertyNames: { name: "이름", email: "이메일", items: "품목", synced: "메일이력생성됨" },
};

/** ensureSectionPages()가 두 하위 페이지를 이미 찾은 것으로 치는 listAllChildren 응답. */
function existingSectionPagesResponse() {
  return {
    json: {
      results: [
        { type: "child_page", id: "orders-page", child_page: { title: "주문 내역" } },
        { type: "child_page", id: "history-page", child_page: { title: "이메일 이력" } },
      ],
      has_more: false,
    },
  };
}

test("extractEmailFromProperty reads email, rich_text, and title property shapes", () => {
  assert.equal(extractEmailFromProperty({ type: "email", email: "a@example.com" }), "a@example.com");
  assert.equal(
    extractEmailFromProperty({ type: "rich_text", rich_text: [{ plain_text: "b@example.com" }] }),
    "b@example.com",
  );
  assert.equal(
    extractEmailFromProperty({ type: "title", title: [{ plain_text: "c@example.com" }] }),
    "c@example.com",
  );
  assert.equal(extractEmailFromProperty({ type: "number", number: 1 }), null);
  assert.equal(extractEmailFromProperty(null), null);
});

test("fetchEmailHistory merges inbound/outbound messages, dedupes, and sorts by sentAt", async () => {
  const db = fakeMessagesDb({
    messages: [
      { id: "m2", from: "buyer@example.com", to: ["support@medidakos.com"], sentAt: "2026-09-02T00:00:00.000Z" },
      { id: "m1", from: "support@medidakos.com", to: ["buyer@example.com"], sentAt: "2026-09-01T00:00:00.000Z" },
      { id: "m3", from: "other@example.com", to: ["someone-else@example.com"], sentAt: "2026-09-03T00:00:00.000Z" },
    ],
  });
  const history = await fetchEmailHistory({ db, email: "buyer@example.com" });
  assert.deepEqual(history.map((m) => m.id), ["m1", "m2"]);
});

test("syncEmailHistoryForPage creates a detail page per message and links it from the table", async () => {
  const db = fakeMessagesDb({
    messages: [
      {
        id: "m1",
        from: "buyer@example.com",
        to: ["support@medidakos.com"],
        sentAt: "2026-09-01T00:00:00.000Z",
        direction: "in",
        subject: "문의",
        bodyText: "안녕하세요",
      },
    ],
  });
  const { fetchImpl, calls } = mockFetch([
    existingSectionPagesResponse(), // ensureSectionPages
    { json: { id: "detail-page-1" } }, // createMessageDetailPage for m1
    { json: {} }, // appendBlocks: table -> history-page
    { json: {} }, // markSynced
  ]);
  const count = await syncEmailHistoryForPage({
    db,
    apiKey: "secret_test",
    pageId: "page-1",
    email: "buyer@example.com",
    syncedProperty: "메일이력생성됨",
    fetchImpl,
  });
  assert.equal(count, 1);
  assert.equal(calls.length, 4);

  assert.equal(calls[0].url, "https://api.notion.com/v1/blocks/page-1/children");
  assert.equal(calls[0].method, "GET");

  assert.equal(calls[1].url, "https://api.notion.com/v1/pages");
  assert.equal(calls[1].body.parent.page_id, "history-page");
  assert.match(calls[1].body.properties.title.title[0].text.content, /^\[수신\]/);
  assert.match(calls[1].body.children.map((b) => b.paragraph.rich_text[0].text.content).join("\n"), /안녕하세요/);

  assert.equal(calls[2].url, "https://api.notion.com/v1/blocks/history-page/children");
  const [tableBlock] = calls[2].body.children;
  assert.equal(tableBlock.type, "table");
  assert.equal(tableBlock.table.table_width, 4);
  const dataRow = tableBlock.table.children[1].table_row.cells;
  assert.deepEqual(
    dataRow.slice(0, 3).map((c) => c[0].text.content),
    ["수신", "2026. 9. 1. 오전 9:00:00", "문의"],
  );
  assert.deepEqual(dataRow[3], [{ type: "mention", mention: { type: "page", page: { id: "detail-page-1" } } }]);

  assert.equal(calls[3].url, "https://api.notion.com/v1/pages/page-1");
  assert.deepEqual(calls[3].body.properties["메일이력생성됨"], { checkbox: true });
});

test("syncEmailHistoryForPage chunks past 99 rows by appending to the table block", async () => {
  const messages = Array.from({ length: 120 }, (_, i) => ({
    id: `m${i}`,
    from: "buyer@example.com",
    to: ["support@medidakos.com"],
    sentAt: `2026-09-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`,
    direction: "in",
    subject: `문의 ${i}`,
    bodyText: "hi",
  }));
  const db = fakeMessagesDb({ messages });
  const { fetchImpl, calls } = mockFetch([
    existingSectionPagesResponse(), // ensureSectionPages
    ...Array.from({ length: 120 }, () => ({ json: { id: "detail-page" } })), // one create-page per message
    { json: { results: [{ id: "table-block-2", type: "table" }] } }, // appendBlocks: table (99 rows)
    { json: {} }, // appendTableRows: remaining 21 rows
    { json: {} }, // markSynced
  ]);
  const count = await syncEmailHistoryForPage({
    db,
    apiKey: "secret_test",
    pageId: "page-big",
    email: "buyer@example.com",
    syncedProperty: "메일이력생성됨",
    fetchImpl,
  });
  assert.equal(count, 120);
  assert.equal(calls.length, 124); // 1 (ensure) + 120 (detail pages) + 1 (table) + 1 (rest rows) + 1 (markSynced)
  const tableCall = calls[121];
  assert.equal(tableCall.body.children[0].table.children.length, 100); // header + 99 rows
  const restCall = calls[122];
  assert.equal(restCall.url, "https://api.notion.com/v1/blocks/table-block-2/children");
  assert.equal(restCall.body.children.length, 21); // 120 - 99 remaining rows
  assert.equal(calls[123].url, "https://api.notion.com/v1/pages/page-big");
});

test("syncEmailHistoryForPage still marks synced when there is no history", async () => {
  const db = fakeMessagesDb({ messages: [] });
  const { fetchImpl, calls } = mockFetch([
    existingSectionPagesResponse(), // ensureSectionPages
    { json: {} }, // appendBlocks: "no history" paragraph -> history-page
    { json: {} }, // markSynced
  ]);
  const count = await syncEmailHistoryForPage({
    db,
    apiKey: "secret_test",
    pageId: "page-2",
    email: "nobody@example.com",
    syncedProperty: "메일이력생성됨",
    fetchImpl,
  });
  assert.equal(count, 0);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, "https://api.notion.com/v1/blocks/history-page/children");
});

test("syncPendingEmailHistories skips silently when Notion isn't configured", async () => {
  const db = fakeMessagesDb();
  const { fetchImpl, calls } = mockFetch([]);
  const result = await syncPendingEmailHistories({ db, notion: { apiKey: "", databaseId: "" }, fetchImpl });
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0);
});

test("syncPendingEmailHistories processes every pending page and records failures separately", async () => {
  const db = fakeMessagesDb({
    messages: [
      {
        id: "m1",
        from: "ok@example.com",
        to: ["support@medidakos.com"],
        sentAt: "2026-09-01T00:00:00.000Z",
        direction: "in",
        subject: "문의",
        bodyText: "hi",
      },
    ],
  });
  const { fetchImpl, calls } = mockFetch([
    // query pending pages
    {
      json: {
        results: [
          { id: "page-ok", properties: { 이메일: { type: "email", email: "ok@example.com" } } },
          { id: "page-fail", properties: { 이메일: { type: "email", email: "fail@example.com" } } },
        ],
      },
    },
    // page-ok: ensureSectionPages -> create detail page -> table -> markSynced
    existingSectionPagesResponse(),
    { json: { id: "detail-page-ok" } },
    { json: {} },
    { json: {} },
    // page-fail: ensureSectionPages itself fails
    { ok: false, status: 500, json: { message: "boom" } },
  ]);

  const result = await syncPendingEmailHistories({
    db,
    notion: notionConfig,
    fetchImpl,
    now: () => "2026-09-04T00:00:00.000Z",
  });

  assert.equal(result.skipped, false);
  assert.equal(result.pending, 2);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.equal(calls.length, 6);
  assert.deepEqual(db.state.get("emailHistory"), {
    lastPolledAt: "2026-09-04T00:00:00.000Z",
    pending: 2,
    succeeded: 1,
    failed: 1,
  });
});
