import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeEmailIdentity } from "@/lib/schemas/conversation-identity";

const INTERNAL_DOMAINS = ["techasset.co.kr", "medidakoslabs.com", "medidakos.com"];

function isInternalEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const clean = email.toLowerCase().trim();
  return INTERNAL_DOMAINS.some((d) => clean.endsWith(`@${d}`));
}

export type WebSourceType = "orders" | "sampleRequests" | "contact" | "landingRequests";

export interface UserProfileData {
  uid: string;
  email?: string;
  displayName?: string;
  companyName?: string;
  phone?: string;
  country?: string;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function line(label: string, value: unknown): string | null {
  const text = asText(value);
  return text ? `${label}: ${text}` : null;
}

function sourceTimestamp(value: unknown, fallback: string): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return fallback;
}

const SOURCE_CONFIG: Record<WebSourceType, { label: string; subjectLabel: string }> = {
  orders: { label: "대시보드 주문/브리프", subjectLabel: "주문" },
  sampleRequests: { label: "대시보드 샘플 요청", subjectLabel: "샘플" },
  contact: { label: "웹 일반 문의", subjectLabel: "문의" },
  landingRequests: { label: "랜딩 상담 신청", subjectLabel: "랜딩" },
};

export function buildWebSubject(
  source: WebSourceType,
  id: string,
  data: Record<string, unknown>,
  user?: UserProfileData | null,
): string {
  const config = SOURCE_CONFIG[source] || { label: "웹 유입", subjectLabel: "웹" };
  const company = asText(data.companyName || user?.companyName);
  const name = asText(data.contactName || data.name || user?.displayName);
  const email = asText(data.email || data.customerEmail || user?.email);
  const identity = company || name || email || id;

  if (source === "landingRequests") {
    const variantTag =
      data.landingVariant === "catalog"
        ? "카탈로그"
        : data.landingVariant === "dashboard"
          ? "대시보드"
          : "korea";
    return `[${config.subjectLabel}/${variantTag}] ${identity}`.slice(0, 240);
  }
  return `[${config.subjectLabel}] ${identity}`.slice(0, 240);
}

