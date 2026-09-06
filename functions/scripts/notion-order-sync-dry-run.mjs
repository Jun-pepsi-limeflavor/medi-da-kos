// 실제 Firebase(users/orders)를 읽어서 Notion에 동기화해보는 디버그용 스크립트.
// Firestore는 읽기만 한다 — orders 문서의 notionSync 필드는 건드리지 않고
// 멱등성 추적은 메모리에서만 한다. Notion 쪽에는 실제로 페이지/표가 생성된다.
//
// 사용법:
//   export NOTION_API_KEY="$(gcloud secrets versions access latest --secret=NOTION_API_KEY --project=medidakos)"
//   node functions/scripts/notion-order-sync-dry-run.mjs
//
// 다른 Notion DB로 테스트하려면 NOTION_DATABASE_ID 등을 env로 덮어쓴다.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { syncOrderToNotion } = require("../notion-sync.js");

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) {
  console.error("NOTION_API_KEY env var가 필요합니다.");
  process.exit(1);
}

const notion = {
  apiKey: NOTION_API_KEY,
  databaseId: process.env.NOTION_DATABASE_ID || "3d16cc41-8ff2-8046-9d69-c89d0222a745",
  emailPropertyType: process.env.NOTION_EMAIL_PROPERTY_TYPE || "rich_text",
  propertyNames: {
    name: process.env.NOTION_PROP_NAME || "이름",
    email: process.env.NOTION_PROP_EMAIL || "이메일",
    items: process.env.NOTION_PROP_ITEMS || "품목",
    synced: process.env.NOTION_PROP_SYNCED || "메일이력생성됨",
    createdAt: process.env.NOTION_PROP_CREATED_AT || "생성일",
  },
};

function inMemoryDb() {
  const docs = new Map();
  return {
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
              const prev = docs.get(key) || {};
              docs.set(key, opts?.merge ? { ...prev, ...data } : data);
            },
          };
        },
      };
    },
  };
}

initializeApp({ credential: applicationDefault(), projectId: "medidakos" });
const db = getFirestore();

const [usersSnap, ordersSnap] = await Promise.all([
  db.collection("users").get(),
  db.collection("orders").get(),
]);

const usersById = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
const ordersByUid = new Map();
for (const doc of ordersSnap.docs) {
  const order = doc.data();
  if (!order.uid || order.isTest) continue;
  const list = ordersByUid.get(order.uid) || [];
  list.push({ id: doc.id, ...order });
  ordersByUid.set(order.uid, list);
}
for (const list of ordersByUid.values()) {
  list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

const fakeDb = inMemoryDb();
let ok = 0;
let failed = 0;

for (const [uid, orders] of ordersByUid) {
  const user = usersById.get(uid) || {};
  const customerEmail = user.email || null;
  const customerName = user.displayName || user.companyName || null;

  for (const order of orders) {
    try {
      const result = await syncOrderToNotion({
        db: fakeDb,
        orderId: order.id,
        order,
        customerEmail,
        customerName,
        notion,
      });
      if (!result.skipped) ok += 1;
      console.log(
        `OK   uid=${uid} order=${order.id} email=${customerEmail} pageId=${result.pageId ?? "-"} reason=${result.reason ?? ""}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`FAIL uid=${uid} order=${order.id}:`, error.message || error);
    }
  }
}

const totalOrders = [...ordersByUid.values()].reduce((n, l) => n + l.length, 0);
console.log(`---\ncustomers=${ordersByUid.size} orders=${totalOrders} ok=${ok} failed=${failed}`);
