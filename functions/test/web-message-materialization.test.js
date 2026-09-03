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

test("landingRequests projection formats catalog and dashboard inquiries accurately", () => {
  const catalog = buildWebProjection("landingRequests", "req-cat-1", {
    landingVariant: "catalog",
    companyName: "Glow Brand",
    contactName: "Alice",
    email: "alice@glow.com",
    country: "United States",
    expectedVolume: "3,000 ~ 5,000",
    catalogItems: [{ id: "pdrn-serum", name: "PDRN Glow Booster", category: "serum" }],
    message: "Interested in custom packaging",
    utmSource: "cold-outreach",
    createdAt: fixedNow,
  }, fixedNow);

  assert.match(catalog.message.subject, /\[랜딩\/카탈로그\] Glow Brand/);
  assert.match(catalog.message.bodyText, /카탈로그 상담/);
  assert.match(catalog.message.bodyText, /PDRN Glow Booster \(serum\)/);
  assert.match(catalog.message.bodyText, /Glow Brand/);
  assert.match(catalog.message.bodyText, /Alice/);
  assert.equal(catalog.message.from, "alice@glow.com");

  const dashboard = buildWebProjection("landingRequests", "req-dash-1", {
    landingVariant: "dashboard",
    companyName: "Nova Skin",
    contactName: "Bob",
    email: "bob@nova.com",
    country: "Canada",
    expectedVolume: "5,000",
    dashboardBrief: {
      step1: { selection: "anti-aging serum" },
      step2: { selections: [{ group: "Glass Dropper Bottle" }] },
      step4: { orderQuantity: 5000 },
    },
    message: "Need sample in 2 weeks",
    createdAt: fixedNow,
  }, fixedNow);

  assert.match(dashboard.message.subject, /\[랜딩\/대시보드\] Nova Skin/);
  assert.match(dashboard.message.bodyText, /대시보드 맞춤 브리프/);
  assert.match(dashboard.message.bodyText, /anti-aging serum/);
  assert.match(dashboard.message.bodyText, /Glass Dropper Bottle/);
  assert.match(dashboard.message.bodyText, /5000/);
  assert.equal(dashboard.message.from, "bob@nova.com");

  const korea = buildWebProjection("landingRequests", "req-kor-1", {
    landingVariant: "korea",
    companyName: "Seoul Beauty Co",
    email: "buyer@seoulbeauty.com",
    expectedVolume: "10,000",
    referralSource: "Cold Email",
    businessType: "Indie Brand",
    positioningArm: "arm-a",
    message: "Interested in OEM manufacturing",
    createdAt: fixedNow,
  }, fixedNow);

  assert.match(korea.message.subject, /\[랜딩\/korea\] Seoul Beauty Co/);
  assert.match(korea.message.bodyText, /콜드메일 랜딩\(korea\) 문의/);
  assert.match(korea.message.bodyText, /Seoul Beauty Co/);
  assert.match(korea.message.bodyText, /Indie Brand/);
  assert.match(korea.message.bodyText, /Cold Email/);
  assert.equal(korea.message.from, "buyer@seoulbeauty.com");
});

test("materializer creates identity, message and thread transactionally", async () => {
  const db = fakeDb();
  const data = {
    companyName: "Acme",
    email: "jane@example.com",
    message: "Hello",
    createdAt: fixedNow,
  };

  const result = await materializeWebSubmission(db, "contact", "contact-1", data, { now: fixedNow });

  assert.equal(result.created, true);
  assert.equal(db.writes.length, 3);
  assert.deepEqual(db.writes.map((write) => write.type), ["create", "create", "create"]);
  assert.equal(db.writes[0].key, "conversationIdentities/email:jane@example.com");
  assert.equal(db.writes[1].key, "messages/web_contact_contact-1");
  assert.equal(db.writes[2].key, "threads/web:contact:contact:contact-1");
  assert.equal(db.writes[1].data.threadKey, db.writes[2].key.slice("threads/".length));
  assert.equal(db.writes[2].data.identityId, "email:jane@example.com");
});

test("retry does not create duplicates and repairs a missing thread", async () => {
  const data = { email: "jane@example.com", message: "Hello", createdAt: fixedNow };
  const firstDb = fakeDb();
  const first = await materializeWebSubmission(firstDb, "contact", "contact-2", data, { now: fixedNow });
  const existingIdentity = firstDb.writes.find((write) => write.key.startsWith("conversationIdentities/")).data;
  const existingMessage = firstDb.writes.find((write) => write.key.startsWith("messages/")).data;
  const secondDb = fakeDb({
    [`conversationIdentities/${first.identityId}`]: existingIdentity,
    [`messages/${first.messageId}`]: existingMessage,
  });
  const repaired = await materializeWebSubmission(secondDb, "contact", "contact-2", data, { now: fixedNow });
  assert.equal(repaired.created, false);
  assert.equal(secondDb.writes.length, 1);
  assert.match(secondDb.writes[0].key, /^threads\//);

  const completeDb = fakeDb({
    [`conversationIdentities/${first.identityId}`]: existingIdentity,
    [`messages/${first.messageId}`]: existingMessage,
    [`threads/${first.threadKey}`]: firstDb.writes.find((write) => write.key.startsWith("threads/")).data,
  });
  await materializeWebSubmission(completeDb, "contact", "contact-2", data, { now: fixedNow });
  assert.equal(completeDb.writes.length, 0);
});

test("test submissions follow source policy", async () => {
  const db = fakeDb();
  const data = { isTest: true, email: "test@example.com", message: "test", landingVariant: "korea", companyName: "Test Co", expectedVolume: "1,000" };
  const skipped = await materializeWebSubmission(db, "landingRequests", "lead-1", data, {
    skipTest: true,
    now: fixedNow,
  });
  assert.equal(skipped.skipped, true);
  assert.equal(db.writes.length, 0);

  const materialized = await materializeWebSubmission(db, "contact", "contact-test", data, {
    now: fixedNow,
  });
  assert.equal(materialized.created, true);
  assert.equal(db.writes.length, 3);
});