export function buildWebBody(
  source: WebSourceType,
  id: string,
  data: Record<string, unknown>,
  user?: UserProfileData | null,
): string {
  const rows: (string | null)[] = [];
  const config = SOURCE_CONFIG[source];
  rows.push(`[${config.label}]`);
  rows.push(line("원천 문서", `${source}/${id}`));

  if (user) {
    if (user.companyName) rows.push(line("회원 회사명", user.companyName));
    if (user.displayName) rows.push(line("회원 이름", user.displayName));
    if (user.email) rows.push(line("회원 이메일", user.email));
    if (user.phone) rows.push(line("회원 연락처", user.phone));
    if (user.country) rows.push(line("회원 국가", user.country));
  }

  if (source === "orders") {
    rows.push(line("주문 유형", data.type));
    rows.push(line("주문 품목", data.title));
    rows.push(line("요약", data.summary));
    rows.push(line("상태", data.status));
    rows.push(line("참조 ID", data.referenceId));

    if (data.briefSnapshot && typeof data.briefSnapshot === "object") {
      const brief = data.briefSnapshot as Record<string, unknown>;
      rows.push("--- 맞춤 ODM 브리프 상세 ---");
      if (brief.step1) {
        const s1 = brief.step1 as { selection?: string; category?: string };
        rows.push(line("카테고리 (Step 1)", s1.selection || s1.category || JSON.stringify(s1)));
      }
      if (brief.step2) {
        const s2 = brief.step2 as { selections?: Array<{ group?: string; spec?: string }> };
        if (Array.isArray(s2.selections)) {
          rows.push(line("패키징 (Step 2)", s2.selections.map((s) => s.group || s.spec).join(", ")));
        }
      }
      if (brief.step3) {
        const s3 = brief.step3 as { logoFileName?: string };
        if (s3.logoFileName) rows.push(line("로고 파일 (Step 3)", s3.logoFileName));
      }
      if (brief.step4) {
        const s4 = brief.step4 as { orderQuantity?: string; orderQuantityTbd?: boolean; volume?: string; unit?: string };
        const qty = s4.orderQuantityTbd ? "수량 미정 (TBD)" : s4.orderQuantity;
        if (qty) rows.push(line("주문 수량 (Step 4)", qty));
        if (s4.volume) rows.push(line("용량 (Step 4)", `${s4.volume} ${s4.unit || ""}`.trim()));
      }
      if (brief.step5) {
        const s5 = brief.step5 as { targetPrice?: string; targetPriceTbd?: boolean };
        const price = s5.targetPriceTbd ? "가격 미정" : s5.targetPrice;
        if (price) rows.push(line("목표 단가 (Step 5)", price));
      }
    }

    if (data.shippingAddress && typeof data.shippingAddress === "object") {
      const addr = data.shippingAddress as Record<string, unknown>;
      rows.push("--- 배송지 정보 ---");
      rows.push(line("수령인", addr.recipientName));
      rows.push(line("국가", addr.country));
      rows.push(line("도시/주", [addr.city, addr.state].filter(Boolean).join(", ")));
      rows.push(line("상세주소", [addr.addressLine1, addr.addressLine2].filter(Boolean).join(" ")));
      rows.push(line("우편번호", addr.postalCode));
      rows.push(line("연락처", addr.phone));
    }
  } else if (source === "sampleRequests") {
    rows.push(line("신청 샘플", data.sampleProductName || data.sampleProductId));
    rows.push(line("신청 수량", data.sampleQuantity));
    if (data.shippingAddress && typeof data.shippingAddress === "object") {
      const addr = data.shippingAddress as Record<string, unknown>;
      rows.push("--- 샘플 수령지 ---");
      rows.push(line("수령인", addr.recipientName));
      rows.push(line("국가", addr.country));
      rows.push(line("도시/주", [addr.city, addr.state].filter(Boolean).join(", ")));
      rows.push(line("상세주소", [addr.addressLine1, addr.addressLine2].filter(Boolean).join(" ")));
      rows.push(line("우편번호", addr.postalCode));
      rows.push(line("연락처", addr.phone));
    }
  } else if (source === "contact") {
    rows.push(line("회사/브랜드", data.companyName));
    rows.push(line("담당자", data.contactName || data.name));
    rows.push(line("이메일", data.email));
    rows.push(line("유입 경로", data.referralSource));
    rows.push(line("비즈니스 유형", data.businessType));
    rows.push(line("문의 내용", data.message));
    rows.push(line("페이지 URL", data.pageUrl));
    if (data.utmSource) {
      rows.push(line("UTM", `source: ${data.utmSource} / medium: ${data.utmMedium || "-"} / campaign: ${data.utmCampaign || "-"}`));
    }
  } else if (source === "landingRequests") {
    const variant = data.landingVariant;
    const variantLabel =
      variant === "catalog"
        ? "카탈로그 제품 상담"
        : variant === "dashboard"
          ? "대시보드 맞춤 브리프"
          : "콜드메일 랜딩(/korea) 문의";
    rows.push(line("랜딩 유형", variantLabel));
    rows.push(line("회사/브랜드", data.companyName));
    rows.push(line("담당자", data.contactName || data.name));
    rows.push(line("이메일", data.email));
    rows.push(line("국가", data.country));
    rows.push(line("예상 수량", data.expectedVolume));
    if (data.businessType) rows.push(line("고객 유형", data.businessType));
    if (data.referralSource) rows.push(line("인지 경로", data.referralSource));
    if (data.positioningArm) rows.push(line("포지셔닝", data.positioningArm));

    if (variant === "catalog" && Array.isArray(data.catalogItems) && data.catalogItems.length > 0) {
      const items = data.catalogItems as Array<{ name?: string; category?: string }>;
      rows.push(line("선택 제품", items.map((item) => `${item.name || ""} (${item.category || ""})`).join(", ")));
    } else if (variant === "dashboard" && data.dashboardBrief) {
      const brief = data.dashboardBrief as Record<string, unknown>;
      rows.push("--- 랜딩 브리프 스냅샷 ---");
      if (brief.step1) rows.push(line("카테고리", JSON.stringify(brief.step1)));
      if (brief.step2) rows.push(line("패키징", JSON.stringify(brief.step2)));
      if (brief.step4) rows.push(line("수량", JSON.stringify(brief.step4)));
    }
    rows.push(line("문의 내용", data.message));
    if (data.utmSource) {
      rows.push(line("UTM", `source: ${data.utmSource} / medium: ${data.utmMedium || "-"} / campaign: ${data.utmCampaign || "-"}`));
    }
    rows.push(line("페이지 URL", data.pageUrl));
  }

  return rows.filter(Boolean).join("\n").slice(0, 8000);
}

