/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildOrderFields, buildItemsSummary, formatItemsSummaryText, syncOrderToNotion } = require("../notion-sync");

function fakeOrdersDb(existing = {}) {
  const docs = new Map(Object.entries(existing));
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = docs.get(key);
              return { exists: Boolean(data), data: () => data };
            },
            async set(data, opts) {
              if (opts?.merge) {
                docs.set(key, { ...(docs.get(key) || {}), ...data });
              } else {
                docs.set(key, data);
              }
            },
          };
        },
      };
    },
  };
}

function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const fetchImpl = async (url, init) => {
    const call = { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
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
  emailPropertyType: "email",
  propertyNames: {
    name: "이름",
    email: "이메일",
    items: "품목",
    synced: "메일이력생성됨",
    createdAt: "생성일",
  },
};

function emptyChildrenPage() {
  return { json: { results: [], has_more: false, next_cursor: null } };
}

const baseOrder = {
  type: "custom",
  title: "커스텀 크림",
  summary: "50ml 튜브",
  status: "submitted",
  createdAt: "2026-09-01T00:00:00.000Z",
};

test("buildOrderFields reads the real CMBrief field names (colorHex, fragranceNotes, PackagingSelection[])", () => {
  const fields = buildOrderFields({
    type: "custom",
    status: "submitted",
    briefSnapshot: {
      step1: { selection: "skincare" },
      step2: {
        selections: [
          { group: "Bottle", items: ["Glass"] },
          { group: "Cap", items: ["Pump", "Flip-top"] },
        ],
      },
      step4: { orderQuantity: "3000", unit: "ml", volume: "50" },
      step5: { colorHex: "#F5E6D3", viscosity: "중간", fragranceNotes: "light floral" },
      step6: { productName: "수분 크림", vegan: true, internationalCertifications: ["ISO 22716 GMP"] },
    },
  });
  assert.deepEqual(fields, [
    ["카테고리", "Skin Care"],
    ["제품명", "수분 크림"],
    ["용량", "50ml"],
    ["주문 수량", "3000개"],
    ["포장", "Bottle: Glass / Cap: Pump, Flip-top"],
    ["색상", "#F5E6D3"],
    ["점도(제형)", "중간"],
    ["향", "light floral"],
    ["비건", "필요"],
    ["인증", "ISO 22716 GMP"],
    ["상태", "submitted"],
  ]);
});

test("buildOrderFields marks quantity as TBD and renders unscented/fragrance-free flags", () => {
  const fields = buildOrderFields({
    briefSnapshot: {
      step4: { orderQuantityTbd: true, volume: "100", unit: "g" },
      step5: { unscented: true, viscosity: "묽음" },
    },
  });
  assert.deepEqual(fields, [
    ["용량", "100g"],
    ["주문 수량", "미정 (TBD)"],
    ["점도(제형)", "묽음"],
    ["향", "무향 (Unscented)"],
  ]);
});

test("buildOrderFields falls back to title/summary without a briefSnapshot", () => {
  const fields = buildOrderFields({
    type: "sample",
    title: "샘플 A",
    summary: "10ml x 5",
  });
  assert.deepEqual(fields, [
    ["제목", "샘플 A"],
    ["요약", "10ml x 5"],
  ]);
});

test("buildItemsSummary keeps only 제품명/수량/인증/핵심 성분 for the 품목 property", () => {
  const rows = buildItemsSummary({
    briefSnapshot: {
      step2: { selections: [{ group: "Bottle", items: ["Glass"] }] },
      step4: { orderQuantity: "3000" },
      step5: { colorHex: "#F5E6D3", viscosity: "중간" },
      step6: {
        productName: "수분 크림",
        conceptIngredients: "niacinamide 5%",
        internationalCertifications: ["ISO 22716 GMP", "EU CPNP"],
      },
    },
  });
  assert.deepEqual(rows, [
    ["제품명", "수분 크림"],
    ["수량", "3000개"],
    ["인증", "ISO 22716 GMP, EU CPNP"],
    ["핵심 성분", "niacinamide 5%"],
  ]);
  assert.equal(
    formatItemsSummaryText({
      briefSnapshot: { step6: { productName: "수분 크림" } },
    }),
    "제품명: 수분 크림",
  );
});

test("syncOrderToNotion skips silently when Notion isn't configured", async () => {
  const db = fakeOrdersDb();
  const { fetchImpl, calls } = mockFetch([]);
  const result = await syncOrderToNotion({
    db,
    orderId: "order-1",
    order: baseOrder,
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    notion: { apiKey: "", databaseId: "" },
    fetchImpl,
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "not-configured");
  assert.equal(calls.length, 0);
});

test("syncOrderToNotion skips when the order has no customer email", async () => {
  const db = fakeOrdersDb();
  const { fetchImpl, calls } = mockFetch([]);
  const result = await syncOrderToNotion({
    db,
    orderId: "order-2",
    order: baseOrder,
    customerEmail: null,
    customerName: null,
    notion: notionConfig,
    fetchImpl,
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "no-email");
  assert.equal(calls.length, 0);
});

test("syncOrderToNotion skips when the order was already synced", async () => {
  const db = fakeOrdersDb({
    "orders/order-3": { notionSync: { status: "success", pageId: "page-x" } },
  });
  const { fetchImpl, calls } = mockFetch([]);
  const result = await syncOrderToNotion({
    db,
    orderId: "order-3",
    order: baseOrder,
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    notion: notionConfig,
    fetchImpl,
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "already-synced");
  assert.equal(calls.length, 0);
});

test("syncOrderToNotion creates a new customer page, subpages, and the order table when none matches the email", async () => {
  const db = fakeOrdersDb();
  const { fetchImpl, calls } = mockFetch([
    { json: { results: [] } }, // findCustomerPage: no match
    { json: { id: "page-new" } }, // createCustomerPage
    emptyChildrenPage(), // ensureSectionPages: listAllChildren on the fresh page
    { json: { id: "orders-page" } }, // createSubPage "주문 내역"
    { json: { id: "history-page" } }, // createSubPage "이메일 이력"
    { json: {} }, // appendOrderSection -> orders-page
  ]);
  const result = await syncOrderToNotion({
    db,
    orderId: "order-4",
    order: baseOrder,
    customerEmail: "buyer@example.com",
    customerName: "Buyer",
    notion: notionConfig,
    fetchImpl,
    now: () => "2026-09-04T00:00:00.000Z",
  });
  assert.equal(result.skipped, false);
  assert.equal(result.pageId, "page-new");
  assert.equal(calls.length, 6);
  assert.match(calls[0].url, /\/databases\/db-1\/query$/);

  assert.equal(calls[1].url, "https://api.notion.com/v1/pages");
  assert.equal(calls[1].body.properties["이메일"].email, "buyer@example.com");
  assert.equal(calls[1].body.properties["생성일"].date.start, "2026-09-01T00:00:00.000Z");
  assert.equal("children" in calls[1].body, false); // 프로필 페이지 자체엔 더 이상 표를 넣지 않는다

  assert.equal(calls[2].url, "https://api.notion.com/v1/blocks/page-new/children");
  assert.equal(calls[2].method, "GET");

  assert.equal(calls[3].body.parent.page_id, "page-new");
  assert.equal(calls[3].body.properties.title.title[0].text.content, "주문 내역");
  assert.equal(calls[4].body.properties.title.title[0].text.content, "이메일 이력");

  assert.equal(calls[5].url, "https://api.notion.com/v1/blocks/orders-page/children");
  const [headingBlock, tableBlock] = calls[5].body.children;
  assert.equal(headingBlock.type, "heading_3");
  assert.equal(tableBlock.type, "table");
  assert.equal(tableBlock.table.table_width, 2);
  const headerRow = tableBlock.table.children[0].table_row.cells;
  assert.deepEqual(headerRow.map((c) => c[0].text.content), ["항목", "내용"]);

  const stored = db.docs.get("orders/order-4");
  assert.equal(stored.notionSync.status, "success");
  assert.equal(stored.notionSync.pageId, "page-new");
});

test("syncOrderToNotion appends a section to an existing customer's existing 주문 내역 subpage", async () => {
  const db = fakeOrdersDb();
  const { fetchImpl, calls } = mockFetch([
    { json: { results: [{ id: "page-existing" }] } }, // findCustomerPage: match
    { json: {} }, // updatePageProperties: 생성일
    {
      json: {
        results: [
          { type: "child_page", id: "orders-page", child_page: { title: "주문 내역" } },
          { type: "child_page", id: "history-page", child_page: { title: "이메일 이력" } },
        ],
        has_more: false,
      },
    }, // ensureSectionPages: listAllChildren finds both already
    { json: {} }, // appendOrderSection -> orders-page
  ]);
  const result = await syncOrderToNotion({
    db,
    orderId: "order-5",
    order: baseOrder,
    customerEmail: "repeat@example.com",
    customerName: "Repeat Buyer",
    notion: notionConfig,
    fetchImpl,
  });
  assert.equal(result.pageId, "page-existing");
  assert.equal(calls.length, 4);
  assert.equal(calls[1].url, "https://api.notion.com/v1/pages/page-existing");
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].body.properties["생성일"].date.start, "2026-09-01T00:00:00.000Z");
  assert.equal(calls[3].url, "https://api.notion.com/v1/blocks/orders-page/children");
  assert.equal(calls[3].method, "PATCH");
});

test("syncOrderToNotion records an error and rethrows on Notion API failure", async () => {
  const db = fakeOrdersDb();
  const { fetchImpl } = mockFetch([{ ok: false, status: 401, json: { message: "unauthorized" } }]);
  await assert.rejects(
    () =>
      syncOrderToNotion({
        db,
        orderId: "order-6",
        order: baseOrder,
        customerEmail: "buyer@example.com",
        customerName: "Buyer",
        notion: notionConfig,
        fetchImpl,
      }),
    /unauthorized/,
  );
  const stored = db.docs.get("orders/order-6");
  assert.equal(stored.notionSync.status, "error");
});
