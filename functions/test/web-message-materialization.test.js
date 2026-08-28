/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  MAX_BODY_LENGTH,
  buildWebProjection,
  materializeWebSubmission,
} = require("../web-message-materializer");

function fakeDb(existing = {}) {
  const writes = [];
  const docs = new Map(Object.entries(existing));
  const db = {
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return { key, name, id };
        },
      };
    },
    async runTransaction(callback) {
      const tx = {
        async get(ref) {
          const data = docs.get(ref.key);
          return { exists: Boolean(data), data: () => data };
        },
        create(ref, data) {
          writes.push({ type: "create", key: ref.key, data });
          docs.set(ref.key, data);
        },
        update(ref, data) {
          writes.push({ type: "update", key: ref.key, data });
        },
      };
      await callback(tx);
    },
    writes,
  };
  return db;
}

const fixedNow = "2026-08-28T00:00:00.000Z";

test("web projection is deterministic and does not project finance fields", () => {
  const source = {
    companyName: "Acme <script>alert(1)</script>",
    contactName: "Jane\u0000 Doe",
    email: "jane@example.com",
    message: "Please use <b>vegan</b> & fragrance-free.",
    supplierQuote: 999,
    grossProfit: 888,
    internalCost: 777,
    createdAt: fixedNow,
  };
  const first = buildWebProjection("contact", "abc/123", source, fixedNow);
  const second = buildWebProjection("contact", "abc/123", source, fixedNow);

  assert.deepEqual(first, second);
  assert.equal(first.message.channel, "web");
  assert.equal(first.message.direction, "in");
  assert.equal(first.message.to.length, 0);
  assert.equal(first.message.side, "brand");
  assert.equal(first.message.sideSource, "account_rule");
  assert.doesNotMatch(first.message.bodyText, /&lt;/);
  assert.match(first.message.bodyText, /<b>vegan<\/b>/);
  assert.doesNotMatch(first.message.bodyText, /999|888|777/);
  assert.ok(first.message.bodyText.length <= MAX_BODY_LENGTH);
  assert.equal(first.message.from, "jane@example.com");
  assert.equal(first.threadKey, first.message.threadKey);
});

test("order and sample projections use only useful buyer-facing source facts", () => {
  const order = buildWebProjection("orders", "order-1", {
    type: "custom",
    title: "Serum",
    summary: "Fragrance-free",
    status: "submitted",
    customerEmail: "buyer@example.com",
    supplierPrice: "private",
    createdAt: fixedNow,
  }, fixedNow);
  const sample = buildWebProjection("sampleRequests", "sample-1", {
    sampleProductId: "serum-1",
    sampleProductName: "Serum",
    sampleQuantity: 2,
    shippingAddress: { recipientName: "Buyer", country: "US", address: "private" },
    margin: 99,
    createdAt: fixedNow,
  }, fixedNow);

  assert.match(order.message.bodyText, /Serum/);
  assert.match(sample.message.bodyText, /Buyer/);
  assert.doesNotMatch(order.message.bodyText, /private/);
  assert.doesNotMatch(sample.message.bodyText, /private/);
});

test("materializer creates one message and thread transactionally", async () => {
  const db = fakeDb();
  const data = {
    companyName: "Acme",
    email: "jane@example.com",
    message: "Hello",
    createdAt: fixedNow,
  };

  const result = await materializeWebSubmission(db, "contact", "contact-1", data, { now: fixedNow });

  assert.equal(result.created, true);
  assert.equal(db.writes.length, 2);
  assert.deepEqual(db.writes.map((write) => write.type), ["create", "create"]);
  assert.equal(db.writes[0].key, "messages/web_contact_contact-1");
  assert.equal(db.writes[1].key, "threads/web:contact:contact:contact-1");
  assert.equal(db.writes[0].data.threadKey, db.writes[1].key.slice("threads/".length));
});

test("retry does not create duplicates and repairs a missing thread", async () => {
  const data = { email: "jane@example.com", message: "Hello", createdAt: fixedNow };
  const firstDb = fakeDb();
  const first = await materializeWebSubmission(firstDb, "contact", "contact-2", data, { now: fixedNow });
  const existingMessage = firstDb.writes.find((write) => write.key.startsWith("messages/")).data;
  const secondDb = fakeDb({ [`messages/${first.messageId}`]: existingMessage });
  const repaired = await materializeWebSubmission(secondDb, "contact", "contact-2", data, { now: fixedNow });
  assert.equal(repaired.created, false);
  assert.equal(secondDb.writes.length, 1);
  assert.match(secondDb.writes[0].key, /^threads\//);

  const completeDb = fakeDb({
    [`messages/${first.messageId}`]: existingMessage,
    [`threads/${first.threadKey}`]: firstDb.writes.find((write) => write.key.startsWith("threads/")).data,
  });
  await materializeWebSubmission(completeDb, "contact", "contact-2", data, { now: fixedNow });
  assert.equal(completeDb.writes.length, 0);
});

test("test submissions follow source policy", async () => {
  const db = fakeDb();
  const data = { isTest: true, email: "test@example.com", message: "test" };
  const skipped = await materializeWebSubmission(db, "koreaLeads", "lead-1", data, {
    skipTest: true,
    now: fixedNow,
  });
  assert.equal(skipped.skipped, true);
  assert.equal(db.writes.length, 0);

  const materialized = await materializeWebSubmission(db, "contact", "contact-test", data, {
    now: fixedNow,
  });
  assert.equal(materialized.created, true);
  assert.equal(db.writes.length, 2);
});