export interface WebInboundSyncResult {
  totalScanned: number;
  ordersCount: number;
  sampleRequestsCount: number;
  contactCount: number;
  landingRequestsCount: number;
  identitiesCreated: number;
  identitiesUpdated: number;
  threadsCreated: number;
  threadsUpdated: number;
  messagesCreated: number;
  messagesUpdated: number;
}

/**
 * Materializes a single web submission record into conversationIdentities, threads, messages.
 */
export async function materializeWebSubmissionRecord(
  db: FirebaseFirestore.Firestore,
  source: WebSourceType,
  id: string,
  data: Record<string, unknown>,
  user?: UserProfileData | null,
  now = new Date().toISOString(),
) {
  // 1. Resolve counterparty email and display name
  const rawEmail =
    (user?.email as string) ||
    (data.email as string) ||
    (data.customerEmail as string) ||
    (data.buyerEmail as string) ||
    "";

  let customerEmail = rawEmail.trim().toLowerCase();
  if (!customerEmail || !customerEmail.includes("@")) {
    customerEmail = `web+${source}_${id.toLowerCase()}@medidakos.invalid`;
  }

  const normalizedEmail = normalizeEmailIdentity(customerEmail);
  const identityId = `email:${normalizedEmail}`;

  const displayName =
    (user?.displayName as string) ||
    (data.contactName as string) ||
    (data.name as string) ||
    (user?.companyName as string) ||
    (data.companyName as string) ||
    (data.shippingAddress && typeof data.shippingAddress === "object"
      ? ((data.shippingAddress as Record<string, unknown>).recipientName as string)
      : "") ||
    "";

  const companyName =
    (user?.companyName as string) ||
    (data.companyName as string) ||
    "";

  const sentAt = sourceTimestamp(data.createdAt || data.serverCreatedAt, now);
  const updatedAt = sourceTimestamp(data.updatedAt || data.createdAt || data.serverCreatedAt, sentAt);

  const threadKey = `web:${source}:${source}:${id}`;
  const messageId = `web_${source}_${id}`;

  const identityRef = db.collection("conversationIdentities").doc(identityId);
  const threadRef = db.collection("threads").doc(threadKey);
  const messageRef = db.collection("messages").doc(messageId);

  let identityCreated = false;
  let identityUpdated = false;
  let threadCreated = false;
  let threadUpdated = false;
  let messageCreated = false;
  let messageUpdated = false;

  await db.runTransaction(async (tx) => {
    const [identitySnap, threadSnap, messageSnap] = await Promise.all([
      tx.get(identityRef),
      tx.get(threadRef),
      tx.get(messageRef),
    ]);

    // --- 1. IDENTITY RESOLUTION ---
    let classification: "buyer" | "unclassified" | "internal" = "unclassified";
    let buyerId: string | undefined;
    let conversationId: string | undefined;

    if (!identitySnap.exists) {
      if (isInternalEmail(normalizedEmail)) {
        classification = "internal";
      } else {
        // Check if buyer exists with this email
        const buyerQuery = db.collection("buyers").where("emails", "array-contains", normalizedEmail).limit(2);
        const buyerSnap = await tx.get(buyerQuery);
        if (buyerSnap.docs.length === 1) {
          const bId = buyerSnap.docs[0].id;
          const convQuery = db.collection("conversations").where("buyerId", "==", bId).limit(2);
          const convSnap = await tx.get(convQuery);
          if (convSnap.docs.length === 1) {
            classification = "buyer";
            buyerId = bId;
            conversationId = convSnap.docs[0].id;
          }
        }
      }

      const identityDoc = {
        kind: "email",
        value: normalizedEmail,
        classification,
        ...(displayName ? { displayName } : {}),
        displayEmail: normalizedEmail,
        ...(buyerId ? { buyerId } : {}),
        ...(conversationId ? { conversationId } : {}),
        createdAt: sentAt,
        updatedAt: now,
      };

      tx.create(identityRef, identityDoc);
      identityCreated = true;
    } else {
      const existingIdentity = identitySnap.data()!;
      classification = existingIdentity.classification || "unclassified";
      buyerId = existingIdentity.buyerId;
      conversationId = existingIdentity.conversationId;

      const identityPatch: Record<string, unknown> = {};
      if (displayName && !existingIdentity.displayName) {
        identityPatch.displayName = displayName;
      }
      if (!existingIdentity.displayEmail) {
        identityPatch.displayEmail = normalizedEmail;
      }
      if (Object.keys(identityPatch).length > 0) {
        identityPatch.updatedAt = now;
        tx.update(identityRef, identityPatch);
        identityUpdated = true;
      }
    }

    // --- 2. MESSAGE RESOLUTION ---
    const subject = buildWebSubject(source, id, data, user);
    const bodyText = buildWebBody(source, id, data, user);

    const messageData = {
      channel: "web",
      side: "brand",
      sideSource: "account_rule",
      sourceAccount: source,
      externalId: `${source}:${id}`,
      providerThreadId: `${source}:${id}`,
      threadKey,
      historyId: `${source}:${id}`,
      direction: "in",
      from: normalizedEmail,
      fromName: displayName || companyName || SOURCE_CONFIG[source]?.label || "웹 문의",
      to: [],
      subject,
      bodyText,
      attachments: [],
      sentAt,
      parseStatus: "completed",
      createdAt: sentAt,
      sourceUpdatedAt: updatedAt,
    };

    if (!messageSnap.exists) {
      tx.create(messageRef, messageData);
      messageCreated = true;
    } else {
      tx.update(messageRef, {
        from: normalizedEmail,
        fromName: messageData.fromName,
        subject,
        bodyText,
        sourceUpdatedAt: now,
      });
      messageUpdated = true;
    }

    // --- 3. THREAD RESOLUTION ---
    if (!threadSnap.exists) {
      const threadData = {
        channel: "web",
        sourceAccount: source,
        providerThreadId: `${source}:${id}`,
        readState: "unread",
        triageState: "open",
        linkState: "unlinked",
        side: "brand",
        sideSource: "account_rule",
        sideHistory: [],
        lastMessageAt: sentAt,
        lastDirection: "in",
        identityId,
        classification,
        ...(conversationId ? { conversationId } : {}),
        lastInboundAt: sentAt,
        createdAt: sentAt,
        updatedAt: now,
      };
      tx.create(threadRef, threadData);
      threadCreated = true;
    } else {
      const prev = threadSnap.data()!;
      const threadPatch: Record<string, unknown> = {
        identityId,
        classification: prev.classification || classification,
        updatedAt: now,
      };
      if (conversationId && !prev.conversationId) {
        threadPatch.conversationId = conversationId;
      }
      if (!prev.lastInboundAt) {
        threadPatch.lastInboundAt = sentAt;
      }
      tx.update(threadRef, threadPatch);
      threadUpdated = true;
    }
  });

  return {
    identityCreated,
    identityUpdated,
    threadCreated,
    threadUpdated,
    messageCreated,
    messageUpdated,
  };
}

