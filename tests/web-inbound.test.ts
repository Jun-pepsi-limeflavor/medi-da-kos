import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);

const {
  buildWebSubject,
  buildWebBody,
  materializeWebSubmissionRecord,
} = await import("../src/lib/repo/web-inbound.ts");

const fixedNow = "2026-09-02T12:00:00.000Z";

interface MockDocRef {
  key: string;
  id: string;
  colName: string;
  get: () => Promise<{ exists: boolean; id: string; data: () => Record<string, unknown> | undefined }>;
}

interface MockQuery {
  limit: (n: number) => {
    get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }>; size: number }>;
  };
  get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }>; size: number }>;
}

function fakeFirestore(initialDocs: Record<string, Record<string, unknown>> = {}) {
  const docs = new Map<string, Record<string, unknown>>(Object.entries(initialDocs));
  const writes: Array<{ type: "create" | "update"; key: string; data: Record<string, unknown> }> = [];

  function buildQuery(colName: string, field?: string, op?: string, val?: unknown): MockQuery {
    const run = async () => {
      const matches: Array<{ id: string; data: () => Record<string, unknown> }> = [];
      for (const [k, d] of docs.entries()) {
        if (k.startsWith(`${colName}/`)) {
          const docId = k.slice(`${colName}/`.length);
          if (field && op) {
            if (op === "array-contains" && Array.isArray(d[field]) && d[field].includes(val)) {
              matches.push({ id: docId, data: () => d });
            } else if (op === "==" && d[field] === val) {
              matches.push({ id: docId, data: () => d });
            }
          } else {
            matches.push({ id: docId, data: () => d });
          }
        }
      }
      return { docs: matches, size: matches.length };
    };

    return {
      limit: () => ({ get: run }),
      get: run,
    };
  }

  const db = {
    collection(colName: string) {
      return {
        doc(id: string): MockDocRef {
          const key = `${colName}/${id}`;
          return {
            key,
            id,
            colName,
            async get() {
              const data = docs.get(key);
              return {
                exists: Boolean(data),
                id,
                data: () => data,
              };
            },
          };
        },
        where(field: string, op: string, val: unknown) {
          return buildQuery(colName, field, op, val);
        },
      };
    },
    async runTransaction(cb: (tx: {
      get: (ref: MockDocRef | MockQuery | ReturnType<MockQuery["limit"]>) => Promise<unknown>;
      create: (ref: MockDocRef, data: Record<string, unknown>) => void;
      update: (ref: MockDocRef, data: Record<string, unknown>) => void;
    }) => Promise<void>) {
      const tx = {
        async get(ref: MockDocRef | MockQuery | ReturnType<MockQuery["limit"]>) {
          if (ref && "limit" in ref && typeof ref.limit === "function") {
            return ref.limit(10).get();
          }
          if (ref && "get" in ref && typeof ref.get === "function" && !("key" in ref)) {
            return (ref as MockQuery).get();
          }
          const docRef = ref as MockDocRef;
          const data = docs.get(docRef.key);
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
        create(ref: MockDocRef, data: Record<string, unknown>) {
          writes.push({ type: "create", key: ref.key, data });
          docs.set(ref.key, data);
        },
        update(ref: MockDocRef, data: Record<string, unknown>) {
          writes.push({ type: "update", key: ref.key, data });
          const existing = docs.get(ref.key) || {};
          docs.set(ref.key, { ...existing, ...data });
        },
      };
      await cb(tx);
    },
    writes,
    docs,
  };

  return db;
}

test("buildWebSubject formats orders, samples, contact, and landing requests properly", () => {
  const orderSubj = buildWebSubject("orders", "ord-1", { title: "Serum ODM" }, {
    uid: "u1",
    companyName: "GlowLab",
    displayName: "Jane",
  });
  assert.equal(orderSubj, "[주문] GlowLab");

  const sampleSubj = buildWebSubject("sampleRequests", "s-1", {}, {
    uid: "u2",
    displayName: "John Doe",
  });
  assert.equal(sampleSubj, "[샘플] John Doe");

  const contactSubj = buildWebSubject("contact", "c-1", { companyName: "Acme Corp" });
  assert.equal(contactSubj, "[문의] Acme Corp");

  const landingSubj = buildWebSubject("landingRequests", "l-1", {
    landingVariant: "catalog",
    companyName: "Star Brand",
  });
  assert.equal(landingSubj, "[랜딩/카탈로그] Star Brand");
});

test("buildWebBody builds clean structured text with user profile and brief details", () => {
  const body = buildWebBody("orders", "ord-100", {
    type: "custom",
    title: "Skin Care ODM",
    summary: "Quantity: 5,000",
    briefSnapshot: {
      step1: { selection: "Toner & Mist" },
      step4: { orderQuantity: "5000", volume: "150", unit: "ml" },
    },
    shippingAddress: {
      recipientName: "Jane Doe",
      country: "United States",
      city: "New York",
    },
  }, {
    uid: "u100",
    email: "jane@glowlab.com",
    displayName: "Jane Doe",
    companyName: "GlowLab",
  });

  assert.match(body, /\[대시보드 주문\/브리프\]/);
  assert.match(body, /회원 회사명: GlowLab/);
  assert.match(body, /회원 이메일: jane@glowlab\.com/);
  assert.match(body, /카테고리 \(Step 1\): Toner & Mist/);
  assert.match(body, /주문 수량 \(Step 4\): 5000/);
  assert.match(body, /용량 \(Step 4\): 150 ml/);
  assert.match(body, /수령인: Jane Doe/);
  assert.match(body, /국가: United States/);
});

test("materializeWebSubmissionRecord creates unclassified identity, message, and thread", async () => {
  const db = fakeFirestore() as unknown as FirebaseFirestore.Firestore;

  const result = await materializeWebSubmissionRecord(
    db,
    "orders",
    "order-abc",
    {
      type: "custom",
      title: "Custom Cream",
      createdAt: fixedNow,
    },
    {
      uid: "u-abc",
      email: "buyer@example.com",
      displayName: "Alice",
      companyName: "Alice Skin",
    },
    fixedNow,
  );

  assert.equal(result.identityCreated, true);
  assert.equal(result.messageCreated, true);
  assert.equal(result.threadCreated, true);

  const rawDb = db as unknown as ReturnType<typeof fakeFirestore>;
  const identity = rawDb.docs.get("conversationIdentities/email:buyer@example.com");
  assert.ok(identity);
  assert.equal(identity.classification, "unclassified");
  assert.equal(identity.displayName, "Alice");
  assert.equal(identity.displayEmail, "buyer@example.com");

  const message = rawDb.docs.get("messages/web_orders_order-abc");
  assert.ok(message);
  assert.equal(message.from, "buyer@example.com");
  assert.equal(message.fromName, "Alice");
  assert.equal(message.threadKey, "web:orders:orders:order-abc");

  const thread = rawDb.docs.get("threads/web:orders:orders:order-abc");
  assert.ok(thread);
  assert.equal(thread.identityId, "email:buyer@example.com");
  assert.equal(thread.classification, "unclassified");
  assert.equal(thread.channel, "web");
});

test("materializeWebSubmissionRecord links to existing buyer when email matches", async () => {
  const initialDocs = {
    "buyers/b-1": {
      name: "Existing Buyer",
      emails: ["registered@buyer.com"],
      conversationId: "conv-1",
    },
    "conversations/conv-1": {
      buyerId: "b-1",
    },
  };

  const db = fakeFirestore(initialDocs) as unknown as FirebaseFirestore.Firestore;

  const result = await materializeWebSubmissionRecord(
    db,
    "contact",
    "contact-999",
    {
      email: "registered@buyer.com",
      companyName: "Existing Buyer Corp",
      message: "Hello again",
      createdAt: fixedNow,
    },
    null,
    fixedNow,
  );

  assert.equal(result.identityCreated, true);

  const rawDb = db as unknown as ReturnType<typeof fakeFirestore>;
  const identity = rawDb.docs.get("conversationIdentities/email:registered@buyer.com");
  assert.ok(identity);
  assert.equal(identity.classification, "buyer");
  assert.equal(identity.buyerId, "b-1");
  assert.equal(identity.conversationId, "conv-1");

  const thread = rawDb.docs.get("threads/web:contact:contact:contact-999");
  assert.ok(thread);
  assert.equal(thread.classification, "buyer");
  assert.equal(thread.conversationId, "conv-1");
});
