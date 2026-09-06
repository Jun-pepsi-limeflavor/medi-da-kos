const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_BLOCKS_PER_APPEND = 100;

function notionHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "content-type": "application/json",
  };
}

async function notionRequest({ apiKey, method, path, body, fetchImpl = fetch }) {
  const res = await fetchImpl(`${NOTION_API_BASE}${path}`, {
    method,
    headers: notionHeaders(apiKey),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.message || `Notion API 요청 실패 (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.notion = json;
    throw error;
  }
  return json;
}

function richText(value) {
  const text = value == null ? "" : String(value);
  return [{ type: "text", text: { content: text.slice(0, 2000) } }];
}

function paragraphBlock(text) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(text) } };
}

function heading3Block(text) {
  return { object: "block", type: "heading_3", heading_3: { rich_text: richText(text) } };
}

/**
 * 표 형태로 렌더링되는 테이블 셀 한 행. cells는 보통 문자열 배열이지만,
 * 이미 rich_text 배열(예: 페이지 멘션)로 만들어진 셀은 그대로 통과시킨다.
 */
function tableRow(cells) {
  return {
    object: "block",
    type: "table_row",
    table_row: { cells: cells.map((c) => (Array.isArray(c) ? c : richText(c))) },
  };
}

/** 다른 페이지로 링크되는 멘션 셀 — 표 안에서 클릭하면 그 페이지가 열린다. */
function pageMention(pageId) {
  return [{ type: "mention", mention: { type: "page", page: { id: pageId } } }];
}

/**
 * rows[0]을 헤더로 쓰는 Notion 테이블 블록. table_row 자식들은 table 블록과
 * 같은 append 요청 안에서만 생성할 수 있어(Notion API 제약) children으로 함께 보낸다.
 */
function tableBlock(rows, { hasColumnHeader = true } = {}) {
  const width = rows[0]?.length || 1;
  return {
    object: "block",
    type: "table",
    table: {
      table_width: width,
      has_column_header: hasColumnHeader,
      has_row_header: false,
      children: rows.map((cells) => tableRow(cells)),
    },
  };
}

function formatKoDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatCategory(step1) {
  const selection = step1?.selection ?? step1?.category;
  if (selection === "skincare") return "Skin Care";
  if (selection === "cosmetic") return "Cosmetic";
  if (selection === "rnd-agency") return "R&D Agency";
  return null;
}

/** step2.selections는 문자열이 아니라 PackagingSelection[]({ group, items })다. */
function formatPackaging(step2) {
  if (!Array.isArray(step2?.selections) || !step2.selections.length) return null;
  return step2.selections
    .map((sel) => {
      const items = Array.isArray(sel.items) && sel.items.length ? sel.items.join(", ") : "(옵션 미선택)";
      return `${sel.group}: ${items}`;
    })
    .join(" / ");
}

/** orderQuantity는 자유 텍스트 수량이지, volume의 단위(ml/g/oz)를 붙일 대상이 아니다. */
function formatQuantity(step4) {
  if (!step4) return null;
  if (step4.orderQuantityTbd) return "미정 (TBD)";
  const qty = step4.orderQuantity || step4.moq;
  return qty ? `${qty}개` : null;
}

function formatVolume(step4) {
  if (!step4?.volume) return null;
  return `${step4.volume}${step4.unit || ""}`;
}

/** CMBriefStep5: color가 아니라 colorHex, scent가 아니라 fragranceNotes(+unscented/fragranceFree)다. */
function formatFragrance(step5) {
  if (!step5) return null;
  if (step5.fragranceFree) return "향료 성분 없음 (Fragrance-free)";
  if (step5.unscented) return "무향 (Unscented)";
  return step5.fragranceNotes || null;
}

function formatShippingAddress(address) {
  if (!address) return null;
  const parts = [
    address.recipientName,
    [address.addressLine1, address.addressLine2].filter(Boolean).join(" "),
    [address.city, address.stateOrProvince].filter(Boolean).join(", "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
    address.phone,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * CMWizard(src/components/dashboard/CMWizard.tsx)가 실제로 기입받는 필드를 기준으로
 * [라벨, 값] 행을 만든다. 값이 없는 필드는 건너뛴다.
 */
function buildOrderFields(order) {
  const brief = order.briefSnapshot;
  if (!brief || typeof brief !== "object") {
    return [
      ["제목", order.title || "-"],
      ["요약", order.summary || "-"],
    ];
  }

  const rows = [];
  const push = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    rows.push([label, String(value)]);
  };

  push("카테고리", formatCategory(brief.step1));
  push("제품명", brief.step6?.productName);
  push("용량", formatVolume(brief.step4));
  push("주문 수량", formatQuantity(brief.step4));
  push("포장", formatPackaging(brief.step2));
  push("색상", brief.step5?.colorHex);
  push("점도(제형)", brief.step5?.viscosity);
  push("스킨필", brief.step5?.textureNotes);
  push("피니시", brief.step5?.finishNotes);
  push("향", formatFragrance(brief.step5));
  if (brief.step6?.vegan) push("비건", "필요");
  push("핵심 성분", brief.step6?.conceptIngredients);
  push("제외 성분", brief.step6?.restrictedIngredients);
  if (brief.step6?.functionalClaims?.length) push("기능성 클레임", brief.step6.functionalClaims.join(", "));
  if (brief.step6?.internationalCertifications?.length) {
    push("인증", brief.step6.internationalCertifications.join(", "));
  }
  push("샘플 요청일", brief.step4?.sampleRequestDate);
  push("목표 출시일", brief.step4?.targetLaunchDate);
  push("배송지", formatShippingAddress(brief.shippingAddress));
  push("상태", order.status);

  if (!rows.length) {
    rows.push(["제목", [order.title, order.summary].filter(Boolean).join(" — ") || "-"]);
  }
  return rows;
}

function buildOrderSection({ orderId, order, orderedAt }) {
  const type = order.type === "sample" ? "샘플 주문" : "일반 주문";
  const fields = buildOrderFields(order);
  return {
    heading: heading3Block(`${type} · ${formatKoDate(orderedAt)} (${orderId})`),
    table: tableBlock([["항목", "내용"], ...fields]),
  };
}

/**
 * "품목" 속성용 짧은 요약 — 전체 상세는 본문 표(buildOrderFields)에 있으니
 * 속성에는 {제품명, 수량, 인증, 핵심 성분}만 남긴다.
 */
function buildItemsSummary(order) {
  const brief = order.briefSnapshot;
  if (!brief || typeof brief !== "object") {
    return [["제목", [order.title, order.summary].filter(Boolean).join(" — ") || "-"]];
  }

  const rows = [];
  const push = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    rows.push([label, String(value)]);
  };
  push("제품명", brief.step6?.productName);
  push("수량", formatQuantity(brief.step4));
  if (brief.step6?.internationalCertifications?.length) {
    push("인증", brief.step6.internationalCertifications.join(", "));
  }
  push("핵심 성분", brief.step6?.conceptIngredients);

  if (!rows.length) {
    rows.push(["제목", [order.title, order.summary].filter(Boolean).join(" — ") || "-"]);
  }
  return rows;
}

function formatItemsSummaryText(order) {
  return buildItemsSummary(order)
    .map(([label, value]) => `${label}: ${value}`)
    .join(" · ");
}

async function findCustomerPage({
  apiKey,
  databaseId,
  emailProperty,
  emailPropertyType,
  email,
  fetchImpl,
}) {
  const filter = { property: emailProperty, [emailPropertyType]: { equals: email } };
  const json = await notionRequest({
    apiKey,
    method: "POST",
    path: `/databases/${databaseId}/query`,
    body: { filter, page_size: 1 },
    fetchImpl,
  });
  return json.results?.[0]?.id || null;
}

function buildPageProperties({ propertyNames, emailPropertyType, name, email, itemsSummary, createdAt }) {
  const props = {};
  props[propertyNames.name] = { title: richText(name || email || "-") };
  props[propertyNames.email] =
    emailPropertyType === "email"
      ? { email: email || null }
      : { rich_text: richText(email || "") };
  if (propertyNames.items) {
    props[propertyNames.items] = { rich_text: richText(itemsSummary) };
  }
  if (propertyNames.createdAt && createdAt) {
    props[propertyNames.createdAt] = { date: { start: createdAt } };
  }
  return props;
}

/** 고객 프로필 행만 만든다 — 주문/이메일 내용은 ensureSectionPages()가 만드는 하위 페이지로 들어간다. */
async function createCustomerPage({
  apiKey,
  databaseId,
  propertyNames,
  emailPropertyType,
  name,
  email,
  itemsSummary,
  createdAt,
  fetchImpl,
}) {
  const json = await notionRequest({
    apiKey,
    method: "POST",
    path: "/pages",
    body: {
      parent: { database_id: databaseId },
      properties: buildPageProperties({ propertyNames, emailPropertyType, name, email, itemsSummary, createdAt }),
    },
    fetchImpl,
  });
  return json.id;
}

async function updatePageProperties({ apiKey, pageId, properties, fetchImpl }) {
  if (!properties || !Object.keys(properties).length) return;
  await notionRequest({
    apiKey,
    method: "PATCH",
    path: `/pages/${pageId}`,
    body: { properties },
    fetchImpl,
  });
}

/** 페이지(부모가 database가 아니라 page)를 만든다 — "주문 내역"/"이메일 이력" 같은 하위 페이지용. */
async function createSubPage({ apiKey, parentPageId, title, children, fetchImpl }) {
  const json = await notionRequest({
    apiKey,
    method: "POST",
    path: "/pages",
    body: {
      parent: { page_id: parentPageId },
      properties: { title: { title: richText(title) } },
      ...(children?.length ? { children } : {}),
    },
    fetchImpl,
  });
  return json.id;
}

async function listAllChildren({ apiKey, blockId, fetchImpl }) {
  const results = [];
  let cursor;
  do {
    const query = cursor ? `?start_cursor=${cursor}` : "";
    const json = await notionRequest({
      apiKey,
      method: "GET",
      path: `/blocks/${blockId}/children${query}`,
      fetchImpl,
    });
    results.push(...(json.results || []));
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return results;
}

/**
 * 고객 메인 페이지 아래 "주문 내역"/"이메일 이력" 하위 페이지를 찾거나 만든다.
 * 두 종류의 내용을 한 페이지에 다 쌓으면 길어질수록 보기 어려워지는 걸 막는다.
 */
async function ensureSectionPages({ apiKey, mainPageId, fetchImpl }) {
  const children = await listAllChildren({ apiKey, blockId: mainPageId, fetchImpl });
  const findByTitle = (title) =>
    children.find((b) => b.type === "child_page" && b.child_page?.title === title)?.id;

  let ordersPageId = findByTitle("주문 내역");
  let historyPageId = findByTitle("이메일 이력");

  if (!ordersPageId) {
    ordersPageId = await createSubPage({ apiKey, parentPageId: mainPageId, title: "주문 내역", fetchImpl });
  }
  if (!historyPageId) {
    historyPageId = await createSubPage({ apiKey, parentPageId: mainPageId, title: "이메일 이력", fetchImpl });
  }
  return { ordersPageId, historyPageId };
}

async function appendOrderSection({ apiKey, pageId, section, fetchImpl }) {
  const children = [section.heading, section.table];
  for (let i = 0; i < children.length; i += MAX_BLOCKS_PER_APPEND) {
    await notionRequest({
      apiKey,
      method: "PATCH",
      path: `/blocks/${pageId}/children`,
      body: { children: children.slice(i, i + MAX_BLOCKS_PER_APPEND) },
      fetchImpl,
    });
  }
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * orders/{orderId}.notionSync로 멱등 처리한다 — status가 success면 재시도 시 스킵한다.
 * Notion 미설정(databaseId 없음) 상태에서도 배포/트리거가 깨지지 않도록 조용히 건너뛴다.
 */
async function syncOrderToNotion({
  db,
  orderId,
  order,
  customerEmail,
  customerName,
  notion,
  fetchImpl = fetch,
  now = nowIso,
}) {
  if (!notion?.apiKey || !notion?.databaseId) {
    console.log(`notion-sync ${orderId}: NOTION 설정 없음 — 스킵`);
    return { skipped: true, reason: "not-configured" };
  }
  if (!customerEmail) {
    console.log(`notion-sync ${orderId}: 고객 이메일 없음 — 스킵`);
    return { skipped: true, reason: "no-email" };
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (orderSnap.exists && orderSnap.data().notionSync?.status === "success") {
    console.log(`notion-sync ${orderId}: 이미 동기화됨 — 스킵`);
    return { skipped: true, reason: "already-synced" };
  }

  const { apiKey, databaseId, propertyNames, emailPropertyType } = notion;
  const orderedAt = order.createdAt || now();
  const section = buildOrderSection({ orderId, order, orderedAt });

  try {
    let pageId = await findCustomerPage({
      apiKey,
      databaseId,
      emailProperty: propertyNames.email,
      emailPropertyType,
      email: customerEmail,
      fetchImpl,
    });

    if (pageId) {
      // 생성일은 "최근 주문일시"로 매번 갱신한다 — 재주문 순으로 정렬할 수 있게.
      if (propertyNames.createdAt) {
        await updatePageProperties({
          apiKey,
          pageId,
          properties: { [propertyNames.createdAt]: { date: { start: orderedAt } } },
          fetchImpl,
        });
      }
    } else {
      pageId = await createCustomerPage({
        apiKey,
        databaseId,
        propertyNames,
        emailPropertyType,
        name: customerName,
        email: customerEmail,
        itemsSummary: formatItemsSummaryText(order),
        createdAt: orderedAt,
        fetchImpl,
      });
    }

    const { ordersPageId } = await ensureSectionPages({ apiKey, mainPageId: pageId, fetchImpl });
    await appendOrderSection({ apiKey, pageId: ordersPageId, section, fetchImpl });

    await orderRef.set(
      { notionSync: { status: "success", pageId, at: now() } },
      { merge: true },
    );
    return { skipped: false, pageId };
  } catch (error) {
    await orderRef
      .set(
        { notionSync: { status: "error", error: String(error.message || error), at: now() } },
        { merge: true },
      )
      .catch(() => {
        // 원래 에러를 가리면 안 되므로 상태 기록 실패는 무시한다.
      });
    throw error;
  }
}

module.exports = {
  NOTION_API_BASE,
  NOTION_VERSION,
  notionRequest,
  richText,
  paragraphBlock,
  heading3Block,
  tableRow,
  tableBlock,
  pageMention,
  formatCategory,
  formatPackaging,
  formatQuantity,
  formatVolume,
  formatFragrance,
  formatShippingAddress,
  buildOrderFields,
  buildItemsSummary,
  formatItemsSummaryText,
  buildOrderSection,
  findCustomerPage,
  buildPageProperties,
  createCustomerPage,
  updatePageProperties,
  createSubPage,
  listAllChildren,
  ensureSectionPages,
  appendOrderSection,
  syncOrderToNotion,
};