/**
 * Scans all web submission collections (orders, sampleRequests, contact, landingRequests)
 * and materializes them into conversationIdentities, threads, and messages.
 */
export async function syncAllWebSubmissions(
  db = getAdminDb(),
): Promise<WebInboundSyncResult> {
  const [ordersSnap, samplesSnap, contactSnap, landingSnap, usersSnap] = await Promise.all([
    db.collection("orders").get(),
    db.collection("sampleRequests").get(),
    db.collection("contact").get(),
    db.collection("landingRequests").get(),
    db.collection("users").get(),
  ]);

  const userByUid = new Map<string, UserProfileData>();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    userByUid.set(doc.id, {
      uid: doc.id,
      email: data.email as string | undefined,
      displayName: (data.displayName || data.name) as string | undefined,
      companyName: data.companyName as string | undefined,
      phone: data.phone as string | undefined,
      country: data.country as string | undefined,
    });
  }

  const result: WebInboundSyncResult = {
    totalScanned: 0,
    ordersCount: ordersSnap.size,
    sampleRequestsCount: samplesSnap.size,
    contactCount: contactSnap.size,
    landingRequestsCount: landingSnap.size,
    identitiesCreated: 0,
    identitiesUpdated: 0,
    threadsCreated: 0,
    threadsUpdated: 0,
    messagesCreated: 0,
    messagesUpdated: 0,
  };

  const now = new Date().toISOString();

  // 1. Process Orders
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    const user = data.uid ? userByUid.get(data.uid) : null;
    const res = await materializeWebSubmissionRecord(db, "orders", doc.id, data, user, now);
    if (res.identityCreated) result.identitiesCreated++;
    if (res.identityUpdated) result.identitiesUpdated++;
    if (res.threadCreated) result.threadsCreated++;
    if (res.threadUpdated) result.threadsUpdated++;
    if (res.messageCreated) result.messagesCreated++;
    if (res.messageUpdated) result.messagesUpdated++;
    result.totalScanned++;
  }

  // 2. Process Sample Requests
  for (const doc of samplesSnap.docs) {
    const data = doc.data();
    const user = data.uid ? userByUid.get(data.uid) : null;
    const res = await materializeWebSubmissionRecord(db, "sampleRequests", doc.id, data, user, now);
    if (res.identityCreated) result.identitiesCreated++;
    if (res.identityUpdated) result.identitiesUpdated++;
    if (res.threadCreated) result.threadsCreated++;
    if (res.threadUpdated) result.threadsUpdated++;
    if (res.messageCreated) result.messagesCreated++;
    if (res.messageUpdated) result.messagesUpdated++;
    result.totalScanned++;
  }

  // 3. Process Contact Forms
  for (const doc of contactSnap.docs) {
    const data = doc.data();
    const res = await materializeWebSubmissionRecord(db, "contact", doc.id, data, null, now);
    if (res.identityCreated) result.identitiesCreated++;
    if (res.identityUpdated) result.identitiesUpdated++;
    if (res.threadCreated) result.threadsCreated++;
    if (res.threadUpdated) result.threadsUpdated++;
    if (res.messageCreated) result.messagesCreated++;
    if (res.messageUpdated) result.messagesUpdated++;
    result.totalScanned++;
  }

  // 4. Process Landing Requests
  for (const doc of landingSnap.docs) {
    const data = doc.data();
    const res = await materializeWebSubmissionRecord(db, "landingRequests", doc.id, data, null, now);
    if (res.identityCreated) result.identitiesCreated++;
    if (res.identityUpdated) result.identitiesUpdated++;
    if (res.threadCreated) result.threadsCreated++;
    if (res.threadUpdated) result.threadsUpdated++;
    if (res.messageCreated) result.messagesCreated++;
    if (res.messageUpdated) result.messagesUpdated++;
    result.totalScanned++;
  }

  return result;
}
