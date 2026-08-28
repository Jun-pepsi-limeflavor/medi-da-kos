const WEB_CHANNEL = "web";
const WEB_SIDE = "brand";
const WEB_SIDE_SOURCE = "account_rule";
const MAX_BODY_LENGTH = 8_000;

const SOURCE_CONFIG = {
  contact: {
    label: "웹 문의",
    subjectLabel: "문의",
  },
  koreaLeads: {
    label: "콜드메일 랜딩 문의",
    subjectLabel: "korea",
  },
  orders: {
    label: "주문",
    subjectLabel: "주문",
  },
  sampleRequests: {
    label: "샘플 요청",
    subjectLabel: "샘플",
  },
};

function asText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function line(label, value) {
  const text = asText(value);
  return text ? `${label}: ${text}` : null;
}

function firstValue(...values) {
  return values.map(asText).find(Boolean) || "";
}

function sourceTimestamp(value, fallback) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return fallback;
}

function safeIdPart(value) {
  // Keep percent escapes intact: replacing '%' would make `a/b` collide with
  // an actual ID containing the text `a_2Fb`.
  return encodeURIComponent(asText(value));
}

function buildSubject(source, id, data) {
  const config = SOURCE_CONFIG[source];
  const identity = firstValue(data.companyName, data.customerEmail, data.email, id);
  return `[${config.subjectLabel}] ${identity}`.slice(0, 240);
}

function buildBody(source, id, data) {
  const rows = [];
  const config = SOURCE_CONFIG[source];
  rows.push(config.label);
  rows.push(line("문서", `${source}/${id}`));

  if (source === "contact") {
    rows.push(line("회사/브랜드", data.companyName));
    rows.push(line("담당자", data.contactName || data.name));
    rows.push(line("이메일", data.email));
    rows.push(line("유입 경로", data.referralSource));
    rows.push(line("비즈니스 유형", data.businessType));
    rows.push(line("문의 내용", data.message));
    rows.push(line("페이지 URL", data.pageUrl));
  } else if (source === "koreaLeads") {
    rows.push(line("회사/브랜드", data.companyName));
    rows.push(line("이메일", data.email));
    rows.push(line("예상 물량", data.expectedVolumeLabel || data.expectedVolume));
    rows.push(line("고객 유형", data.businessType));
    rows.push(line("유입 경로", data.referralSource));
    rows.push(line("문의 내용", data.message));
    rows.push(line("페이지 URL", data.pageUrl));
  } else if (source === "orders") {
    rows.push(line("주문 유형", data.type));
    rows.push(line("품목", data.title));
    rows.push(line("요약", data.summary));
    rows.push(line("상태", data.status));
    rows.push(line("고객 이메일", data.customerEmail));
  } else if (source === "sampleRequests") {
    const address = data.shippingAddress || {};
    rows.push(line("제품", data.sampleProductName || data.sampleProductId));
    rows.push(line("수량", data.sampleQuantity));
    rows.push(line("수령인", address.recipientName || data.recipientName));
    rows.push(line("국가", address.country));
    rows.push(line("우편번호", address.postalCode));
  }

  return rows.filter(Boolean).join("\n").slice(0, MAX_BODY_LENGTH);
}

function buildWebProjection(source, id, data, now = new Date().toISOString()) {
  const config = SOURCE_CONFIG[source];
  if (!config) throw new Error(`지원하지 않는 웹 원천: ${source}`);

  const sourceAccount = source;
  const sourceId = safeIdPart(id);
  const providerThreadId = `${source}:${sourceId}`;
  const threadKey = `${WEB_CHANNEL}:${sourceAccount}:${providerThreadId}`;
  const externalId = `${source}:${id}`;
  const email = firstValue(data.email, data.customerEmail);
  const name = firstValue(
    data.contactName,
    data.name,
    data.customerName,
    data.shippingAddress && data.shippingAddress.recipientName,
    data.companyName,
    email,
  );
  const sentAt = sourceTimestamp(data.createdAt || data.serverCreatedAt, now);
  const updatedAt = sourceTimestamp(data.updatedAt || data.createdAt || data.serverCreatedAt, sentAt);

  const message = {
    channel: WEB_CHANNEL,
    side: WEB_SIDE,
    sideSource: WEB_SIDE_SOURCE,
    sourceAccount,
    externalId,
    providerThreadId,
    threadKey,
    historyId: externalId,
    direction: "in",
    from: email || `web+${sourceId}@medidakos.invalid`,
    fromName: name || config.label,
    to: [],
    subject: buildSubject(source, id, data),
    bodyText: buildBody(source, id, data),
    attachments: [],
    sentAt,
    parseStatus: "completed",
    createdAt: sentAt,
    sourceUpdatedAt: updatedAt,
  };

  const thread = {
    channel: WEB_CHANNEL,
    sourceAccount,
    providerThreadId,
    readState: "unread",
    triageState: "open",
    linkState: "unlinked",
    side: WEB_SIDE,
    sideSource: WEB_SIDE_SOURCE,
    sideHistory: [],
    lastMessageAt: sentAt,
    lastDirection: "in",
    createdAt: sentAt,
    updatedAt: updatedAt,
  };

  return { messageId: `web_${source}_${sourceId}`, threadKey, message, thread };
}

/**
 * Create the synthetic inbound message and its thread in one transaction.
 * Existing messages are never overwritten; a missing thread is repaired so a
 * partially completed retry remains idempotent.
 */
async function materializeWebSubmission(db, source, id, data, options = {}) {
  if (!SOURCE_CONFIG[source]) throw new Error(`지원하지 않는 웹 원천: ${source}`);
  if (options.skipTest === true && data.isTest === true) {
    return { skipped: true, created: false };
  }

  const projection = buildWebProjection(source, id, data, options.now);
  const messageRef = db.collection("messages").doc(projection.messageId);
  const threadRef = db.collection("threads").doc(projection.threadKey);
  let result = { skipped: false, created: false };

  await db.runTransaction(async (tx) => {
    const messageSnap = await tx.get(messageRef);
    const threadSnap = await tx.get(threadRef);

    if (!messageSnap.exists) {
      tx.create(messageRef, projection.message);
      result.created = true;
    }
    if (!threadSnap.exists) {
      tx.create(threadRef, projection.thread);
    }
  });

  return { ...result, messageId: projection.messageId, threadKey: projection.threadKey };
}

module.exports = {
  MAX_BODY_LENGTH,
  buildBody,
  buildWebProjection,
  materializeWebSubmission,
};
